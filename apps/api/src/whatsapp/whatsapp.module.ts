import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EvolutionMessagingProvider } from './messaging.provider';
import {
  QUEUE_OS_NOTIFICATIONS,
  QUEUE_WHATSAPP_INBOUND,
  WhatsappService,
} from './whatsapp.service';
import {
  OsNotificationsProcessor,
  WhatsappInboundProcessor,
} from './whatsapp.processor';
import { InboxController, WebhooksController } from './inbox.controller';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_OS_NOTIFICATIONS },
      { name: QUEUE_WHATSAPP_INBOUND },
    ),
  ],
  controllers: [InboxController, WebhooksController],
  providers: [
    EvolutionMessagingProvider,
    WhatsappService,
    OsNotificationsProcessor,
    WhatsappInboundProcessor,
  ],
  exports: [WhatsappService],
})
export class WhatsappModule {}
