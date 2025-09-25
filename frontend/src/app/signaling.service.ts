import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
}
)
export class SignalingService {
  private socket: WebSocket | null = null;
  private userId: string;
  private connectionAttempts = 0;
  private maxRetries = 5;
  private retryDelay = 1000; // 1秒
  private connectionPromise: Promise<void> | null = null;
  
  // 用于通知组件的事件
  public offerReceived$ = new Subject<{from: string, offer: RTCSessionDescriptionInit}>();
  public answerReceived$ = new Subject<{from: string, answer: RTCSessionDescriptionInit}>();
  public iceCandidateReceived$ = new Subject<{from: string, candidate: RTCIceCandidateInit}>();
  public connectionRequested$ = new Subject<string>(); // 新增：连接请求事件
  
  constructor() {
    // 生成随机用户ID
    this.userId = this.generateUserId();
  }
  
  /**
   * 连接到信令服务器
   */
  public connect(): Promise<void> {
    // 如果已经有一个连接正在进行，返回该Promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    // 创建新的连接Promise
    this.connectionPromise = new Promise((resolve, reject) => {
      // 如果已经连接，直接返回
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        resolve();
        return;
      }
      
      // 如果正在连接中，等待连接完成
      if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
        console.log('WebSocket connection in progress');
        const onOpen = () => {
          if (this.socket) {
            this.socket.removeEventListener('open', onOpen);
            console.log('WebSocket connected after waiting');
            resolve();
          }
        };
        if (this.socket) {
          this.socket.addEventListener('open', onOpen);
        }
        return;
      }
      
      try {
        // 连接到WebSocket服务器 (使用新的/ws端点)
        const wsUrl = `wss://web-rdp.cnss.eu.org/ws?userId=${this.userId}`;
        console.log(`Connecting to WebSocket server: ${wsUrl}`);
        this.socket = new WebSocket(wsUrl);
        
        const onOpen = (event: Event) => {
          if (this.socket) {
            this.socket.removeEventListener('open', onOpen);
            console.log('Connected to signaling server');
            this.connectionAttempts = 0; // 重置重试次数
            resolve();
          }
        };
        
        const onError = (error: Event) => {
          if (this.socket) {
            this.socket.removeEventListener('error', onError);
            console.error('Signaling server error:', error);
            reject(new Error('Failed to connect to signaling server'));
          }
        };
        
        const onClose = (event: CloseEvent) => {
          if (this.socket) {
            this.socket.removeEventListener('close', onClose);
            console.log('Disconnected from signaling server', event);
            // 实现重连机制
            this.handleDisconnect();
            reject(new Error('Connection to signaling server closed'));
          }
        };
        
        if (this.socket) {
          this.socket.addEventListener('open', onOpen);
          this.socket.addEventListener('error', onError);
          this.socket.addEventListener('close', onClose);
          
          this.socket.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              this.handleMessage(data);
            } catch (e) {
              console.error('Error parsing message:', e);
            }
          };
        }
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
    
    // 清除Promise引用，以便可以重新连接
    this.connectionPromise.finally(() => {
      this.connectionPromise = null;
    });
    
    return this.connectionPromise;
  }
  
  /**
   * 处理断开连接并尝试重连
   */
  private handleDisconnect(): void {
    console.log('Handling disconnect');
    if (this.connectionAttempts < this.maxRetries) {
      this.connectionAttempts++;
      console.log(`Attempting to reconnect (${this.connectionAttempts}/${this.maxRetries}) in ${this.retryDelay * this.connectionAttempts}ms`);
      
      setTimeout(() => {
        this.connectionPromise = null; // 清除连接Promise以允许重新连接
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, this.retryDelay * this.connectionAttempts); // 指数退避
    } else {
      console.log('Max reconnection attempts reached');
    }
  }
  
  /**
   * 断开与信令服务器的连接
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connectionPromise = null;
    this.connectionAttempts = 0;
  }
  
  /**
   * 发送连接请求到特定用户
   */
  public sendConnectionRequest(to: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected. Current state:', this.socket ? this.socket.readyState : 'null');
      throw new Error('WebSocket is not connected. Please check if the signaling server is running.');
    }
    
    const message = {
      type: 'connection-request',
      to: to,
      from: this.userId
    };
    
    this.socket.send(JSON.stringify(message));
    console.log('Connection request sent:', message);
  }
  
  /**
   * 发送offer到信令服务器
   */
  public sendOffer(to: string, offer: RTCSessionDescriptionInit): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected. Current state:', this.socket ? this.socket.readyState : 'null');
      throw new Error('WebSocket is not connected. Please check if the signaling server is running.');
    }
    
    const message = {
      type: 'offer',
      to: to,
      from: this.userId,
      offer: offer
    };
    
    this.socket.send(JSON.stringify(message));
    console.log('Offer sent:', message);
  }
  
  /**
   * 发送answer到信令服务器
   */
  public sendAnswer(to: string, answer: RTCSessionDescriptionInit): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected. Current state:', this.socket ? this.socket.readyState : 'null');
      throw new Error('WebSocket is not connected. Please check if the signaling server is running.');
    }
    
    const message = {
      type: 'answer',
      to: to,
      from: this.userId,
      answer: answer
    };
    
    this.socket.send(JSON.stringify(message));
    console.log('Answer sent:', message);
  }
  
  /**
   * 发送ICE候选到信令服务器
   */
  public sendIceCandidate(to: string, candidate: RTCIceCandidateInit): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected. Current state:', this.socket ? this.socket.readyState : 'null');
      throw new Error('WebSocket is not connected. Please check if the signaling server is running.');
    }
    
    const message = {
      type: 'ice-candidate',
      to: to,
      from: this.userId,
      candidate: candidate
    };
    
    this.socket.send(JSON.stringify(message));
    console.log('ICE candidate sent:', message);
  }
  
  /**
   * 处理从信令服务器收到的消息
   */
  private handleMessage(data: any): void {
    console.log('Received message:', data);
    switch (data.type) {
      case 'connection-confirmed':
        console.log(`Connection confirmed for user: ${data.userId}`);
        break;
        
      case 'connection-request':
        console.log(`Connection request from: ${data.from}`);
        this.connectionRequested$.next(data.from);
        // 在实际应用中，这里可能需要用户确认是否接受连接请求
        break;
        
      case 'offer':
        console.log('Offer received from:', data.from);
        this.offerReceived$.next({from: data.from, offer: data.offer});
        break;
        
      case 'answer':
        console.log('Answer received from:', data.from);
        this.answerReceived$.next({from: data.from, answer: data.answer});
        break;
        
      case 'ice-candidate':
        console.log('ICE candidate received from:', data.from);
        this.iceCandidateReceived$.next({from: data.from, candidate: data.candidate});
        break;
        
      default:
        console.warn('Unknown message type:', data.type);
    }
  }
  
  /**
   * 生成随机用户ID
   */
  private generateUserId(): string {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }
  
  /**
   * 获取当前用户ID
   */
  public getUserId(): string {
    return this.userId;
  }
  
  /**
   * 检查WebSocket连接状态
   */
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}