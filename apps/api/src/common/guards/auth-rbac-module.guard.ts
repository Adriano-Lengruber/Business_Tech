import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { and, eq, tenantModules } from '@al/database';
import { hasPermission, type ModuleCode, type Permission } from '@al/shared';
import {
  IS_PUBLIC_KEY,
  REQUIRED_MODULE_KEY,
  REQUIRED_PERMISSIONS_KEY,
  type AuthenticatedUser,
} from '../decorators/auth.decorators';
import { DatabaseService } from '../../database/database.module';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação ausente.');
    }

    const token = authHeader.slice(7).trim();
    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token de autenticação inválido ou expirado.');
    }
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new UnauthorizedException('Usuário não autenticado.');
    }

    const allowed = required.every((perm) =>
      hasPermission(request.user!.role, perm),
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Permissão insuficiente para executar esta operação.',
      );
    }
    return true;
  }
}

@Injectable()
export class ModuleEntitlementGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<
      ModuleCode | undefined
    >(REQUIRED_MODULE_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredModule) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new UnauthorizedException('Usuário não autenticado.');
    }

    const enabled = await this.database.withTenant(
      request.user.organizationId,
      async (tx) => {
        const rows = await tx
          .select({ enabled: tenantModules.enabled })
          .from(tenantModules)
          .where(
            and(
              eq(tenantModules.organizationId, request.user!.organizationId),
              eq(tenantModules.moduleCode, requiredModule),
            ),
          )
          .limit(1);
        return rows[0]?.enabled ?? false;
      },
    );

    if (!enabled) {
      throw new ForbiddenException(
        `O módulo "${requiredModule}" não está habilitado para esta organização.`,
      );
    }
    return true;
  }
}
