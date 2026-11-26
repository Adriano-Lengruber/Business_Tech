import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  auditLogs,
  desc,
  eq,
  ilike,
  inventoryMovements,
  or,
  products,
  purchaseOrderItems,
  purchaseOrders,
  serviceOrderEvents,
  serviceOrders,
  sql,
  suppliers,
} from '@al/database';
import {
  checkStockAlert,
  type ConsumeOsPartInput,
  type CreateProductInput,
  type CreatePurchaseOrderInput,
  type CreateStockMovementInput,
  type CreateSupplierInput,
} from '@al/shared';
import { DatabaseService } from '../database/database.module';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class InventoryService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(FinanceService) private readonly financeService: FinanceService,
  ) {}

  async listProducts(organizationId: string, q?: string) {
    const term = q?.trim();
    const rows = await this.database.withTenant(organizationId, (tx) => {
      if (!term) {
        return tx
          .select()
          .from(products)
          .orderBy(desc(products.createdAt))
          .limit(100);
      }
      return tx
        .select()
        .from(products)
        .where(
          or(
            ilike(products.name, `%${term}%`),
            ilike(products.sku, `%${term}%`),
            ilike(products.barcode, `%${term}%`),
          ),
        )
        .orderBy(desc(products.createdAt))
        .limit(50);
    });

    return rows.map((p) => ({
      ...p,
      alertLevel: checkStockAlert(p.stockQty, p.minStockQty),
    }));
  }

  async createProduct(
    organizationId: string,
    userId: string,
    input: CreateProductInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const existing = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.sku, input.sku.trim()))
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictException(`SKU "${input.sku}" já cadastrado.`);
      }

      const [prod] = await tx
        .insert(products)
        .values({
          organizationId,
          sku: input.sku.trim().toUpperCase(),
          barcode: input.barcode?.trim() || null,
          name: input.name.trim(),
          category: input.category.trim(),
          brand: input.brand?.trim() || null,
          unit: input.unit.trim(),
          costCents: input.costCents,
          priceCents: input.priceCents,
          stockQty: input.stockQty,
          minStockQty: input.minStockQty,
          ncm: input.ncm?.trim() || null,
          cfopDefault: input.cfopDefault,
          csosnDefault: input.csosnDefault,
        })
        .returning();

      if (input.stockQty > 0) {
        await tx.insert(inventoryMovements).values({
          organizationId,
          productId: prod!.id,
          type: 'in',
          quantityDelta: input.stockQty,
          unitCostCents: input.costCents,
          referenceType: 'manual',
          note: 'Saldo inicial no cadastro',
          actorId: userId,
        });
      }

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'product.created',
        entityType: 'product',
        entityId: prod!.id,
        afterState: { sku: prod!.sku, stockQty: prod!.stockQty },
      });

      return {
        ...prod!,
        alertLevel: checkStockAlert(prod!.stockQty, prod!.minStockQty),
      };
    });
  }

  async recordMovement(
    organizationId: string,
    userId: string,
    input: CreateStockMovementInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [prod] = await tx
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);

      if (!prod) {
        throw new NotFoundException('Produto não encontrado.');
      }

      const nextQty = prod.stockQty + input.quantityDelta;
      if (nextQty < 0) {
        throw new BadRequestException(
          `Estoque insuficiente para ${prod.name} (atual: ${prod.stockQty}).`,
        );
      }

      const [updated] = await tx
        .update(products)
        .set({ stockQty: nextQty, updatedAt: new Date() })
        .where(eq(products.id, prod.id))
        .returning();

      const [mov] = await tx
        .insert(inventoryMovements)
        .values({
          organizationId,
          productId: prod.id,
          type: input.type,
          quantityDelta: input.quantityDelta,
          unitCostCents: input.unitCostCents || prod.costCents,
          referenceType: 'manual',
          note: input.note?.trim() || null,
          actorId: userId,
        })
        .returning();

      return { product: updated!, movement: mov! };
    });
  }

  async consumePartInServiceOrder(
    organizationId: string,
    serviceOrderId: string,
    userId: string,
    input: ConsumeOsPartInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [os] = await tx
        .select()
        .from(serviceOrders)
        .where(eq(serviceOrders.id, serviceOrderId))
        .limit(1);
      if (!os) {
        throw new NotFoundException('Ordem de serviço não encontrada.');
      }

      const [prod] = await tx
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);
      if (!prod) {
        throw new NotFoundException('Peça/produto não encontrado no estoque.');
      }

      if (prod.stockQty < input.quantity) {
        throw new BadRequestException(
          `Estoque insuficiente de "${prod.name}" (disponível: ${prod.stockQty}).`,
        );
      }

      const [updatedProd] = await tx
        .update(products)
        .set({ stockQty: prod.stockQty - input.quantity, updatedAt: new Date() })
        .where(eq(products.id, prod.id))
        .returning();

      await tx.insert(inventoryMovements).values({
        organizationId,
        productId: prod.id,
        type: 'os_consume',
        quantityDelta: -input.quantity,
        unitCostCents: prod.costCents,
        referenceType: 'service_order',
        referenceId: serviceOrderId,
        note: input.note?.trim() || `Baixa para ${os.code}`,
        actorId: userId,
      });

      await tx.insert(serviceOrderEvents).values({
        organizationId,
        serviceOrderId,
        eventType: 'part.consumed',
        note: `Peça aplicada: ${input.quantity}x ${prod.name} (${prod.sku}).`,
        actorType: 'human',
        actorId: userId,
      });

      return { product: updatedProd!, serviceOrderCode: os.code };
    });
  }

  async listSuppliers(organizationId: string) {
    return this.database.withTenant(organizationId, (tx) =>
      tx.select().from(suppliers).orderBy(desc(suppliers.createdAt)),
    );
  }

  async createSupplier(organizationId: string, input: CreateSupplierInput) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [sup] = await tx
        .insert(suppliers)
        .values({
          organizationId,
          name: input.name.trim(),
          cnpj: input.cnpj?.trim() || null,
          email: input.email ? input.email.trim().toLowerCase() : null,
          phone: input.phone?.trim() || null,
          leadTimeDays: input.leadTimeDays,
        })
        .returning();
      return sup!;
    });
  }

  async listPurchaseOrders(organizationId: string) {
    return this.database.withTenant(organizationId, (tx) =>
      tx
        .select({
          id: purchaseOrders.id,
          code: purchaseOrders.code,
          status: purchaseOrders.status,
          totalCostCents: purchaseOrders.totalCostCents,
          linkedServiceOrderId: purchaseOrders.linkedServiceOrderId,
          expectedArrivalAt: purchaseOrders.expectedArrivalAt,
          notes: purchaseOrders.notes,
          receivedAt: purchaseOrders.receivedAt,
          createdAt: purchaseOrders.createdAt,
          supplierName: suppliers.name,
        })
        .from(purchaseOrders)
        .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .orderBy(desc(purchaseOrders.createdAt)),
    );
  }

  async createPurchaseOrder(
    organizationId: string,
    userId: string,
    input: CreatePurchaseOrderInput,
  ) {
    const totalCostCents = input.items.reduce(
      (sum, it) => sum + it.quantity * it.unitCostCents,
      0,
    );

    return this.database.withTenant(organizationId, async (tx) => {
      const countRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(purchaseOrders);
      const nextNum = (countRes[0]?.count ?? 0) + 1;
      const code = `PO-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

      const expectedArrival = input.expectedArrivalAt
        ? new Date(input.expectedArrivalAt)
        : null;

      const [po] = await tx
        .insert(purchaseOrders)
        .values({
          organizationId,
          supplierId: input.supplierId,
          code,
          status: 'ORDERED',
          totalCostCents,
          linkedServiceOrderId: input.linkedServiceOrderId ?? null,
          expectedArrivalAt: expectedArrival,
          notes: input.notes?.trim() || null,
        })
        .returning();

      if (input.linkedServiceOrderId) {
        await tx
          .update(serviceOrders)
          .set({
            status: 'AWAITING_PART',
            ...(expectedArrival ? { promisedAt: expectedArrival } : {}),
            updatedAt: new Date(),
          })
          .where(eq(serviceOrders.id, input.linkedServiceOrderId));

        await tx.insert(serviceOrderEvents).values({
          organizationId,
          serviceOrderId: input.linkedServiceOrderId,
          eventType: 'part.ordered',
          toStatus: 'AWAITING_PART',
          note: `Peça encomendada via Pedido ${code}${expectedArrival ? ` (previsão ${expectedArrival.toLocaleDateString('pt-BR')})` : ''}.`,
          actorType: 'human',
          actorId: userId,
        });
      }

      await tx.insert(purchaseOrderItems).values(
        input.items.map((it) => ({
          organizationId,
          purchaseOrderId: po!.id,
          productId: it.productId,
          quantity: it.quantity,
          unitCostCents: it.unitCostCents,
        })),
      );

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'purchase_order.created',
        entityType: 'purchase_order',
        entityId: po!.id,
        afterState: { code, totalCostCents },
      });

      return po!;
    });
  }

  async receivePurchaseOrder(
    organizationId: string,
    purchaseOrderId: string,
    userId: string,
  ) {
    const received = await this.database.withTenant(
      organizationId,
      async (tx) => {
        const [po] = await tx
          .select()
          .from(purchaseOrders)
          .where(eq(purchaseOrders.id, purchaseOrderId))
          .limit(1);

        if (!po) {
          throw new NotFoundException('Pedido de compra não encontrado.');
        }
        if (po.status === 'RECEIVED') {
          throw new BadRequestException('Pedido de compra já foi recebido.');
        }

        const items = await tx
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, po.id));

        for (const it of items) {
          const [prod] = await tx
            .select()
            .from(products)
            .where(eq(products.id, it.productId))
            .limit(1);

          if (prod) {
            await tx
              .update(products)
              .set({
                stockQty: prod.stockQty + it.quantity,
                costCents: it.unitCostCents,
                updatedAt: new Date(),
              })
              .where(eq(products.id, prod.id));

            await tx.insert(inventoryMovements).values({
              organizationId,
              productId: prod.id,
              type: 'in',
              quantityDelta: it.quantity,
              unitCostCents: it.unitCostCents,
              referenceType: 'purchase',
              referenceId: po.id,
              note: `Recebimento ${po.code}`,
              actorId: userId,
            });
          }
        }

        const [updatedPo] = await tx
          .update(purchaseOrders)
          .set({ status: 'RECEIVED', receivedAt: new Date() })
          .where(and(eq(purchaseOrders.id, po.id)))
          .returning();

        if (po.linkedServiceOrderId) {
          await tx
            .update(serviceOrders)
            .set({ status: 'IN_REPAIR', updatedAt: new Date() })
            .where(eq(serviceOrders.id, po.linkedServiceOrderId));

          await tx.insert(serviceOrderEvents).values({
            organizationId,
            serviceOrderId: po.linkedServiceOrderId,
            eventType: 'part.received',
            toStatus: 'IN_REPAIR',
            note: `Peça do Pedido ${po.code} recebida no estoque; OS liberada para bancada.`,
            actorType: 'human',
            actorId: userId,
          });
        }

        return updatedPo!;
      },
    );

    if (received.totalCostCents > 0) {
      await this.financeService
        .createTransaction(organizationId, userId, {
          type: 'payable',
          category: 'Compras / Estoque',
          description: `Pedido de compra ${received.code}`,
          paymentMethod: 'boleto',
          amountCents: received.totalCostCents,
        })
        .catch(() => undefined);
    }

    return received;
  }
}
