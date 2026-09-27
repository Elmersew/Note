import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SessionUser } from '@sticky-notes/contracts';
import type { AuthenticatedRequest } from './auth.types';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): SessionUser => {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
});
