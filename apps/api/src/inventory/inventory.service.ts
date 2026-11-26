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
  inArray,
  inventoryMovements,
  or,
  products,
  productSuppliers,
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
  type LinkProductSupplierInput,
  type UpdateProductInput,
  type UpdateSupplierInput,
} from '@al/shared';
import { DatabaseService } from '../database/database.module';
import { FinanceService } from '../finance/finance.service';
import { StorageService } from '../storage/storage.module';

@Injectable()
export class InventoryService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(FinanceService) private readonly financeService: FinanceService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  async listProducts(
    organizationId: string,
    q?: string,
    includeInactive = false,
  ) {
    const term = q?.trim();
    const { rows, links } = await this.database.withTenant(
      organizationId,
      async (tx) => {
        const activeFilter = includeInactive
          ? undefined
          : eq(products.isActive, true);

        const productRows = !term
          ? await tx
              .select()
              .from(products)
              .where(activeFilter)
              .orderBy(desc(products.createdAt))
              .limit(150)
          : await tx
              .select()
              .from(products)
              .where(
                and(
                  activeFilter,
                  or(
                    ilike(products.name, `%${term}%`),
                    ilike(products.sku, `%${term}%`),
                    ilike(products.barcode, `%${term}%`),
                    ilike(products.category, `%${term}%`),
                    ilike(products.brand, `%${term}%`),
                  ),
                ),
              )
              .orderBy(desc(products.createdAt))
              .limit(80);

        const prodIds = productRows.map((p) => p.id);
        const supplierLinks =
          prodIds.length > 0
            ? await tx
                .select({
                  id: productSuppliers.id,
                  productId: productSuppliers.productId,
                  supplierId: productSuppliers.supplierId,
                  supplierName: suppliers.name,
                  supplierSku: productSuppliers.supplierSku,
                  lastCostCents: productSuppliers.lastCostCents,
                  supplierUrl: productSuppliers.supplierUrl,
                  notes: productSuppliers.notes,
                  isPreferred: productSuppliers.isPreferred,
                })
                .from(productSuppliers)
                .innerJoin(suppliers, eq(productSuppliers.supplierId, suppliers.id))
                .where(inArray(productSuppliers.productId, prodIds))
            : [];

        return { rows: productRows, links: supplierLinks };
      },
    );

    const enriched = await Promise.all(
      rows.map(async (p) => {
        let imageUrl: string | null = null;
        if (p.imageStorageKey) {
          imageUrl = await this.storage
            .getSignedDownloadUrl(p.imageStorageKey, 3600)
            .catch(() => null);
        }
        const prodLinks = links.filter((l) => l.productId === p.id);
        const preferred =
          prodLinks.find((l) => l.supplierId === p.preferredSupplierId) ??
          prodLinks.find((l) => l.isPreferred) ??
          null;

        return {
          ...p,
          imageUrl,
          alertLevel: checkStockAlert(p.stockQty, p.minStockQty),
          preferredSupplierName: preferred?.supplierName ?? null,
          suppliers: prodLinks,
        };
      }),
    );

    return enriched;
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
        .where(eq(products.sku, input.sku.trim().toUpperCase()))
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
          description: input.description?.trim() || null,
          category: input.category.trim(),
          brand: input.brand?.trim() || null,
          unit: input.unit.trim(),
          costCents: input.costCents,
          priceCents: input.priceCents,
          wholesalePriceCents: input.wholesalePriceCents ?? null,
          vipPriceCents: input.vipPriceCents ?? null,
          warrantyDays: input.warrantyDays ?? 90,
          preferredSupplierId: input.preferredSupplierId ?? null,
          stockQty: input.stockQty,
          minStockQty: input.minStockQty,
          ncm: input.ncm?.trim() || null,
          cfopDefault: input.cfopDefault,
          csosnDefault: input.csosnDefault,
        })
        .returning();

      if (input.preferredSupplierId) {
        await tx
          .insert(productSuppliers)
          .values({
            organizationId,
            productId: prod!.id,
            supplierId: input.preferredSupplierId,
            supplierSku: input.supplierSku?.trim() || null,
            lastCostCents: input.costCents,
            isPreferred: true,
          })
          .onConflictDoNothing();
      }

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
        imageUrl: null,
        suppliers: [],
        alertLevel: checkStockAlert(prod!.stockQty, prod!.minStockQty),
      };
    });
  }

  async updateProduct(
    organizationId: string,
    productId: string,
    userId: string,
    input: UpdateProductInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!existing) {
        throw new NotFoundException('Produto não encontrado.');
      }

      const nextSku = input.sku ? input.sku.trim().toUpperCase() : existing.sku;
      if (nextSku !== existing.sku) {
        const dup = await tx
          .select({ id: products.id })
          .from(products)
          .where(eq(products.sku, nextSku))
          .limit(1);
        if (dup.length > 0) {
          throw new ConflictException(`SKU "${nextSku}" já está em uso.`);
        }
      }

      const [updated] = await tx
        .update(products)
        .set({
          sku: nextSku,
          barcode:
            input.barcode !== undefined
              ? input.barcode?.trim() || null
              : existing.barcode,
          name: input.name !== undefined ? input.name.trim() : existing.name,
          description:
            input.description !== undefined
              ? input.description?.trim() || null
              : existing.description,
          category:
            input.category !== undefined ? input.category.trim() : existing.category,
          brand:
            input.brand !== undefined ? input.brand?.trim() || null : existing.brand,
          unit: input.unit !== undefined ? input.unit.trim() : existing.unit,
          costCents:
            input.costCents !== undefined ? input.costCents : existing.costCents,
          priceCents:
            input.priceCents !== undefined ? input.priceCents : existing.priceCents,
          wholesalePriceCents:
            input.wholesalePriceCents !== undefined
              ? input.wholesalePriceCents
              : existing.wholesalePriceCents,
          vipPriceCents:
            input.vipPriceCents !== undefined
              ? input.vipPriceCents
              : existing.vipPriceCents,
          warrantyDays:
            input.warrantyDays !== undefined
              ? input.warrantyDays
              : existing.warrantyDays,
          preferredSupplierId:
            input.preferredSupplierId !== undefined
              ? input.preferredSupplierId
              : existing.preferredSupplierId,
          minStockQty:
            input.minStockQty !== undefined
              ? input.minStockQty
              : existing.minStockQty,
          ncm: input.ncm !== undefined ? input.ncm?.trim() || null : existing.ncm,
          cfopDefault:
            input.cfopDefault !== undefined
              ? input.cfopDefault
              : existing.cfopDefault,
          csosnDefault:
            input.csosnDefault !== undefined
              ? input.csosnDefault
              : existing.csosnDefault,
          isActive:
            input.isActive !== undefined ? input.isActive : existing.isActive,
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId))
        .returning();

      if (input.preferredSupplierId) {
        await tx
          .insert(productSuppliers)
          .values({
            organizationId,
            productId,
            supplierId: input.preferredSupplierId,
            supplierSku: input.supplierSku?.trim() || null,
            lastCostCents: updated!.costCents,
            isPreferred: true,
          })
          .onConflictDoUpdate({
            target: [productSuppliers.productId, productSuppliers.supplierId],
            set: {
              isPreferred: true,
              lastCostCents: updated!.costCents,
            },
          });
      }

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'product.updated',
        entityType: 'product',
        entityId: productId,
        beforeState: { name: existing.name, priceCents: existing.priceCents },
        afterState: { name: updated!.name, priceCents: updated!.priceCents },
      });

      return {
        ...updated!,
        alertLevel: checkStockAlert(updated!.stockQty, updated!.minStockQty),
      };
    });
  }

  async deleteProduct(organizationId: string, productId: string, userId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!existing) {
        throw new NotFoundException('Produto não encontrado.');
      }

      const [updated] = await tx
        .update(products)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(products.id, productId))
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'product.archived',
        entityType: 'product',
        entityId: productId,
      });

      return updated!;
    });
  }

  async uploadProductImage(params: {
    organizationId: string;
    productId: string;
    userId: string;
    filename: string;
    mimeType: string;
    buffer: Buffer;
  }) {
    const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `tenants/${params.organizationId}/products/${params.productId}/${Date.now()}-${safeName}`;

    await this.storage.uploadObject({
      key: storageKey,
      body: params.buffer,
      contentType: params.mimeType,
    });

    const updated = await this.database.withTenant(
      params.organizationId,
      async (tx) => {
        const [prod] = await tx
          .update(products)
          .set({ imageStorageKey: storageKey, updatedAt: new Date() })
          .where(eq(products.id, params.productId))
          .returning();

        if (!prod) {
          throw new NotFoundException('Produto não encontrado.');
        }

        await tx.insert(auditLogs).values({
          organizationId: params.organizationId,
          actorType: 'human',
          actorId: params.userId,
          action: 'product.image_uploaded',
          entityType: 'product',
          entityId: params.productId,
          afterState: { storageKey },
        });

        return prod;
      },
    );

    const imageUrl = await this.storage
      .getSignedDownloadUrl(storageKey, 3600)
      .catch(() => null);

    return { ...updated, imageUrl };
  }

  async getProductMovements(organizationId: string, productId: string) {
    return this.database.withTenant(organizationId, (tx) =>
      tx
        .select()
        .from(inventoryMovements)
        .where(eq(inventoryMovements.productId, productId))
        .orderBy(desc(inventoryMovements.createdAt))
        .limit(50),
    );
  }

  async linkProductSupplier(
    organizationId: string,
    productId: string,
    input: LinkProductSupplierInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [prod] = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);
      if (!prod) throw new NotFoundException('Produto não encontrado.');

      const [sup] = await tx
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.id, input.supplierId))
        .limit(1);
      if (!sup) throw new NotFoundException('Fornecedor não encontrado.');

      if (input.isPreferred) {
        await tx
          .update(productSuppliers)
          .set({ isPreferred: false })
          .where(eq(productSuppliers.productId, productId));

        await tx
          .update(products)
          .set({ preferredSupplierId: input.supplierId, updatedAt: new Date() })
          .where(eq(products.id, productId));
      }

      const [link] = await tx
        .insert(productSuppliers)
        .values({
          organizationId,
          productId,
          supplierId: input.supplierId,
          supplierSku: input.supplierSku?.trim() || null,
          lastCostCents: input.lastCostCents,
          supplierUrl: input.supplierUrl?.trim() || null,
          notes: input.notes?.trim() || null,
          isPreferred: input.isPreferred,
        })
        .onConflictDoUpdate({
          target: [productSuppliers.productId, productSuppliers.supplierId],
          set: {
            supplierSku: input.supplierSku?.trim() || null,
            lastCostCents: input.lastCostCents,
            supplierUrl: input.supplierUrl?.trim() || null,
            notes: input.notes?.trim() || null,
            isPreferred: input.isPreferred,
          },
        })
        .returning();

      return link!;
    });
  }

  async unlinkProductSupplier(
    organizationId: string,
    productId: string,
    supplierId: string,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      await tx
        .delete(productSuppliers)
        .where(
          and(
            eq(productSuppliers.productId, productId),
            eq(productSuppliers.supplierId, supplierId),
          ),
        );

      await tx
        .update(products)
        .set({ preferredSupplierId: null, updatedAt: new Date() })
        .where(
          and(
            eq(products.id, productId),
            eq(products.preferredSupplierId, supplierId),
          ),
        );

      return { removed: true };
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

  async listSuppliers(organizationId: string, includeInactive = false) {
    return this.database.withTenant(organizationId, (tx) =>
      tx
        .select()
        .from(suppliers)
        .where(includeInactive ? undefined : eq(suppliers.isActive, true))
        .orderBy(desc(suppliers.createdAt)),
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
          websiteUrl: input.websiteUrl?.trim() || null,
          paymentTerms: input.paymentTerms?.trim() || null,
          acceptsMei: input.acceptsMei ?? true,
          notes: input.notes?.trim() || null,
        })
        .returning();
      return sup!;
    });
  }

  async updateSupplier(
    organizationId: string,
    supplierId: string,
    input: UpdateSupplierInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1);
      if (!existing) throw new NotFoundException('Fornecedor não encontrado.');

      const [updated] = await tx
        .update(suppliers)
        .set({
          name: input.name !== undefined ? input.name.trim() : existing.name,
          cnpj:
            input.cnpj !== undefined ? input.cnpj?.trim() || null : existing.cnpj,
          email:
            input.email !== undefined
              ? input.email
                ? input.email.trim().toLowerCase()
                : null
              : existing.email,
          phone:
            input.phone !== undefined
              ? input.phone?.trim() || null
              : existing.phone,
          leadTimeDays:
            input.leadTimeDays !== undefined
              ? input.leadTimeDays
              : existing.leadTimeDays,
          websiteUrl:
            input.websiteUrl !== undefined
              ? input.websiteUrl?.trim() || null
              : existing.websiteUrl,
          paymentTerms:
            input.paymentTerms !== undefined
              ? input.paymentTerms?.trim() || null
              : existing.paymentTerms,
          acceptsMei:
            input.acceptsMei !== undefined ? input.acceptsMei : existing.acceptsMei,
          notes:
            input.notes !== undefined
              ? input.notes?.trim() || null
              : existing.notes,
          isActive:
            input.isActive !== undefined ? input.isActive : existing.isActive,
        })
        .where(eq(suppliers.id, supplierId))
        .returning();

      return updated!;
    });
  }

  async deleteSupplier(organizationId: string, supplierId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1);
      if (!existing) throw new NotFoundException('Fornecedor não encontrado.');

      const [updated] = await tx
        .update(suppliers)
        .set({ isActive: false })
        .where(eq(suppliers.id, supplierId))
        .returning();

      return updated!;
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
