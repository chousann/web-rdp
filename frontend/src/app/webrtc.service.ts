import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { SignalingService } from './signaling.service';

@Injectable({
  providedIn: 'root'
})
export class WebRtcService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private targetUserId: string | null = null;
  
  // 用于通知组件的事件
  public remoteStream$ = new Subject<MediaStream>();
  public connectionStatus$ = new Subject<string>();
  
  private configuration: RTCConfiguration = {
    iceServers: [
      {
        urls: ['stun:stun.l.google.com:19302']
      }
    ]
  };
  
  constructor(private signalingService: SignalingService) {
    this.setupSignalingListeners();
  }
  
  /**
   * 设置信令服务监听器
   */
  private setupSignalingListeners(): void {
    // 监听收到的offer
    this.signalingService.offerReceived$.subscribe(async (data) => {
      await this.handleOffer(data.from, data.offer);
    });
    
    // 监听收到的answer
    this.signalingService.answerReceived$.subscribe(async (data) => {
      await this.handleAnswer(data.answer);
    });
    
    // 监听收到的ICE候选
    this.signalingService.iceCandidateReceived$.subscribe(async (data) => {
      await this.handleIceCandidate(data.candidate);
    });
    
    // 监听连接请求
    this.signalingService.connectionRequested$.subscribe((from) => {
      console.log(`Connection request received from: ${from}`);
      // 自动接受连接请求并设置目标用户
      this.targetUserId = from;
    });
  }
  
  /**
   * 连接到特定用户
   */
  public connectToUser(userId: string): void {
    this.targetUserId = userId;
    // 发送连接请求到目标用户
    try {
      this.signalingService.sendConnectionRequest(userId);
    } catch (error) {
      console.error('Failed to send connection request:', error);
    }
  }
  
  /**
   * 初始化WebRTC连接
   */
  public initializeConnection(): void {
    try {
      if (this.pc) {
        console.warn('PeerConnection already exists, closing it first');
        this.pc.close();
      }
      
      this.pc = new RTCPeerConnection(this.configuration);
      
      // 设置事件处理程序
      this.setupEventHandlers();
      
      this.connectionStatus$.next('Initialized');
      console.log('WebRTC connection initialized');
    } catch (error) {
      console.error('Error initializing WebRTC connection:', error);
      this.connectionStatus$.next('Initialization Error');
    }
  }
  
  /**
   * 设置WebRTC事件处理程序
   */
  private setupEventHandlers(): void {
    if (!this.pc) return;
    
    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.targetUserId) {
        // 发送ICE候选到远程对等方（通过信令服务器）
        try {
          this.signalingService.sendIceCandidate(this.targetUserId, event.candidate);
          console.log('New ICE candidate sent:', event.candidate);
        } catch (error) {
          console.error('Failed to send ICE candidate:', error);
        }
      }
    };
    
    this.pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.remoteStream$.next(this.remoteStream);
      console.log('Remote stream received with tracks:', event.streams[0].getTracks());
    };
    
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState || 'unknown';
      this.connectionStatus$.next(state);
      console.log('Connection state change:', state);
    };
    
    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState || 'unknown';
      console.log('ICE connection state change:', state);
    };
    
    this.pc.onnegotiationneeded = async () => {
      console.log('Negotiation needed');
      if (this.targetUserId) {
        try {
          await this.createOffer();
        } catch (error) {
          console.error('Error during negotiation:', error);
        }
      }
    };
  }
  
  /**
   * 处理收到的offer
   */
  private async handleOffer(from: string, offer: RTCSessionDescriptionInit): Promise<void> {
    console.log('Handling offer from:', from);
    this.targetUserId = from;
    
    if (!this.pc) {
      this.initializeConnection();
    }
    
    try {
      if (!this.pc) {
        throw new Error('PeerConnection not initialized');
      }
      
      await this.pc.setRemoteDescription(offer);
      console.log('Remote description set');
      
      const answer = await this.pc.createAnswer();
      console.log('Answer created');
      
      await this.pc.setLocalDescription(answer);
      console.log('Local description set');
      
      // 发送answer到远程对等方
      try {
        this.signalingService.sendAnswer(from, answer);
      } catch (error) {
        console.error('Failed to send answer:', error);
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }
  
  /**
   * 处理收到的answer
   */
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    console.log('Handling answer');
    
    if (!this.pc) {
      throw new Error('PeerConnection not initialized');
    }
    
    try {
      await this.pc.setRemoteDescription(answer);
      console.log('Remote answer set');
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }
  
  /**
   * 处理收到的ICE候选
   */
  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    console.log('Handling ICE candidate');
    
    if (!this.pc) {
      throw new Error('PeerConnection not initialized');
    }
    
    try {
      await this.pc.addIceCandidate(candidate);
      console.log('ICE candidate added');
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }
  
  /**
   * 创建并发送offer
   */
  public async createOffer(): Promise<void> {
    if (!this.pc) {
      throw new Error('PeerConnection not initialized');
    }
    
    if (!this.targetUserId) {
      throw new Error('Target user not specified');
    }
    
    try {
      console.log('Creating offer');
      const offer = await this.pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false
      });
      
      console.log('Setting local description');
      await this.pc.setLocalDescription(offer);
      
      // 发送offer到远程对等方（通过信令服务器）
      try {
        this.signalingService.sendOffer(this.targetUserId, offer);
        console.log('Offer created and sent:', offer);
      } catch (error) {
        console.error('Failed to send offer:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }
  
  /**
   * 开始屏幕共享
   */
  public async startScreenShare(): Promise<void> {
    console.log('Starting screen share');
    
    try {
      // 检查是否已初始化PeerConnection
      if (!this.pc) {
        console.log('Initializing connection for screen share');
        this.initializeConnection();
      }
      
      // 获取屏幕共享流
      console.log('Requesting display media');
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: {
          cursor: 'always'
        },
        audio: false
      });
      
      console.log('Display media stream acquired');
      this.localStream = stream;
      
      // 添加轨道到PeerConnection
      const tracks = stream.getTracks();
      console.log('Adding tracks to peer connection:', tracks);
      
      tracks.forEach((track: MediaStreamTrack) => {
        if (this.pc && this.localStream) {
          console.log('Adding track:', track.kind);
          this.pc.addTrack(track, this.localStream);
        }
      });
      
      // 如果我们是发起屏幕共享的一方，需要创建offer
      if (this.targetUserId) {
        console.log('Creating offer for screen share');
        await this.createOffer();
      }
      
      // 监听屏幕共享结束事件
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.log('Screen share ended by user');
          this.stopScreenShare();
        };
      }
      
      console.log('Screen sharing started successfully');
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error; // 重新抛出错误以便调用者处理
    }
  }
  
  /**
   * 停止屏幕共享
   */
  public stopScreenShare(): void {
    console.log('Stopping screen share');
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind);
        track.stop();
        // 从PeerConnection中移除轨道
        if (this.pc) {
          try {
            const sender = this.pc.getSenders().find(s => s.track === track);
            if (sender) {
              console.log('Removing track sender');
              this.pc.removeTrack(sender);
            }
          } catch (e) {
            console.warn('Error removing track from peer connection:', e);
          }
        }
      });
      this.localStream = null;
    }
    console.log('Screen sharing stopped');
  }
  
  /**
   * 关闭连接
   */
  public closeConnection(): void {
    console.log('Closing connection');
    
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    this.targetUserId = null;
    this.connectionStatus$.next('Disconnected');
    console.log('Connection closed');
  }
}