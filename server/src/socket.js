// ═══════════════════════════════════════
// Prospector Chevla — WebSocket Server
// Real-time: notifications, data sync, presence
// ═══════════════════════════════════════
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config.js';

let io = null;

// Track online users: userId → { socketId, user, currentPage }
const onlineUsers = new Map();

export function initWebSocket(httpServer) {
  // Import allowed origins from index.js or fallback
  let origins;
  try {
    // Dynamic import not needed — read env directly (same logic as index.js)
    origins = [
      'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000',
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : []),
    ].filter(Boolean);
  } catch {
    origins = ['http://localhost:5173'];
  }

  io = new SocketServer(httpServer, {
    cors: {
      origin: origins,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Auth middleware — verify JWT on connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token não fornecido'));

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`🔌 WS conectado: ${user.name} (ID ${user.id})`);

    // Register online user
    onlineUsers.set(user.id, {
      socketId: socket.id,
      user: { id: user.id, name: user.name, role: user.role },
      currentPage: '/',
      connectedAt: new Date().toISOString(),
    });

    // Broadcast updated presence list
    broadcastPresence();

    // ── Client events ──

    // User navigates to a page
    socket.on('page:change', (page) => {
      const entry = onlineUsers.get(user.id);
      if (entry) {
        entry.currentPage = page;
        broadcastPresence();
      }
    });

    // User starts editing an entity
    socket.on('editing:start', (data) => {
      // data = { entity: 'client', id: 123 }
      socket.broadcast.emit('editing:active', {
        ...data,
        user: { id: user.id, name: user.name },
      });
    });

    // User stops editing
    socket.on('editing:stop', (data) => {
      socket.broadcast.emit('editing:inactive', {
        ...data,
        user: { id: user.id, name: user.name },
      });
    });

    // Disconnect
    socket.on('disconnect', (reason) => {
      console.log(`🔌 WS desconectado: ${user.name} (${reason})`);
      onlineUsers.delete(user.id);
      broadcastPresence();

      // Notify others that this user stopped editing everything
      socket.broadcast.emit('editing:inactive', {
        entity: '*',
        id: '*',
        user: { id: user.id, name: user.name },
      });
    });
  });

  console.log('🔌 WebSocket inicializado');
  return io;
}

function broadcastPresence() {
  if (!io) return;
  const users = Array.from(onlineUsers.values()).map(u => ({
    ...u.user,
    currentPage: u.currentPage,
    connectedAt: u.connectedAt,
  }));
  io.emit('presence:update', users);
}

// ── Public API for server routes to emit events ──

export function emitDataChange(entityType, action, data, userId) {
  if (!io) return;
  io.emit('data:changed', {
    entity: entityType,
    action,         // 'created' | 'updated' | 'deleted'
    data,
    userId,
    timestamp: new Date().toISOString(),
  });
}

export function emitNotification(notification) {
  if (!io) return;
  io.emit('notification:new', notification);
}

export function getOnlineUsers() {
  return Array.from(onlineUsers.values()).map(u => ({
    ...u.user,
    currentPage: u.currentPage,
    connectedAt: u.connectedAt,
  }));
}

export function getIO() {
  return io;
}
