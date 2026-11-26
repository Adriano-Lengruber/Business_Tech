import {
  Global,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  createDb,
  createDbPool,
  withTenantContext,
  type Database,
  type Pool,
} from '@al/database';
import { appEnv } from '../config/env';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  public readonly pool: Pool;
  public readonly db: Database;

  constructor() {
    this.pool = createDbPool(appEnv.DATABASE_URL);
    this.db = createDb(this.pool);
  }

  withTenant<T>(
    organizationId: string,
    fn: (tx: Database) => Promise<T>,
  ): Promise<T> {
    return withTenantContext(this.db, organizationId, fn);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
