import { timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AccountRole } from '@specsentry/shared';
import { DatabaseService } from '../database/database.service';
import { PUBLIC, ROLES, type AuthRequest } from './access';
import { ABSOLUTE_MS } from './session.store';

@Injectable()
export class IdentityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC, targets);
    if (!isPublic) {
      const account = request.session?.userId
        ? await this.database.client.userAccount.findUnique({ where: { id: request.session.userId } }) : null;
      if (!account?.enabled || account.version !== request.session.accountVersion ||
          !request.session.issuedAt || Date.now() - request.session.issuedAt >= ABSOLUTE_MS) {
        if (request.session) await new Promise<void>((resolve, reject) => request.session.destroy((error) => error ? reject(error) : resolve()));
        await this.audit(request, 'SESSION_REJECTED');
        throw new UnauthorizedException();
      }
      request.account = { id: account.id, username: account.username, role: account.role };
      const roles = this.reflector.getAllAndOverride<AccountRole[]>(ROLES, targets);
      if (roles && !roles.includes(account.role)) {
        await this.audit(request, 'ROLE_REJECTED');
        throw new ForbiddenException();
      }
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const expected = request.session?.csrfToken;
      const supplied = request.get('x-csrf-token');
      if (!expected || !supplied || !/^[a-f0-9]{64}$/.test(supplied) ||
          !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
        await this.audit(request, 'CSRF_REJECTED');
        throw new ForbiddenException();
      }
    }
    return true;
  }

  private async audit(request: AuthRequest, action: string): Promise<void> {
    await this.database.client.securityEvent.create({ data: {
      actorId: request.account?.id, action, target: 'authentication', outcome: 'rejected',
      correlationId: request.res?.getHeader('x-request-id')?.toString(),
    } });
  }
}
