import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { appEnv } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: [appEnv.APP_URL, 'http://localhost:3000'],
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AL Business OS API')
    .setDescription('API REST Modular Multi-Tenant com RBAC, RLS e IA Local-First')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(appEnv.API_PORT, '0.0.0.0');
  console.log(`AL Business OS API rodando em http://localhost:${appEnv.API_PORT}/api/v1`);
  console.log(`Swagger OpenAPI em http://localhost:${appEnv.API_PORT}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Erro ao iniciar API:', err);
  process.exit(1);
});
