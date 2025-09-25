const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 使用cors中间件
app.use(cors());

// 静态文件服务
app.use(express.static('../frontend/dist'));

// 存储连接的客户端
const connectedClients = new Map();
const wsClients = new Map();

// Socket.IO连接处理
io.on('connection', (socket) => {
  console.log('Socket.IO User connected:', socket.id);
  
  // 处理查询参数中的userId
  const userId = socket.handshake.query.userId;
  if (userId) {
    console.log(`User with ID ${userId} connected with socket ID ${socket.id}`);
    connectedClients.set(socket.id, { userId, socket });
  }
  
  // 用户加入
  socket.on('join', (data) => {
    const { userId, userType } = data;
    connectedClients.set(socket.id, { userId, userType, socket });
    console.log(`User ${userId} joined as ${userType}`);
    
    // 通知其他用户有新用户加入
    socket.broadcast.emit('user-joined', { userId, userType });
  });
  
  // 连接请求
  socket.on('connection-request', (data) => {
    console.log('Connection request from:', data.from, 'to:', data.to);
    // 转发连接请求给目标用户
    const targetSocket = Array.from(connectedClients.values())
      .find(client => client.userId === data.to);
    
    if (targetSocket) {
      targetSocket.socket.emit('connection-request', {
        from: data.from
      });
      console.log('Connection request forwarded to:', data.to);
    } else {
      console.log('Target user not found:', data.to);
    }
  });
  
  // WebRTC信令 - offer
  socket.on('offer', (data) => {
    console.log('Offer received from:', data.from, 'to:', data.to);
    // 转发offer给目标用户
    const targetSocket = Array.from(connectedClients.values())
      .find(client => client.userId === data.to);
    
    if (targetSocket) {
      targetSocket.socket.emit('offer', {
        from: data.from,
        offer: data.offer
      });
      console.log('Offer forwarded to:', data.to);
    } else {
      console.log('Target user not found:', data.to);
    }
  });
  
  // WebRTC信令 - answer
  socket.on('answer', (data) => {
    console.log('Answer received from:', data.from, 'to:', data.to);
    // 转发answer给目标用户
    const targetSocket = Array.from(connectedClients.values())
      .find(client => client.userId === data.to);
    
    if (targetSocket) {
      targetSocket.socket.emit('answer', {
        from: data.from,
        answer: data.answer
      });
      console.log('Answer forwarded to:', data.to);
    } else {
      console.log('Target user not found:', data.to);
    }
  });
  
  // WebRTC信令 - ICE候选
  socket.on('ice-candidate', (data) => {
    console.log('ICE candidate from:', data.from, 'to:', data.to);
    // 转发ICE候选给目标用户
    const targetSocket = Array.from(connectedClients.values())
      .find(client => client.userId === data.to);
    
    if (targetSocket) {
      targetSocket.socket.emit('ice-candidate', {
        from: data.from,
        candidate: data.candidate
      });
      console.log('ICE candidate forwarded to:', data.to);
    } else {
      console.log('Target user not found:', data.to);
    }
  });
  
  // 用户断开连接
  socket.on('disconnect', () => {
    const client = connectedClients.get(socket.id);
    if (client) {
      console.log('User disconnected:', client.userId);
      connectedClients.delete(socket.id);
      
      // 通知其他用户该用户已离开
      socket.broadcast.emit('user-left', { userId: client.userId });
    } else {
      console.log('Unknown user disconnected:', socket.id);
    }
  });
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server, path: '/ws' });

// WebSocket连接处理
wss.on('connection', (ws, req) => {
  // 从URL参数中提取userId
  const urlParams = new URLSearchParams(req.url.split('?')[1]);
  const userId = urlParams.get('userId');
  
  if (!userId) {
    console.log('WebSocket connection rejected: missing userId');
    ws.close(1008, 'Missing userId parameter');
    return;
  }
  
  console.log(`WebSocket User ${userId} connected`);
  wsClients.set(userId, ws);
  
  // 发送连接确认消息
  ws.send(JSON.stringify({
    type: 'connection-confirmed',
    userId: userId
  }));
  
  // 处理收到的消息
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleWebSocketMessage(ws, data, userId);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });
  
  // 处理连接关闭
  ws.on('close', () => {
    console.log(`WebSocket User ${userId} disconnected`);
    wsClients.delete(userId);
  });
  
  // 处理错误
  ws.on('error', (error) => {
    console.error(`WebSocket error for user ${userId}:`, error);
    wsClients.delete(userId);
  });
});

// 处理WebSocket消息
function handleWebSocketMessage(ws, data, fromUserId) {
  console.log('WebSocket message received from:', fromUserId, 'type:', data.type);
  
  switch (data.type) {
    case 'connection-request':
      console.log('Connection request from:', fromUserId, 'to:', data.to);
      // 转发连接请求给目标用户
      const targetWs = wsClients.get(data.to);
      if (targetWs && targetWs.readyState === ws.OPEN) {
        targetWs.send(JSON.stringify({
          type: 'connection-request',
          from: fromUserId
        }));
        console.log('Connection request forwarded to:', data.to);
      } else {
        console.log('Target user not found or not connected:', data.to);
      }
      break;
      
    case 'offer':
      console.log('Offer from:', fromUserId, 'to:', data.to);
      // 转发offer给目标用户
      const targetWsOffer = wsClients.get(data.to);
      if (targetWsOffer && targetWsOffer.readyState === ws.OPEN) {
        targetWsOffer.send(JSON.stringify({
          type: 'offer',
          from: fromUserId,
          offer: data.offer
        }));
        console.log('Offer forwarded to:', data.to);
      } else {
        console.log('Target user not found or not connected:', data.to);
      }
      break;
      
    case 'answer':
      console.log('Answer from:', fromUserId, 'to:', data.to);
      // 转发answer给目标用户
      const targetWsAnswer = wsClients.get(data.to);
      if (targetWsAnswer && targetWsAnswer.readyState === ws.OPEN) {
        targetWsAnswer.send(JSON.stringify({
          type: 'answer',
          from: fromUserId,
          answer: data.answer
        }));
        console.log('Answer forwarded to:', data.to);
      } else {
        console.log('Target user not found or not connected:', data.to);
      }
      break;
      
    case 'ice-candidate':
      console.log('ICE candidate from:', fromUserId, 'to:', data.to);
      // 转发ICE候选给目标用户
      const targetWsIce = wsClients.get(data.to);
      if (targetWsIce && targetWsIce.readyState === ws.OPEN) {
        targetWsIce.send(JSON.stringify({
          type: 'ice-candidate',
          from: fromUserId,
          candidate: data.candidate
        }));
        console.log('ICE candidate forwarded to:', data.to);
      } else {
        console.log('Target user not found or not connected:', data.to);
      }
      break;
      
    default:
      console.log('Unknown message type:', data.type);
  }
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
  console.log(`Socket.IO server available at http://localhost:${PORT}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
});

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});