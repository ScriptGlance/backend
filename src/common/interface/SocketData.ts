export interface SocketData {
  user?: {
    id: number;
    email: string;
    role: string;
  };
  joinedRooms?: Set<string>;
}
