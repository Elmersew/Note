import type { SessionUser } from '@sticky-notes/contracts';
import type { Request } from 'express';

export interface SessionPayload {
  sub: string;
}

export interface AuthenticatedRequest extends Request {
  user: SessionUser;
}
