import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import type { SessionUser } from '@sticky-notes/contracts';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto, RegisterDto } from './auth.dto';
import type { SessionPayload } from './auth.types';

export const SESSION_COOKIE = 'sticky_session';
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterDto): Promise<{ user: SessionUser; token: string }> {
    if (!input.email && !input.phone) throw new ConflictException('邮箱或手机号至少填写一项');

    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email || null,
          phone: input.phone || null,
          displayName: input.displayName,
          passwordHash: await bcrypt.hash(input.password, 12),
        },
      });
      return { user: this.toSessionUser(user), token: await this.issueToken(user.id) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('邮箱或手机号已被注册');
      }
      throw error;
    }
  }

  async login(input: LoginDto): Promise<{ user: SessionUser; token: string }> {
    const isEmail = input.identifier.includes('@');
    const user = await this.prisma.user.findFirst({
      where: isEmail ? { email: input.identifier } : { phone: input.identifier },
    });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('账号或密码错误');
    }
    return { user: this.toSessionUser(user), token: await this.issueToken(user.id) };
  }

  async resolveSession(token: string): Promise<SessionUser | null> {
    try {
      const payload = await this.jwtService.verifyAsync<SessionPayload>(token);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      return user ? this.toSessionUser(user) : null;
    } catch {
      return null;
    }
  }

  private issueToken(userId: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId } satisfies SessionPayload);
  }

  private toSessionUser(user: { id: string; email: string | null; phone: string | null; displayName: string }): SessionUser {
    return { id: user.id, email: user.email, phone: user.phone, displayName: user.displayName };
  }
}
