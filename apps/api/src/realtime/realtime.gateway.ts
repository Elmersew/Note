import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { ChangeDto } from '@sticky-notes/contracts';
import { Server, Socket } from 'socket.io';
import { SESSION_COOKIE } from '../auth/auth.service';
import type { SessionPayload } from '../auth/auth.types';

@WebSocketGateway({
  cors: {
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.readCookie(client.handshake.headers.cookie, SESSION_COOKIE);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<SessionPayload>(token);
      client.data.userId = payload.sub;
      await client.join(this.room(payload.sub));
    } catch {
      this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
      client.disconnect(true);
    }
  }

  emitChange(userId: string, change: ChangeDto): void {
    this.server?.to(this.room(userId)).emit('change', change);
  }

  private room(userId: string): string {
    return `user:${userId}`;
  }

  private readCookie(header: string | undefined, name: string): string | undefined {
    if (!header) return undefined;
    for (const item of header.split(';')) {
      const [key, ...value] = item.trim().split('=');
      if (key === name) return decodeURIComponent(value.join('='));
    }
    return undefined;
  }
}
