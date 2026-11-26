import { Global, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { appEnv } from '../config/env';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket = appEnv.S3_BUCKET;

  constructor() {
    this.client = new S3Client({
      endpoint: appEnv.S3_ENDPOINT,
      region: appEnv.S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: appEnv.S3_ACCESS_KEY,
        secretAccessKey: appEnv.S3_SECRET_KEY,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Bucket privado criado no S3: ${this.bucket}`);
      } catch (err) {
        this.logger.warn(
          `S3 indisponível no boot (${appEnv.S3_ENDPOINT}): ${(err as Error).message}`,
        );
      }
    }
  }

  async uploadObject(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );
    return params.key;
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}

@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
