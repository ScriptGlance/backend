import { Role } from '../common/enum/Role';

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
    }
  }
}
