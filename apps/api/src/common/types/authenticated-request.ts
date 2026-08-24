import type { Request } from 'express';

export interface RequestUser {
  id: string;
  username: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  zoneIds: string[];
  isSuperScope: boolean;
  mustChangePassword: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}
