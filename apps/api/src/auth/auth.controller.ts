import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { SessionUser } from '@sticky-notes/contracts';
import type { CookieOptions, Response } from 'express';
import type { AppEnvironment } from '../config/environment';
import { AuthGuard } from './auth.guard';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService, SESSION_COOKIE, SESSION_MAX_AGE_MS } from './auth.service';
import { CurrentUser } from './current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<AppEnvironment, true>,
  ) {}

  @Post('register')
  async register(@Body() input: RegisterDto, @Res({ passthrough: true }) response: Response): Promise<{ user: SessionUser }> {
    const result = await this.authService.register(input);
    response.cookie(SESSION_COOKIE, result.token, this.cookieOptions());
    return { user: result.user };
  }

  @HttpCode(200)
  @Post('login')
  async login(@Body() input: LoginDto, @Res({ passthrough: true }) response: Response): Promise<{ user: SessionUser }> {
    const result = await this.authService.login(input);
    response.cookie(SESSION_COOKIE, result.token, this.cookieOptions());
    return { user: result.user };
  }

  @HttpCode(204)
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  me(@CurrentUser() user: SessionUser): { user: SessionUser } {
    return { user };
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_MS,
    };
  }
}
