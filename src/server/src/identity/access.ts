import { SetMetadata } from '@nestjs/common';
import type { AccountRole, Account } from '@specsentry/shared';
import type { Request } from 'express';

export const PUBLIC = 'identity:public';
export const ROLES = 'identity:roles';
export const Public = () => SetMetadata(PUBLIC, true);
export const Roles = (...roles: AccountRole[]) => SetMetadata(ROLES, roles);
export type AuthRequest = Request & { account?: Account };

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
    userId?: string;
    accountVersion?: number;
    issuedAt?: number;
  }
}
