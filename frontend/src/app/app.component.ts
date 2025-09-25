import { Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { WebRtcService } from './webrtc.service';
import { SignalingService } from './signaling.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  template: `
    <div class="container">
      <h1>Web Remote Desktop</h1>
      <div class="user-info">
        Your User ID: <strong>{{ userId }}</strong>
      </div>
      
      <div class="connection-panel">
        <div class="connect-controls" *ngIf="!isConnected">
          <input 
            type="text" 
            [(ngModel)]="remoteUserId" 
            placeholder="Enter remote user ID" 
            class="user-id-input">
          <button (click)="connect()" [disabled]="!remoteUserId.trim() || isConnecting"> 
            {{ isConnecting ? 'Connecting...' : 'Connect' }}
          </button>
        </div>
        
        <div class="disconnect-controls" *ngIf="isConnected">
          <span>Connected to: <strong>{{ remoteUserId }}</strong></span>
          <button (click)="disconnect()">Disconnect</button>
        </div>
        
        <div class="error-message" *ngIf="errorMessage">
          Error: {{ errorMessage }}
        </div>
        
        <div class="server-status" *ngIf="serverStatus">
          Server Status: {{ serverStatus }}
        </div>
        
        <span class="status">{{ connectionStatus }}</span>
      </div>
      
      <div class="video-container" *ngIf="isConnected">
        <video #remoteVideo autoplay playsinline></video>
      </div>
      
      <div class="controls" *ngIf="isConnected">
        <button (click)="toggleScreenShare()" *ngIf="!isSharingScreen" [disabled]="isConnectingScreenShare">
          {{ isConnectingScreenShare ? 'Starting Share...' : 'Start Screen Share' }}
        </button>
        <button (click)="toggleScreenShare()" *ngIf="isSharingScreen">
          Stop Screen Share
        </button>
      </div>
    </div>
  `,
  styles: [`
    .container {
      text-align: center;
      padding: 20px;
    }
    
    .user-info {
      margin: 10px 0;
      padding: 10px;
      background-color: #f0f0f0;
      border-radius: 4px;
    }
    
    .connection-panel {
      margin: 20px 0;
    }
    
    .connect-controls, .disconnect-controls {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    .user-id-input {
      padding: 10px;
      font-size: 16px;
      border: 1px solid #ccc;
      border-radius: 4px;
      width: 250px;
    }
    
    button {
      padding: 10px 20px;
      font-size: 16px;
      border: none;
      border-radius: 4px;
      background-color: #007bff;
      color: white;
      cursor: pointer;
    }
    
    button:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }
    
    button:hover:not(:disabled) {
      background-color: #0056b3;
    }
    
    .status, .server-status {
      display: block;
      margin-top: 10px;
      font-weight: bold;
    }
    
    .server-status {
      color: #666;
    }
    
    .error-message {
      color: red;
      margin: 10px 0;
      padding: 10px;
      background-color: #ffe6e6;
      border-radius: 4px;
    }
    
    .video-container {
      margin: 20px auto;
      max-width: 1200px;
    }
    
    video {
      width: 100%;
      max-height: 70vh;
      background-color: #000;
    }
    
    .controls {
      margin: 20px 0;
    }
  `]
})
export class AppComponent implements OnInit {
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;
  
  isConnected = false;
  isConnecting = false;
  isSharingScreen = false;
  isConnectingScreenShare = false;
  connectionStatus = 'Disconnected';
  userId = '';
  remoteUserId = '';
  errorMessage = '';
  serverStatus = '';
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    private webRtcService: WebRtcService,
    private signalingService: SignalingService
  ) {}
  
  ngOnInit(): void {
    // 获取用户ID
    this.userId = this.signalingService.getUserId();
    
    // 订阅WebRTC服务事件
    this.subscriptions.push(
      this.webRtcService.connectionStatus$.subscribe(status => {
        this.connectionStatus = status;
      })
    );
    
    this.subscriptions.push(
      this.webRtcService.remoteStream$.subscribe(stream => {
        if (this.remoteVideo) {
          this.remoteVideo.nativeElement.srcObject = stream;
        }
      })
    );
  }
  
  async connect(): Promise<void> {
    if (!this.remoteUserId.trim()) {
      return;
    }
    
    this.errorMessage = '';
    this.isConnecting = true;
    this.serverStatus = 'Connecting to server...';
    
    try {
      await this.signalingService.connect();
      this.serverStatus = 'Connected to server';
      this.webRtcService.initializeConnection();
      this.webRtcService.connectToUser(this.remoteUserId);
      this.isConnected = true;
      
      console.log(`Connected to user: ${this.remoteUserId}`);
    } catch (error: any) {
      console.error('Connection failed:', error);
      this.errorMessage = error.message || 'Failed to connect to signaling server. Please make sure the backend server is running.';
      this.serverStatus = 'Connection failed';
    } finally {
      this.isConnecting = false;
    }
  }
  
  disconnect(): void {
    this.signalingService.disconnect();
    this.webRtcService.closeConnection();
    this.isConnected = false;
    this.isSharingScreen = false;
    this.isConnectingScreenShare = false;
    this.errorMessage = '';
    this.serverStatus = 'Disconnected';
    
    if (this.remoteVideo) {
      this.remoteVideo.nativeElement.srcObject = null;
    }
  }
  
  async toggleScreenShare(): Promise<void> {
    this.errorMessage = '';
    
    try {
      if (!this.isSharingScreen) {
        this.isConnectingScreenShare = true;
        await this.webRtcService.startScreenShare();
        this.isSharingScreen = true;
      } else {
        this.webRtcService.stopScreenShare();
        this.isSharingScreen = false;
      }
    } catch (error: any) {
      console.error('Error toggling screen share:', error);
      this.errorMessage = error.message || 'Failed to toggle screen share. Make sure you are using a supported browser and have granted screen sharing permissions.';
      // 重置状态以防出错
      this.isSharingScreen = false;
    } finally {
      this.isConnectingScreenShare = false;
    }
  }
  
  ngOnDestroy(): void {
    // 清理订阅
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // 断开连接
    this.disconnect();
  }
}