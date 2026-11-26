import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  loginSchema,
  registerOrganizationSchema,
} from '@al/shared';
import {
  CurrentUser,
  Public,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Autenticar usuário e obter token + módulos ativos' })
  async login(@Body() body: unknown) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.authService.login(parsed.data);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Criar nova organização multi-tenant + usuário owner' })
  async register(@Body() body: unknown) {
    const parsed = registerOrganizationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.authService.registerOrganization(parsed.data);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Obter sessão atual, papel RBAC e módulos ativos' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    const enabledModules = await this.authService.getEnabledModules(
      user.organizationId,
    );
    return { user, enabledModules };
  }
}
