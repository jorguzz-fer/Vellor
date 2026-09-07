import { DEFAULT_STORE_SETTINGS } from '@vellor/shared';
import { eq, sql } from 'drizzle-orm';
import { CryptoService } from '../common/crypto/crypto.service';
import { AppConfig } from '../config/app-config';
import { loadEnv } from '../config/env';
import { PasswordService } from '../modules/auth/password.service';
import { createDatabase, type Database } from './database.module';
import { runMigrations } from './migrate';
import {
  categories,
  collections,
  coupons,
  inventoryMovements,
  productVariants,
  products,
  settings,
  users,
} from './schema';
import { SEED_CATEGORIES, SEED_PRODUCTS } from './seed-data';

const DEV_ADMIN_EMAIL = 'admin@vellor.local';
const DEV_ADMIN_PASSWORD = 'VellorAdmin#2026';

export interface SeedOptions {
  /** Remove os produtos de demonstração (atributo _placeholder) em vez de criá-los. */
  removePlaceholders?: boolean;
  /** Não cria o catálogo de demonstração (apenas admin e configurações). */
  skipCatalog?: boolean;
  adminEmail?: string;
  adminPassword?: string;
  adminName?: string;
  /** Segredo TOTP já ativo para o admin (apenas testes). */
  adminMfaSecret?: string;
  encryptionKey?: string;
  log?: (message: string) => void;
}

export async function seed(db: Database, options: SeedOptions = {}): Promise<void> {
  const log = options.log ?? (() => undefined);

  // ---------- Configurações ----------
  await db
    .insert(settings)
    .values({ key: 'store', value: DEFAULT_STORE_SETTINGS })
    .onConflictDoNothing();
  log('Configurações padrão garantidas.');

  // ---------- Administrador ----------
  if (options.adminEmail && options.adminPassword) {
    const passwords = new PasswordService();
    const passwordHash = await passwords.hash(options.adminPassword);
    const email = options.adminEmail.toLowerCase();
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    const mfa =
      options.adminMfaSecret && options.encryptionKey
        ? {
            mfaSecretEncrypted: new CryptoService(
              new AppConfig({ ...loadEnv(), APP_ENCRYPTION_KEY: options.encryptionKey }),
            ).encrypt(options.adminMfaSecret),
            mfaEnabledAt: new Date(),
          }
        : {};
    if (!existing) {
      await db.insert(users).values({
        email,
        name: options.adminName ?? 'Administrador',
        passwordHash,
        role: 'admin',
        emailVerifiedAt: new Date(),
        ...mfa,
      });
      log(
        `Administrador criado: ${email}${options.adminMfaSecret ? ' (MFA pré-ativado para testes)' : ' (ative o MFA no primeiro acesso)'}.`,
      );
    } else if (options.adminMfaSecret && options.encryptionKey) {
      await db
        .update(users)
        .set({ ...mfa, updatedAt: new Date() })
        .where(eq(users.id, existing.id));
      log(`MFA do administrador ${email} redefinido para testes.`);
    } else if (existing.role !== 'admin') {
      await db
        .update(users)
        .set({ role: 'admin', updatedAt: new Date() })
        .where(eq(users.id, existing.id));
      log(`Usuário ${email} promovido a administrador.`);
    } else {
      log(`Administrador ${email} já existe.`);
    }
  }

  // ---------- Cupom de exemplo ----------
  await db
    .insert(coupons)
    .values({
      code: 'BEMVINDO10',
      description: '10% na primeira compra',
      type: 'percent',
      value: 10,
      maxUsesPerCustomer: 1,
      isActive: true,
    })
    .onConflictDoNothing();

  if (options.removePlaceholders) {
    const removed = await db
      .delete(products)
      .where(sql`${products.attributes} ->> '_placeholder' = 'sim'`)
      .returning({ id: products.id });
    log(`${removed.length} produto(s) de demonstração removido(s).`);
    return;
  }
  if (options.skipCatalog) return;

  // ---------- Categorias e coleções ----------
  const categoryIds = new Map<string, string>();
  const collectionIds = new Map<string, string>();
  for (const category of SEED_CATEGORIES) {
    const [row] = await db
      .insert(categories)
      .values({
        slug: category.slug,
        name: category.name,
        kind: category.kind,
        description: category.description,
        position: category.position,
      })
      .onConflictDoUpdate({
        target: categories.slug,
        set: { name: category.name, kind: category.kind, updatedAt: new Date() },
      })
      .returning({ id: categories.id });
    categoryIds.set(category.slug, row!.id);
    for (const [index, collection] of category.collections.entries()) {
      const [c] = await db
        .insert(collections)
        .values({
          categoryId: row!.id,
          slug: collection.slug,
          name: collection.name,
          description: collection.description,
          position: index,
        })
        .onConflictDoUpdate({
          target: [collections.categoryId, collections.slug],
          set: { name: collection.name, updatedAt: new Date() },
        })
        .returning({ id: collections.id });
      collectionIds.set(`${category.slug}/${collection.slug}`, c!.id);
    }
  }
  log(
    `${SEED_CATEGORIES.length} categorias e ${[...collectionIds.keys()].length} coleções garantidas.`,
  );

  // ---------- Produtos de demonstração ----------
  let created = 0;
  for (const product of SEED_PRODUCTS) {
    const exists = await db.query.products.findFirst({
      where: eq(products.slug, product.slug),
      columns: { id: true },
    });
    if (exists) continue;
    const [row] = await db
      .insert(products)
      .values({
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        categoryId: categoryIds.get(product.categorySlug)!,
        collectionId:
          collectionIds.get(`${product.categorySlug}/${product.collectionSlug}`) ?? null,
        status: 'active',
        shortDescription: product.shortDescription,
        description: product.description,
        priceCents: product.priceCents,
        compareAtPriceCents: product.compareAtPriceCents ?? null,
        isFeatured: product.isFeatured ?? false,
        isNew: product.isNew ?? false,
        isBestseller: product.isBestseller ?? false,
        attributes: product.attributes,
        weightGrams: product.weightGrams,
        lengthCm: product.dims[0],
        widthCm: product.dims[1],
        heightCm: product.dims[2],
        seoTitle: `${product.name} | Vellor`,
        seoDescription: product.shortDescription,
      })
      .returning({ id: products.id });
    for (const [index, variant] of product.variants.entries()) {
      const [v] = await db
        .insert(productVariants)
        .values({
          productId: row!.id,
          sku: variant.sku,
          name: variant.name,
          priceCents: variant.priceCents ?? null,
          stockQuantity: variant.stockQuantity,
          optionValues: variant.optionValues ?? {},
          position: index,
        })
        .returning({ id: productVariants.id });
      if (variant.stockQuantity > 0) {
        await db.insert(inventoryMovements).values({
          variantId: v!.id,
          delta: variant.stockQuantity,
          reason: 'Estoque inicial (seed)',
          referenceType: 'seed',
        });
      }
    }
    created++;
  }
  log(`${created} produto(s) de demonstração criado(s).`);
}

