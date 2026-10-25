import { randomBytes } from 'node:crypto';
import { Body, Controller, Get, HttpCode, HttpException, Post, Req, Res, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import type { Response } from 'express';
import { loginRequestSchema, type SessionResponse } from '@specsentry/shared';
import { DatabaseService } from '../database/database.service';
import { Public, type AuthRequest } from './access';
import { IdentityService } from './identity.service';
import { ABSOLUTE_MS, IDLE_MS, SESSION_COOKIE } from './session.store';

@Controller('auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService, private readonly database: DatabaseService) {}

  @Public()
  @Get('csrf')
  csrf(@Req() request: AuthRequest) {
    request.session.csrfToken ??= randomBytes(32).toString('hex');
    request.session.issuedAt ??= Date.now();
    return { csrfToken: request.session.csrfToken };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Req() request: AuthRequest, @Body() body: unknown, @Res({ passthrough: true }) response: Response): Promise<SessionResponse> {
    const parsed = loginRequestSchema.safeParse(body);
    if (!parsed.success) throw new UnprocessableEntityException();
    const result = await this.identity.authenticate(parsed.data.username, parsed.data.password, request.ip ?? 'unknown', response.getHeader('x-request-id')?.toString());
    if (result.status === 'throttled') {
      response.setHeader('Retry-After', '900');
      throw new HttpException('Authentication unavailable', 429);
    }
    if (result.status !== 'success') throw new UnauthorizedException();
    await new Promise<void>((resolve, reject) => request.session.regenerate((error) => error ? reject(error) : resolve()));
    request.session.userId = result.account.id;
    request.session.accountVersion = result.account.version;
    request.session.issuedAt = Date.now();
    request.session.csrfToken = randomBytes(32).toString('hex');
    await new Promise<void>((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()));
    return { account: { id: result.account.id, username: result.account.username, role: result.account.role }, csrfToken: request.session.csrfToken, expiresAt: Date.now() + IDLE_MS };
  }

  @Get('session')
  session(@Req() request: AuthRequest): SessionResponse {
    return { account: request.account!, csrfToken: request.session.csrfToken!,
      expiresAt: Math.min(Date.now() + IDLE_MS, request.session.issuedAt! + ABSOLUTE_MS) };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response): Promise<void> {
    await new Promise<void>((resolve, reject) => request.session.destroy((error) => error ? reject(error) : resolve()));
    response.clearCookie(SESSION_COOKIE, { path: '/' });
    await this.database.client.securityEvent.create({ data: { actorId: request.account!.id, action: 'LOGOUT', target: 'authentication', outcome: 'success', correlationId: response.getHeader('x-request-id')?.toString() } });
  }
}
