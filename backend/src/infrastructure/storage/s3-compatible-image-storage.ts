import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import type { ImageStorageService } from "../../ports/image-storage.service";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
};

export class S3CompatibleImageStorage implements ImageStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: R2Config) {
    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl.replace(/\/$/, "");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  async uploadImage(file: Buffer, mimeType: string): Promise<string> {
    const extension = mimeType.split("/")[1] ?? "bin";
    const key = `uploads/${randomUUID()}.${extension}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: mimeType
      })
    );
    return `${this.publicUrl}/${key}`;
  }

  async deleteImage(url: string): Promise<void> {
    const prefix = `${this.publicUrl}/`;
    if (!url.startsWith(prefix)) {
      return;
    }
    const key = url.slice(prefix.length);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      })
    );
  }
}