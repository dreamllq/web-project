import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../entities/user.entity';

/**
 * CurrentUser decorator
 *
 * Extracts the authenticated user from the request object.
 * Must be used with JwtAuthGuard to populate request.user.
 *
 * @example
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User | User[keyof User] => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as User;

    if (!user) {
      return null;
    }

    // If data is provided, return that specific property
    // Otherwise, return the entire user object
    return data ? user[data] : user;
  },
);