async function main(): Promise<void> {
  const env = loadEnv();
  const args = new Set(process.argv.slice(2));
  const adminEmail =
    env.ADMIN_EMAIL ?? (env.NODE_ENV === 'production' ? undefined : DEV_ADMIN_EMAIL);
  const adminPassword =
    env.ADMIN_PASSWORD ?? (env.NODE_ENV === 'production' ? undefined : DEV_ADMIN_PASSWORD);
  if (env.NODE_ENV === 'production' && (!adminEmail || !adminPassword)) {
    console.warn('ADMIN_EMAIL/ADMIN_PASSWORD não definidos: nenhum administrador será criado.');
  }
  const { client, db } = createDatabase(env.DATABASE_URL, { max: 1 });
  try {
    await runMigrations(db);
    await seed(db, {
      removePlaceholders: args.has('--remove-placeholders'),
      skipCatalog: args.has('--skip-catalog') || env.NODE_ENV === 'production',
      adminEmail,
      adminPassword,
      adminName: env.ADMIN_NAME,
      adminMfaSecret: env.NODE_ENV === 'production' ? undefined : env.ADMIN_MFA_SECRET,
      encryptionKey: env.APP_ENCRYPTION_KEY,
      log: (m) => console.log(m),
    });
    if (!env.ADMIN_EMAIL && env.NODE_ENV !== 'production') {
      console.log(`Admin de desenvolvimento: ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}`);
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
