// ═══════════════════════════════════════
// Prospector Chevla — WebSocket Context
// Real-time: data sync, notifications, presence
// ═══════════════════════════════════════
import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface OnlineUser {
  id: number;
  name: string;
  role: string;
  currentPage: string;
  connectedAt: string;
}

interface DataChangeEvent {
  entity: string;        // 'client' | 'contract' | 'task' | 'payment' | 'calendar_event'
  action: string;        // 'created' | 'updated' | 'deleted'
  data: Record<string, unknown>;
  userId: number;
  timestamp: string;
}

interface EditingInfo {
  entity: string;
  id: string | number;
  user: { id: number; name: string };
}

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  onlineUsers: OnlineUser[];
  editingUsers: EditingInfo[];
  subscribe: (event: string, callback: (...args: unknown[]) => void) => () => void;
  emitPageChange: (page: string) => void;
  emitEditingStart: (entity: string, id: number | string) => void;
  emitEditingStop: (entity: string, id: number | string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const WS_URL = window.location.hostname === 'localhost'
  ? `http://localhost:3001`
  : window.location.origin;

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [editingUsers, setEditingUsers] = useState<EditingInfo[]>([]);

  useEffect(() => {
    if (!token || !user) {
      // Disconnect if logged out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
        setOnlineUsers([]);
        setEditingUsers([]);
      }
      return;
    }

    // Connect
    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      // Prevent aggressive reconnection spam when alt-tabbing
      timeout: 60000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 WebSocket conectado');
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket desconectado:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('🔌 WebSocket erro:', err.message);
    });

    // Presence updates
    socket.on('presence:update', (users: OnlineUser[]) => {
      setOnlineUsers(users);
    });

    // Editing awareness
    socket.on('editing:active', (info: EditingInfo) => {
      setEditingUsers(prev => {
        const filtered = prev.filter(e => !(e.entity === info.entity && e.id === info.id && e.user.id === info.user.id));
        return [...filtered, info];
      });
    });

    socket.on('editing:inactive', (info: EditingInfo) => {
      if (info.entity === '*') {
        // User disconnected — remove all their editing entries
        setEditingUsers(prev => prev.filter(e => e.user.id !== info.user.id));
      } else {
        setEditingUsers(prev => prev.filter(e => !(e.entity === info.entity && e.id === info.id && e.user.id === info.user.id)));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, user]);

  const subscribe = useCallback((event: string, callback: (...args: unknown[]) => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};

    socket.on(event, callback);
    return () => { socket.off(event, callback); };
  }, []);

  const emitPageChange = useCallback((page: string) => {
    socketRef.current?.emit('page:change', page);
  }, []);

  const emitEditingStart = useCallback((entity: string, id: number | string) => {
    socketRef.current?.emit('editing:start', { entity, id });
  }, []);

  const emitEditingStop = useCallback((entity: string, id: number | string) => {
    socketRef.current?.emit('editing:stop', { entity, id });
  }, []);

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connected,
      onlineUsers,
      editingUsers,
      subscribe,
      emitPageChange,
      emitEditingStart,
      emitEditingStop,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket deve ser usado dentro de SocketProvider');
  return context;
}

// Hook: Subscribe to data changes and auto-refresh
export function useRealtimeRefresh(entityTypes: string[], refreshFn: () => void) {
  const { subscribe } = useSocket();
  const entityTypesRef = useRef(entityTypes);
  entityTypesRef.current = entityTypes;

  useEffect(() => {
    const unsub = subscribe('data:changed', (...args: unknown[]) => {
      const event = args[0] as DataChangeEvent;
      if (entityTypesRef.current.includes(event.entity)) {
        refreshFn();
      }
    });
    return unsub;
  }, [subscribe, refreshFn]);
}
