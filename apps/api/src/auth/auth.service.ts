import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  auditLogs,
  eq,
  hashPassword,
  memberships,
  organizations,
  tenantModules,
  users,
  verifyPassword,
} from '@al/database';
import {
  MODULE_CODES,
  type LoginInput,
  type ModuleCode,
  type OrgRole,
  type RegisterOrganizationInput,
} from '@al/shared';
import { DatabaseService } from '../database/database.module';
import type { AuthenticatedUser } from '../common/decorators/auth.decorators';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(JwtService) private readonly jwtService: JwtService,
  ) {}

  async login(input: LoginInput) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const foundUsers = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    const user = foundUsers[0];
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const passwordOk = await verifyPassword(input.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const userMemberships = await this.database.db
      .select({
        organizationId: organizations.id,
        organizationName: organizations.name,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
      .where(eq(memberships.userId, user.id))
      .limit(1);

    const membership = userMemberships[0];
    if (!membership) {
      throw new UnauthorizedException('Usuário sem organização vinculada.');
    }

    const activeModules = await this.getEnabledModules(membership.organizationId);

    const tokenPayload: AuthenticatedUser = {
      userId: user.id,
      email: user.email,
      name: user.name,
      organizationId: membership.organizationId,
      organizationName: membership.organizationName,
      role: membership.role as OrgRole,
    };

    const accessToken = await this.jwtService.signAsync(tokenPayload);

    return {
      accessToken,
      user: tokenPayload,
      enabledModules: activeModules,
    };
  }

  async registerOrganization(input: RegisterOrganizationInput) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('E-mail já cadastrado na plataforma.');
    }

    const slugBase = input.organizationName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (!slugBase) {
      throw new BadRequestException('Nome de organização inválido.');
    }

    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;
    const passwordHash = await hashPassword(input.password);
    const modulesToEnable = Array.from(
      new Set<ModuleCode>(['core', ...input.enabledModules]),
    );

    const created = await this.database.db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({
          slug,
          name: input.organizationName.trim(),
          cnpj: input.cnpj?.trim() || null,
          planCode: 'modular_trial',
          aiPrivacyMode: 'strict_local',
        })
        .returning();

      const [user] = await tx
        .insert(users)
        .values({
          email: normalizedEmail,
          name: input.ownerName.trim(),
          passwordHash,
        })
        .returning();

      await tx.insert(memberships).values({
        organizationId: org!.id,
        userId: user!.id,
        role: 'owner',
      });

      for (const code of MODULE_CODES) {
        await tx.insert(tenantModules).values({
          organizationId: org!.id,
          moduleCode: code,
          enabled: modulesToEnable.includes(code),
        });
      }

      await tx.insert(auditLogs).values({
        organizationId: org!.id,
        actorType: 'human',
        actorId: user!.id,
        action: 'organization.registered',
        entityType: 'organization',
        entityId: org!.id,
        afterState: { enabledModules: modulesToEnable },
      });

      return { org: org!, user: user! };
    });

    const tokenPayload: AuthenticatedUser = {
      userId: created.user.id,
      email: created.user.email,
      name: created.user.name,
      organizationId: created.org.id,
      organizationName: created.org.name,
      role: 'owner',
    };

    const accessToken = await this.jwtService.signAsync(tokenPayload);

    return {
      accessToken,
      user: tokenPayload,
      enabledModules: modulesToEnable,
    };
  }

  async getEnabledModules(organizationId: string): Promise<ModuleCode[]> {
    return this.database.withTenant(organizationId, async (tx) => {
      const rows = await tx
        .select({
          moduleCode: tenantModules.moduleCode,
          enabled: tenantModules.enabled,
        })
        .from(tenantModules)
        .where(eq(tenantModules.organizationId, organizationId));

      return rows
        .filter((r) => r.enabled)
        .map((r) => r.moduleCode as ModuleCode);
    });
  }
}
