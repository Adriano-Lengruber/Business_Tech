import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from '@al/database';
import { Public } from '../common/decorators/auth.decorators';
import { DatabaseService } from '../database/database.module';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check da API e conexão PostgreSQL' })
  async check() {
    await this.database.db.execute(sql`SELECT 1`);
    return {
      status: 'ok',
      service: 'al-business-os-api',
      timestamp: new Date().toISOString(),
    };
  }
}
