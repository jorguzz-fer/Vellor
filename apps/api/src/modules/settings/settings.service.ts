import { Injectable } from '@nestjs/common';
import {
  DEFAULT_STORE_SETTINGS,
  type PublicSettings,
  type StoreSettings,
  StoreSettingsSchema,
  toPublicSettings,
} from '@vellor/shared';
import { eq } from 'drizzle-orm';
import { type Database, InjectDb } from '../../database/database.module';
import { settings } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';

const SETTINGS_KEY = 'store';
const CACHE_TTL_MS = 30_000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Mescla profundamente `patch` sobre `base` (arrays são substituídos, não mesclados). */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch))
    return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? deepMerge(out[key], value) : value;
  }
  return out as T;
}

@Injectable()
export class SettingsService {
  private cache: { value: StoreSettings; expiresAt: number } | null = null;

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<StoreSettings> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.value;
    const row = await this.db.query.settings.findFirst({ where: eq(settings.key, SETTINGS_KEY) });
    const merged = deepMerge(DEFAULT_STORE_SETTINGS, row?.value ?? {});
    const parsed = StoreSettingsSchema.safeParse(merged);
    const value = parsed.success ? parsed.data : DEFAULT_STORE_SETTINGS;
    this.cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  }

  async getPublic(): Promise<PublicSettings> {
    return toPublicSettings(await this.get());
  }

  async update(input: StoreSettings, actor: AuthUser, ip?: string): Promise<StoreSettings> {
    const value = StoreSettingsSchema.parse(input);
    await this.db
      .insert(settings)
      .values({ key: SETTINGS_KEY, value, updatedBy: actor.id, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedBy: actor.id, updatedAt: new Date() },
      });
    this.cache = null;
    await this.audit.record({
      actor,
      action: 'settings.update',
      entity: 'settings',
      entityId: SETTINGS_KEY,
      summary: 'Configurações da loja atualizadas',
      ip,
    });
    return value;
  }

  invalidate(): void {
    this.cache = null;
  }
}
