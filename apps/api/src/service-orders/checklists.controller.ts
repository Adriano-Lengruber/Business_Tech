import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  auditLogs,
  checklistTemplates,
  desc,
  eq,
  serviceOrderChecklists,
  serviceOrders,
} from '@al/database';
import {
  createChecklistTemplateSchema,
  upsertOsChecklistSchema,
} from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { DatabaseService } from '../database/database.module';

@ApiTags('Checklists Técnicos por Categoria')
@ApiBearerAuth()
@RequireModule('mod-service-orders')
@Controller()
export class ChecklistsController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get('checklists/templates')
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Listar templates de checklist por tipo de equipamento' })
  listTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.database.withTenant(user.organizationId, (tx) =>
      tx
        .select()
        .from(checklistTemplates)
        .orderBy(desc(checklistTemplates.createdAt)),
    );
  }

  @Post('checklists/templates')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Criar template de checklist obrigatório por categoria' })
  createTemplate(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = createChecklistTemplateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input = parsed.data;

    return this.database.withTenant(user.organizationId, async (tx) => {
      const [created] = await tx
        .insert(checklistTemplates)
        .values({
          organizationId: user.organizationId,
          category: input.category,
          title: input.title.trim(),
          items: input.items,
          blockClosingIfIncomplete: input.blockClosingIfIncomplete,
        })
        .returning();
      return created!;
    });
  }

  @Get('service-orders/:osId/checklist')
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Obter checklist técnico vinculado à OS' })
  getOsChecklist(
    @Param('osId') osId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.database.withTenant(user.organizationId, async (tx) => {
      const [row] = await tx
        .select()
        .from(serviceOrderChecklists)
        .where(eq(serviceOrderChecklists.serviceOrderId, osId))
        .limit(1);
      return row ?? null;
    });
  }

  @Post('service-orders/:osId/checklist')
  @RequirePermission('os:write')
  @ApiOperation({
    summary: 'Aplicar template ou marcar itens verificados no checklist da OS',
  })
  upsertOsChecklist(
    @Param('osId') osId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = upsertOsChecklistSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input = parsed.data;

    return this.database.withTenant(user.organizationId, async (tx) => {
      const [os] = await tx
        .select({ id: serviceOrders.id, code: serviceOrders.code })
        .from(serviceOrders)
        .where(eq(serviceOrders.id, osId))
        .limit(1);

      if (!os) {
        throw new NotFoundException('OS não encontrada.');
      }

      const [existing] = await tx
        .select()
        .from(serviceOrderChecklists)
        .where(eq(serviceOrderChecklists.serviceOrderId, osId))
        .limit(1);

      let items = existing?.items ?? [];
      let title = existing?.title ?? 'Checklist Técnico';
      let blockClosingIfIncomplete =
        existing?.blockClosingIfIncomplete ?? true;
      let templateId = existing?.templateId ?? null;

      if (input.templateId) {
        const [tpl] = await tx
          .select()
          .from(checklistTemplates)
          .where(eq(checklistTemplates.id, input.templateId))
          .limit(1);

        if (!tpl) {
          throw new NotFoundException('Template de checklist não encontrado.');
        }
        items = tpl.items;
        title = tpl.title;
        blockClosingIfIncomplete = tpl.blockClosingIfIncomplete;
        templateId = tpl.id;
      }

      if (items.length === 0) {
        throw new BadRequestException(
          'Selecione um template de checklist primeiro.',
        );
      }

      const mergedResponses = {
        ...(existing?.responses ?? {}),
        ...input.responses,
      };
      const completedRequired = items
        .filter((it) => it.required)
        .every((it) => mergedResponses[it.key]?.checked === true);

      let saved;
      if (existing) {
        const [updated] = await tx
          .update(serviceOrderChecklists)
          .set({
            templateId,
            title,
            items,
            responses: mergedResponses,
            blockClosingIfIncomplete,
            completedRequired,
            updatedByUserId: user.userId,
            updatedAt: new Date(),
          })
          .where(eq(serviceOrderChecklists.id, existing.id))
          .returning();
        saved = updated!;
      } else {
        const [inserted] = await tx
          .insert(serviceOrderChecklists)
          .values({
            organizationId: user.organizationId,
            serviceOrderId: osId,
            templateId,
            title,
            items,
            responses: mergedResponses,
            blockClosingIfIncomplete,
            completedRequired,
            updatedByUserId: user.userId,
          })
          .returning();
        saved = inserted!;
      }

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        actorType: 'human',
        actorId: user.userId,
        action: 'service_order.checklist_updated',
        entityType: 'service_order',
        entityId: osId,
        afterState: {
          osCode: os.code,
          completedRequired,
        },
      });

      return saved;
    });
  }
}
