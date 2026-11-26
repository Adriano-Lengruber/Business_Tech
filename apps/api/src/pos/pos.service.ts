import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  auditLogs,
  customers,
  desc,
  eq,
  financialTransactions,
  inArray,
  inventoryMovements,
  products,
  saleItems,
  sales,
  sql,
} from '@al/database';
import { calculatePosSaleTotals, type CreatePosSaleInput } from '@al/shared';
import { DatabaseService } from '../database/database.module';
import { AsaasPaymentProvider } from '../finance/payment.provider';

@Injectable()
export class PosService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AsaasPaymentProvider)
    private readonly paymentProvider: AsaasPaymentProvider,
  ) {}

  async listSales(organizationId: string) {
    return this.database.withTenant(organizationId, (tx) =>
      tx
        .select({
          id: sales.id,
          code: sales.code,
          status: sales.status,
          paymentMethod: sales.paymentMethod,
          subtotalCents: sales.subtotalCents,
          discountCents: sales.discountCents,
          totalCents: sales.totalCents,
          totalCostCents: sales.totalCostCents,
          createdAt: sales.createdAt,
          customerName: customers.name,
        })
        .from(sales)
        .leftJoin(customers, eq(sales.customerId, customers.id))
        .orderBy(desc(sales.createdAt))
        .limit(50),
    );
  }

  async createSale(
    organizationId: string,
    userId: string,
    input: CreatePosSaleInput,
  ) {
    const saleResult = await this.database.withTenant(
      organizationId,
      async (tx) => {
        const prodIds = input.items.map((i) => i.productId);
        const foundProducts = await tx
          .select()
          .from(products)
          .where(inArray(products.id, prodIds));

        const prodMap = new Map(foundProducts.map((p) => [p.id, p]));

        const calcInputs = input.items.map((item) => {
          const prod = prodMap.get(item.productId);
          if (!prod) {
            throw new NotFoundException(`Produto ${item.productId} não encontrado.`);
          }
          if (prod.stockQty < item.quantity) {
            throw new BadRequestException(
              `Estoque insuficiente para "${prod.name}" (disponível: ${prod.stockQty}).`,
            );
          }
          return {
            prod,
            quantity: item.quantity,
            unitCostCents: prod.costCents,
            unitPriceCents: item.unitPriceCents ?? prod.priceCents,
          };
        });

        const totals = calculatePosSaleTotals(calcInputs, input.discountCents);

        const countRes = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(sales);
        const nextNum = (countRes[0]?.count ?? 0) + 1;
        const code = `PDV-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

        const [sale] = await tx
          .insert(sales)
          .values({
            organizationId,
            customerId: input.customerId ?? null,
            code,
            status: 'COMPLETED',
            paymentMethod: input.paymentMethod,
            subtotalCents: totals.subtotalCents,
            discountCents: totals.discountCents,
            totalCents: totals.totalCents,
            totalCostCents: totals.totalCostCents,
          })
          .returning();

        await tx.insert(saleItems).values(
          calcInputs.map((ci) => ({
            organizationId,
            saleId: sale!.id,
            productId: ci.prod.id,
            quantity: ci.quantity,
            unitCostCents: ci.unitCostCents,
            unitPriceCents: ci.unitPriceCents,
            totalPriceCents: ci.quantity * ci.unitPriceCents,
          })),
        );

        for (const ci of calcInputs) {
          await tx
            .update(products)
            .set({
              stockQty: ci.prod.stockQty - ci.quantity,
              updatedAt: new Date(),
            })
            .where(eq(products.id, ci.prod.id));

          await tx.insert(inventoryMovements).values({
            organizationId,
            productId: ci.prod.id,
            type: 'sale',
            quantityDelta: -ci.quantity,
            unitCostCents: ci.unitCostCents,
            referenceType: 'pos_sale',
            referenceId: sale!.id,
            note: `Venda balcão ${code}`,
            actorId: userId,
          });
        }

        await tx.insert(auditLogs).values({
          organizationId,
          actorType: 'human',
          actorId: userId,
          action: 'pos.sale_completed',
          entityType: 'sale',
          entityId: sale!.id,
          afterState: {
            code,
            totalCents: totals.totalCents,
            paymentMethod: input.paymentMethod,
          },
        });

        return { sale: sale!, totals };
      },
    );

    if (saleResult.sale.totalCents > 0) {
      let pixCopyPaste: string | null = null;
      let gatewayChargeId: string | null = null;
      let gatewayProvider: string | null = null;

      if (input.paymentMethod === 'pix' && !input.paidImmediately) {
        const charge = await this.paymentProvider.createPixCharge({
          amountCents: saleResult.sale.totalCents,
          description: `Venda ${saleResult.sale.code}`,
          dueDate: new Date(),
          externalReference: saleResult.sale.id,
        });
        pixCopyPaste = charge.pixCopyPaste;
        gatewayChargeId = charge.chargeId;
        gatewayProvider = charge.provider;
      }

      await this.database.withTenant(organizationId, (tx) =>
        tx.insert(financialTransactions).values({
          organizationId,
          type: 'receivable',
          category: 'PDV / Varejo',
          description: `Venda PDV ${saleResult.sale.code}`,
          paymentMethod: input.paymentMethod,
          status: input.paidImmediately ? 'CONFIRMED' : 'PENDING',
          amountCents: saleResult.sale.totalCents,
          dueDate: new Date(),
          paidAt: input.paidImmediately ? new Date() : null,
          gatewayProvider,
          gatewayChargeId,
          pixCopyPaste,
        }),
      );
    }

    return saleResult;
  }
}
