import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import {
  and,
  auditLogs,
  desc,
  eq,
  hashPassword,
  ilike,
  memberships,
  tenantApiKeys,
  users,
  webhookEndpoints,
} from '@al/database';
import type {
  CreateApiKeyInput,
  CreateTeamMemberInput,
  CreateWebhookEndpointInput,
} from '@al/shared';
import { decryptSecret, encryptSecret } from '../common/crypto/encryption';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class SecurityService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async listAuditLogs(organizationId: string, actionFilter?: string) {
    return this.database.withTenant(organizationId, (tx) => {
      if (actionFilter?.trim()) {
        return tx
          .select()
          .from(auditLogs)
          .where(ilike(auditLogs.action, `%${actionFilter.trim()}%`))
          .orderBy(desc(auditLogs.createdAt))
          .limit(100);
      }
      return tx
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(100);
    });
  }

  async listTeam(organizationId: string) {
    return this.database.db
      .select({
        membershipId: memberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: memberships.role,
        isActive: users.isActive,
        joinedAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.organizationId, organizationId))
      .orderBy(desc(memberships.createdAt));
  }

  async addTeamMember(
    organizationId: string,
    actorUserId: string,
    input: CreateTeamMemberInput,
  ) {
    const email = input.email.trim().toLowerCase();
    const existingUsers = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUsers.length > 0) {
      throw new ConflictException(
        'Já existe um usuário cadastrado com este e-mail.',
      );
    }

    const passwordHash = await hashPassword(input.password);
    const created = await this.database.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email,
          name: input.name.trim(),
          passwordHash,
          isActive: true,
        })
        .returning({ id: users.id, name: users.name, email: users.email });

      const [membership] = await tx
        .insert(memberships)
        .values({
          organizationId,
          userId: user!.id,
          role: input.role,
        })
        .returning();

      return {
        membershipId: membership!.id,
        userId: user!.id,
        name: user!.name,
        email: user!.email,
        role: membership!.role,
      };
    });

    await this.database.withTenant(organizationId, (tx) =>
      tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: actorUserId,
        action: 'team.member_added',
        entityType: 'user',
        entityId: created.userId,
        afterState: { email: created.email, role: created.role },
      }),
    );

    return created;
  }

  async listIntegrations(organizationId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [apiKeys, webhooks] = await Promise.all([
        tx
          .select({
            id: tenantApiKeys.id,
            name: tenantApiKeys.name,
            keyPrefix: tenantApiKeys.keyPrefix,
            scopes: tenantApiKeys.scopes,
            isActive: tenantApiKeys.isActive,
            lastUsedAt: tenantApiKeys.lastUsedAt,
            createdAt: tenantApiKeys.createdAt,
          })
          .from(tenantApiKeys)
          .orderBy(desc(tenantApiKeys.createdAt)),
        tx
          .select({
            id: webhookEndpoints.id,
            name: webhookEndpoints.name,
            targetUrl: webhookEndpoints.targetUrl,
            events: webhookEndpoints.events,
            isActive: webhookEndpoints.isActive,
            lastStatusCode: webhookEndpoints.lastStatusCode,
            lastDeliveredAt: webhookEndpoints.lastDeliveredAt,
            createdAt: webhookEndpoints.createdAt,
          })
          .from(webhookEndpoints)
          .orderBy(desc(webhookEndpoints.createdAt)),
      ]);

      return { apiKeys, webhooks };
    });
  }

  async createApiKey(
    organizationId: string,
    userId: string,
    input: CreateApiKeyInput,
  ) {
    const rawSecret = `al_live_${randomBytes(24).toString('hex')}`;
    const keyPrefix = rawSecret.slice(0, 14);
    const keyHash = createHash('sha256').update(rawSecret).digest('hex');

    const record = await this.database.withTenant(organizationId, async (tx) => {
      const [row] = await tx
        .insert(tenantApiKeys)
        .values({
          organizationId,
          name: input.name.trim(),
          keyPrefix,
          keyHash,
          scopes: input.scopes,
          createdByUserId: userId,
        })
        .returning({
          id: tenantApiKeys.id,
          name: tenantApiKeys.name,
          keyPrefix: tenantApiKeys.keyPrefix,
          scopes: tenantApiKeys.scopes,
          isActive: tenantApiKeys.isActive,
          createdAt: tenantApiKeys.createdAt,
        });

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'integration.api_key_created',
        entityType: 'tenant_api_key',
        entityId: row!.id,
        afterState: { name: row!.name, keyPrefix },
      });

      return row!;
    });

    return { ...record, plainKey: rawSecret };
  }

  async revokeApiKey(organizationId: string, keyId: string, userId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [updated] = await tx
        .update(tenantApiKeys)
        .set({ isActive: false })
        .where(eq(tenantApiKeys.id, keyId))
        .returning({
          id: tenantApiKeys.id,
          name: tenantApiKeys.name,
          isActive: tenantApiKeys.isActive,
        });

      if (!updated) {
        throw new NotFoundException('API Key não encontrada.');
      }

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'integration.api_key_revoked',
        entityType: 'tenant_api_key',
        entityId: keyId,
      });

      return updated;
    });
  }

  async createWebhook(
    organizationId: string,
    userId: string,
    input: CreateWebhookEndpointInput,
  ) {
    const signingSecret = `whsec_${randomBytes(20).toString('hex')}`;
    const secretEncrypted = encryptSecret(signingSecret);

    const record = await this.database.withTenant(organizationId, async (tx) => {
      const [row] = await tx
        .insert(webhookEndpoints)
        .values({
          organizationId,
          name: input.name.trim(),
          targetUrl: input.targetUrl.trim(),
          events: input.events,
          secretEncrypted,
        })
        .returning({
          id: webhookEndpoints.id,
          name: webhookEndpoints.name,
          targetUrl: webhookEndpoints.targetUrl,
          events: webhookEndpoints.events,
          isActive: webhookEndpoints.isActive,
          createdAt: webhookEndpoints.createdAt,
        });

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'integration.webhook_created',
        entityType: 'webhook_endpoint',
        entityId: row!.id,
        afterState: { name: row!.name, targetUrl: row!.targetUrl },
      });

      return row!;
    });

    return { ...record, signingSecret };
  }

  async testWebhook(organizationId: string, webhookId: string, userId: string) {
    const endpoint = await this.database.withTenant(
      organizationId,
      async (tx) => {
        const [row] = await tx
          .select()
          .from(webhookEndpoints)
          .where(
            and(
              eq(webhookEndpoints.id, webhookId),
              eq(webhookEndpoints.organizationId, organizationId),
            ),
          )
          .limit(1);
        return row ?? null;
      },
    );

    if (!endpoint) {
      throw new NotFoundException('Webhook não encontrado.');
    }

    const secret = decryptSecret(endpoint.secretEncrypted);
    const payloadString = JSON.stringify({
      event: 'webhook.test',
      organizationId,
      timestamp: new Date().toISOString(),
      data: { message: 'AL Business OS webhook connectivity check' },
    });
    const signature = `sha256=${createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex')}`;

    let statusCode = 0;
    let delivered = false;
    try {
      const res = await fetch(endpoint.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AL-Signature': signature,
        },
        body: payloadString,
        signal: AbortSignal.timeout(3000),
      });
      statusCode = res.status;
      delivered = res.ok;
    } catch {
      statusCode = 502;
      delivered = false;
    }

    await this.database.withTenant(organizationId, async (tx) => {
      await tx
        .update(webhookEndpoints)
        .set({
          lastStatusCode: statusCode,
          lastDeliveredAt: new Date(),
        })
        .where(eq(webhookEndpoints.id, webhookId));

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'integration.webhook_tested',
        entityType: 'webhook_endpoint',
        entityId: webhookId,
        afterState: { statusCode, delivered },
      });
    });

    return { delivered, statusCode, signature };
  }
}
