import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import {
  consumeOsPartSchema,
  createProductSchema,
  createPurchaseOrderSchema,
  createStockMovementSchema,
  createSupplierSchema,
  linkProductSupplierSchema,
  updateProductSchema,
  updateSupplierSchema,
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
    @Query('includeInactive') includeInactive: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.listProducts(
      user.organizationId,
      q,
      includeInactive === 'true',
    );
  }

  @Post('inventory/products')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Cadastrar produto/peça com preços, descrição, fornecedor e estoque' })
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

  @Patch('inventory/products/:id')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Editar produto, preços, descrição e fornecedor preferencial' })
  updateProduct(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.inventoryService.updateProduct(
      user.organizationId,
      id,
      user.userId,
      parsed.data,
    );
  }

  @Delete('inventory/products/:id')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Inativar produto do catálogo preservando histórico fiscal e OS' })
  deleteProduct(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.deleteProduct(
      user.organizationId,
      id,
      user.userId,
    );
  }

  @Post('inventory/products/:id/image')
  @RequirePermission('inventory:write')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload de foto do produto para bucket S3 privado' })
  async uploadProductImage(
    @Param('id') id: string,
    @Req()
    req: FastifyRequest & {
      file: () => Promise<
        | {
            filename: string;
            mimetype: string;
            toBuffer: () => Promise<Buffer>;
          }
        | undefined
      >;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException('Nenhuma imagem enviada.');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Apenas arquivos de imagem são permitidos.');
    }
    const buffer = await file.toBuffer();
    if (buffer.length > 8 * 1024 * 1024) {
      throw new BadRequestException('Imagem excede o limite de 8MB.');
    }
    return this.inventoryService.uploadProductImage({
      organizationId: user.organizationId,
      productId: id,
      userId: user.userId,
      filename: file.filename,
      mimeType: file.mimetype,
      buffer,
    });
  }

  @Get('inventory/products/:id/movements')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Histórico Kardex de movimentações de estoque do produto' })
  getProductMovements(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.getProductMovements(user.organizationId, id);
  }

  @Post('inventory/products/:id/suppliers')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Vincular fornecedor B2B e SKU/custo ao produto' })
  linkProductSupplier(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = linkProductSupplierSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.inventoryService.linkProductSupplier(
      user.organizationId,
      id,
      parsed.data,
    );
  }

  @Delete('inventory/products/:id/suppliers/:supplierId')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Desvincular fornecedor do produto' })
  unlinkProductSupplier(
    @Param('id') id: string,
    @Param('supplierId') supplierId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.unlinkProductSupplier(
      user.organizationId,
      id,
      supplierId,
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
  listSuppliers(
    @Query('includeInactive') includeInactive: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.listSuppliers(
      user.organizationId,
      includeInactive === 'true',
    );
  }

  @Post('inventory/suppliers')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Cadastrar fornecedor B2B / distribuidor' })
  createSupplier(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createSupplierSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.inventoryService.createSupplier(user.organizationId, parsed.data);
  }

  @Patch('inventory/suppliers/:id')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Atualizar dados do fornecedor B2B' })
  updateSupplier(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = updateSupplierSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.inventoryService.updateSupplier(
      user.organizationId,
      id,
      parsed.data,
    );
  }

  @Delete('inventory/suppliers/:id')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Inativar fornecedor preservando pedidos históricos' })
  deleteSupplier(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.deleteSupplier(user.organizationId, id);
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
