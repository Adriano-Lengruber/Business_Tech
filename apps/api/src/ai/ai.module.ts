import { Global, Module } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

@Global()
@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, AuthService],
  exports: [KnowledgeService],
})
export class AiModule {}
