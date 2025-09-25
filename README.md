# Web Remote Desktop Application

基于Angular、Node.js和WebRTC的Web远程桌面应用程序。

## 项目结构

```
web-rdp/
├── frontend/           # Angular前端应用
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.component.ts      # 主组件
│   │   │   ├── webrtc.service.ts     # WebRTC服务
│   │   │   └── signaling.service.ts  # 信令服务
│   │   └── ...
│   └── package.json
│
└── backend/            # Node.js后端服务
    ├── server.js       # 服务器主文件
    └── package.json
```

## 技术栈

- **前端**: Angular 14
- **后端**: Node.js with Express and Socket.IO
- **实时通信**: WebRTC
- **信令传输**: WebSocket

## 功能特性

1. 基于WebRTC的P2P屏幕共享
2. 实时远程桌面查看
3. 信令服务器支持连接建立
4. 用户友好的界面
5. 通过用户ID连接到特定远程用户

## 安装和运行

### 前端设置

```bash
cd frontend
npm install
```

### 后端设置

```bash
cd backend
npm install
```

### 运行应用

1. 启动后端服务器:
```bash
cd backend
npm start
```

2. 构建并提供前端应用:
```bash
cd frontend
ng build
```

或者在开发模式下运行:
```bash
cd frontend
ng serve
```

默认情况下，后端服务器运行在端口3000，前端开发服务器运行在端口4200。

## 使用说明

1. 打开应用后，您将获得一个唯一的用户ID
2. 输入要连接的远程用户的ID
3. 点击"Connect"建立连接
4. 连接成功后，可以点击"Start Screen Share"开始共享屏幕

## WebRTC连接流程

1. 用户A获取自己的用户ID并输入用户B的ID
2. 用户A发送连接请求到用户B
3. 用户B收到连接请求（在实际应用中可能需要确认）
4. 用户A创建offer并发送给信令服务器
5. 信令服务器将offer转发给用户B
6. 用户B创建answer并发送给信令服务器
7. 信令服务器将answer转发给用户A
8. 双方交换ICE候选以建立P2P连接
9. 连接建立后开始传输媒体流

## 故障排除

### 服务器启动问题

如果后端服务器无法启动，请检查以下几点：

1. **端口占用**：确保端口3000未被其他应用占用
   ```bash
   # 检查端口占用情况
   netstat -an | grep 3000  # Linux/Mac
   netstat -an | findstr 3000  # Windows
   ```

2. **依赖安装**：确保所有依赖已正确安装
   ```bash
   cd backend
   npm install
   ```

3. **Node.js版本**：确保使用兼容的Node.js版本（推荐14+）

### WebSocket连接问题

如果遇到"WebSocket connection failed"错误，请检查以下几点：

1. **后端服务器运行状态**：确保Node.js信令服务器正在运行
   ```bash
   cd backend
   npm start
   ```
   应该看到输出：
   ```
   Server is running on port 3000
   WebSocket server available at ws://localhost:3000/ws
   Socket.IO server available at http://localhost:3000
   ```

2. **服务器端口**：确保前端尝试连接的端口（默认3000）与后端服务器监听的端口一致

3. **WebSocket端点**：确保前端连接的是正确的WebSocket端点（`/ws`）

4. **网络连接**：检查前端和后端是否在同一网络中，且没有防火墙阻止连接

5. **URL配置**：检查前端WebSocket连接URL是否正确（默认为ws://localhost:3000/ws）

6. **跨域问题**：确保后端正确配置了CORS策略

7. **浏览器安全限制**：如果通过非localhost访问，可能需要HTTPS

### 屏幕共享问题

如果无法共享桌面，请检查以下几点：

1. **浏览器支持**：确保使用支持getDisplayMedia API的现代浏览器（Chrome 72+、Firefox 66+、Safari 13+、Edge 79+）

2. **HTTPS要求**：除localhost外，屏幕共享功能需要在HTTPS环境下运行

3. **权限问题**：确保浏览器允许屏幕共享权限，通常会在点击"Start Screen Share"后弹出权限请求

4. **用户交互**：屏幕共享必须由用户手势触发（点击按钮等）

5. **防火墙/网络**：确保STUN服务器可访问，必要时配置TURN服务器

6. **控制台日志**：打开浏览器开发者工具查看详细错误信息

### 连接问题

1. **信令服务器**：确保后端信令服务器正在运行且可访问

2. **用户ID**：确保输入了正确的远程用户ID

3. **网络连接**：检查网络连接是否正常

### 其他问题

1. **编译错误**：确保所有依赖已正确安装

2. **运行时错误**：查看浏览器控制台获取详细错误信息

## 安全考虑

- 使用STUN服务器进行NAT穿透
- 可扩展支持TURN服务器以应对复杂网络环境
- 所有信令传输通过WebSocket进行

## 浏览器兼容性

- Chrome 70+
- Firefox 60+
- Safari 12+
- Edge 79+

注意: 屏幕共享功能需要HTTPS环境（localhost除外）。