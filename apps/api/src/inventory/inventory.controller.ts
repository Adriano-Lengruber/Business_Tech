import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  consumeOsPartSchema,
  createProductSchema,
  createPurchaseOrderSchema,
  createStockMovementSchema,
  createSupplierSchema,
} from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { InventoryService } from './inventory.service';

@ApiTags('Estoque & Compras')
@ApiBearerAuth()
@RequireModule('mod-inventory-pos')
@Controller()
export class InventoryController {
  constructor(
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService,
  ) {}

  @Get('inventory/products')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Listar/buscar produtos e peças com alerta de estoque mínimo' })
  listProducts(
    @Query('q') q: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.listProducts(user.organizationId, q);
  }

  @Post('inventory/products')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Cadastrar produto/peça com NCM/CFOP e estoque inicial' })
  createProduct(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.inventoryService.createProduct(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Post('inventory/movements')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Registrar entrada/saída/ajuste atômico no ledger de estoque' })
  recordMovement(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = createStockMovementSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.inventoryService.recordMovement(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Post('service-orders/:osId/consume-part')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Baixar peça do estoque diretamente na Ordem de Serviço' })
  consumeOsPart(
    @Param('osId') osId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = consumeOsPartSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.inventoryService.consumePartInServiceOrder(
      user.organizationId,
      osId,
      user.userId,
      parsed.data,
    );
  }

  @Get('inventory/suppliers')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Listar fornecedores' })
  listSuppliers(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.listSuppliers(user.organizationId);
  }

  @Post('inventory/suppliers')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Cadastrar fornecedor' })
  createSupplier(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createSupplierSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.inventoryService.createSupplier(user.organizationId, parsed.data);
  }

  @Get('inventory/purchase-orders')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Listar pedidos de compra' })
  listPurchaseOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.listPurchaseOrders(user.organizationId);
  }

  @Post('inventory/purchase-orders')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Criar pedido de compra com fornecedor' })
  createPurchaseOrder(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = createPurchaseOrderSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.inventoryService.createPurchaseOrder(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Post('inventory/purchase-orders/:id/receive')
  @RequirePermission('inventory:write')
  @ApiOperation({
    summary: 'Receber pedido de compra: incrementa estoque e cria conta a pagar',
  })
  receivePurchaseOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.receivePurchaseOrder(
      user.organizationId,
      id,
      user.userId,
    );
  }
}
