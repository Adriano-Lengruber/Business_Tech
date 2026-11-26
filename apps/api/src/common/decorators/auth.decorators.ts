import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { ModuleCode, OrgRole, Permission } from '@al/shared';

export const IS_PUBLIC_KEY = 'al:is_public';
export const REQUIRED_PERMISSIONS_KEY = 'al:required_permissions';
export const REQUIRED_MODULE_KEY = 'al:required_module';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: OrgRole;
}

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

export const RequireModule = (moduleCode: ModuleCode) =>
  SetMetadata(REQUIRED_MODULE_KEY, moduleCode);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return req.user;
  },
);
