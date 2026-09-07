import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PinoLogger } from 'nestjs-pino';
import { AppConfig } from '../../config/app-config';
import { BadRequestError } from '../../common/errors';

export interface StoredFile {
  key: string;
  url: string;
}

export interface ImageType {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'image/gif';
  extension: string;
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Detecta o tipo real da imagem pelos bytes iniciais (não confia no Content-Type enviado). */
export function detectImageType(buffer: Buffer): ImageType | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  if (
    buffer.subarray(4, 8).toString('ascii') === 'ftyp' &&
    buffer.subarray(8, 12).toString('ascii').startsWith('avif')
  ) {
    return { mimeType: 'image/avif', extension: 'avif' };
  }
  if (
    buffer.subarray(0, 6).toString('ascii') === 'GIF89a' ||
    buffer.subarray(0, 6).toString('ascii') === 'GIF87a'
  ) {
    return { mimeType: 'image/gif', extension: 'gif' };
  }
  return null;
}

/** Armazena arquivos públicos (imagens de produto) em disco local ou em um bucket S3-compatível. */
@Injectable()
export class StorageService {
  private readonly s3: S3Client | null;
  private readonly localDir: string;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(StorageService.name);
    this.localDir = path.resolve(config.env.STORAGE_LOCAL_DIR);
    this.s3 =
      config.env.STORAGE_DRIVER === 's3'
        ? new S3Client({
            region: config.env.S3_REGION,
            endpoint: config.env.S3_ENDPOINT,
            forcePathStyle: config.env.S3_FORCE_PATH_STYLE,
            credentials: {
              accessKeyId: config.env.S3_ACCESS_KEY_ID!,
              secretAccessKey: config.env.S3_SECRET_ACCESS_KEY!,
            },
          })
        : null;
  }

  async putImage(
    buffer: Buffer,
    folder: string,
  ): Promise<StoredFile & ImageType & { sizeBytes: number }> {
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestError('Imagem muito grande (máximo 8 MB)', 'image_too_large');
    }
    const type = detectImageType(buffer);
    if (!type)
      throw new BadRequestError(
        'Formato de imagem não suportado (use JPG, PNG, WEBP ou AVIF)',
        'invalid_image',
      );
    const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, '');
    const key = `${safeFolder}/${randomUUID()}.${type.extension}`;
    const stored = await this.put(key, buffer, type.mimeType);
    return { ...stored, ...type, sizeBytes: buffer.length };
  }

  private async put(key: string, body: Buffer, contentType: string): Promise<StoredFile> {
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.config.env.S3_BUCKET!,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return { key, url: this.publicUrl(key) };
    }
    const target = path.join(this.localDir, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return { key, url: this.publicUrl(key) };
  }

  async delete(key: string): Promise<void> {
    try {
      if (this.s3) {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: this.config.env.S3_BUCKET!, Key: key }),
        );
      } else {
        await unlink(path.join(this.localDir, key));
      }
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Não foi possível remover o arquivo do storage');
    }
  }

  publicUrl(key: string): string {
    if (this.s3) {
      const base =
        this.config.env.S3_PUBLIC_URL ??
        `${this.config.env.S3_ENDPOINT?.replace(/\/$/, '')}/${this.config.env.S3_BUCKET}`;
      return `${base.replace(/\/$/, '')}/${key}`;
    }
    return `${this.config.apiPublicUrl}/uploads/${key}`;
  }
}
