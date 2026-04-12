import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@chat-app/shared';
import { useAuth } from './AuthContext';

type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SocketContext = createContext<ChatSocket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<ChatSocket | null>(null);

  useEffect(() => {
    if (!user) {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      return;
    }

    const s: ChatSocket = io('/', { withCredentials: true });
    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
