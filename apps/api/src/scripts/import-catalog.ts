/**
 * Importa um diretório de imagens como produtos do catálogo.
 *
 * Cada subpasta que contenha imagens vira um produto, com uma variação única e as fotos na
 * ordem alfabética do nome do arquivo. Os produtos nascem com a marca da própria loja: nenhum
 * nome de marca de terceiros é inventado a partir do nome da pasta.
 *
 * Uso (dentro do container da API):
 *   node dist/scripts/import-catalog.js <diretório> [opções]
 *
 * Opções:
 *   --category <slug>    Categoria de destino (padrão: relogios)
 *   --collection <slug>  Coleção dentro da categoria (opcional)
 *   --brand <nome>       Marca gravada nos produtos (padrão: Vellor)
 *   --status <estado>    active ou draft (padrão: active)
 *   --min-price <reais>  Menor preço sorteado (padrão: 8000)
 *   --max-price <reais>  Maior preço sorteado (padrão: 60000)
 *   --stock <n>          Estoque inicial de cada variação (padrão: 3)
 *   --tag <nome>         Marca os produtos com este rótulo (padrão: import)
 *   --dry-run            Só mostra o que faria, sem gravar nada
 *   --remove             Remove os produtos do rótulo informado em --tag
 *
 * O rótulo fica em `attributes._imported`, o que torna a importação reversível:
 *   node dist/scripts/import-catalog.js --remove --tag import
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProductAttributes } from '@vellor/shared';
import { slugify } from '@vellor/shared';
import { eq, inArray, sql } from 'drizzle-orm';
import type { PinoLogger } from 'nestjs-pino';
import { AppConfig } from '../config/app-config';
import { loadEnv } from '../config/env';
import { createDatabase, type Database } from '../database/database.module';
import {
  categories,
  collections,
  inventoryMovements,
  productImages,
  productVariants,
  products,
} from '../database/schema';
import { StorageService } from '../modules/storage/storage.service';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

/** Linhas da casa: nomes neutros, sem qualquer referência a marcas de terceiros. */
const MODEL_LINES = [
  'Heritage',
  'Meridian',
  'Aurora',
  'Nocturne',
  'Solaris',
  'Regata',
  'Vertex',
  'Sereno',
  'Aviador',
  'Cronos',
  'Atlântico',
  'Império',
] as const;

const MOVEMENTS = ['Automático', 'Automático com cronógrafo', 'Corda manual', 'Quartzo'] as const;
const CASE_MATERIALS = [
  'Aço inoxidável 316L',
  'Aço inoxidável 904L',
  'Titânio grau 5',
  'Aço com PVD dourado',
] as const;
const DIAL_COLORS = [
  'Preto fosco',
  'Azul sunburst',
  'Prata escovado',
  'Verde esmeralda',
  'Champanhe',
] as const;
const STRAPS = [
  'Aço com fecho borboleta',
  'Couro italiano costurado à mão',
  'Borracha vulcanizada',
  'Malha milanesa',
] as const;
const WATER_RESISTANCE = ['50 m', '100 m', '200 m', '300 m'] as const;

const CONCENTRATIONS = ['Eau de Parfum', 'Extrait de Parfum', 'Parfum'] as const;
const OLFACTORY_FAMILIES = ['Amadeirado', 'Oriental', 'Chipre', 'Âmbar', 'Couro'] as const;
const SILLAGE = ['Moderado', 'Forte', 'Íntimo'] as const;

/** Hash estável (FNV-1a) para que preço e ficha técnica não mudem entre execuções. */
function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(Math.trunc(seed)) % list.length]!;
}

/** Últimos dígitos do nome da pasta viram a referência do modelo; sem dígitos, usa o hash. */
function referenceOf(folder: string, seed: number): string {
  const digits = folder.match(/(\d{2,})\s*$/)?.[1];
  return digits ?? String(seed % 10000).padStart(4, '0');
}

interface Options {
  dir: string;
  categorySlug: string;
  collectionSlug: string | null;
  brand: string;
  status: 'active' | 'draft';
  minPriceCents: number;
  maxPriceCents: number;
  stock: number;
  tag: string;
  dryRun: boolean;
  remove: boolean;
}

function parseArgs(argv: string[]): Options {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (key === 'dry-run' || key === 'remove') {
      flags.set(key, 'true');
      continue;
    }
    flags.set(key, argv[++i] ?? '');
  }
  const reais = (key: string, fallback: number) => {
    const raw = flags.get(key);
    const value = raw ? Number(raw) : fallback;
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Valor inválido em --${key}`);
    return Math.round(value * 100);
  };
  const status = flags.get('status') ?? 'active';
  if (status !== 'active' && status !== 'draft')
    throw new Error('--status aceita apenas "active" ou "draft"');
  const minPriceCents = reais('min-price', 8000);
  const maxPriceCents = reais('max-price', 60000);
  if (maxPriceCents < minPriceCents) throw new Error('--max-price deve ser maior que --min-price');
  return {
    dir: positional[0] ?? '',
    categorySlug: flags.get('category') ?? 'relogios',
    collectionSlug: flags.get('collection') || null,
    brand: flags.get('brand') ?? 'Vellor',
    status,
    minPriceCents,
    maxPriceCents,
    stock: Math.max(0, Math.round(Number(flags.get('stock') ?? 3))),
    tag: flags.get('tag') || 'import',
    dryRun: flags.has('dry-run'),
    remove: flags.has('remove'),
  };
}

interface Album {
  folder: string;
  files: string[];
}

/** Percorre o diretório e devolve toda pasta que contenha imagens, em qualquer profundidade. */
async function findAlbums(root: string): Promise<Album[]> {
  const albums: Album[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map((e) => path.join(dir, e.name))
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    if (files.length > 0) albums.push({ folder: path.basename(dir), files });
    for (const entry of entries) {
      if (entry.isDirectory()) await walk(path.join(dir, entry.name));
    }
  };
  await walk(root);
  return albums.sort((a, b) => a.folder.localeCompare(b.folder, 'pt-BR', { numeric: true }));
}

interface GeneratedSpec {
  attributes: ProductAttributes;
  shortDescription: string;
}

/** Ficha técnica plausível e estável por pasta, no formato que a loja já sabe exibir. */
function buildSpec(kind: string, reference: string, seed: number, tag: string): GeneratedSpec {
  if (kind === 'perfume') {
    const concentration = pick(CONCENTRATIONS, seed);
    const family = pick(OLFACTORY_FAMILIES, seed >>> 3);
    const volume = pick([50, 75, 100, 125], seed >>> 5);
    return {
      attributes: {
        _imported: tag,
        reference,
        concentration,
        olfactoryFamily: family,
        volume,
        sillage: pick(SILLAGE, seed >>> 7),
        longevity: `${6 + (seed % 7)} a ${10 + (seed % 7)} horas`,
      },
      shortDescription: `${concentration} ${family.toLowerCase()}, ${volume} ml.`,
    };
  }
  const movement = pick(MOVEMENTS, seed);
  const caseMaterial = pick(CASE_MATERIALS, seed >>> 3);
  const caseDiameter = 38 + (seed % 7);
  return {
    attributes: {
      _imported: tag,
      reference,
      movement,
      calibre: `VL-${1000 + (seed % 9000)}`,
      powerReserve: `${38 + (seed % 5) * 6} horas`,
      caseMaterial,
      caseDiameter,
      caseThickness: Number((9 + (seed % 40) / 10).toFixed(1)),
      crystal: 'Safira com tratamento antirreflexo',
      waterResistance: pick(WATER_RESISTANCE, seed >>> 5),
      dialColor: pick(DIAL_COLORS, seed >>> 7),
      strap: pick(STRAPS, seed >>> 9),
    },
    shortDescription: `${movement} em ${caseMaterial.toLowerCase()}, ${caseDiameter} mm.`,
  };
}

async function removeImported(db: Database, storage: StorageService, options: Options) {
  const rows = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(sql`${products.attributes} ->> '_imported' = ${options.tag}`);
  if (rows.length === 0) {
    console.log(`Nenhum produto com o rótulo "${options.tag}".`);
    return;
  }
  if (options.dryRun) {
    console.log(`[simulação] removeria ${rows.length} produto(s) do rótulo "${options.tag}".`);
    return;
  }
  const ids = rows.map((r) => r.id);
  const images = await db
    .select({ storageKey: productImages.storageKey })
    .from(productImages)
    .where(inArray(productImages.productId, ids));
  // As linhas somem por cascade; os arquivos precisam ser apagados um a um.
  await db.delete(products).where(inArray(products.id, ids));
  for (const image of images) await storage.delete(image.storageKey);
  console.log(`${rows.length} produto(s) e ${images.length} imagem(ns) removidos.`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const config = new AppConfig(env);
  // Script de linha de comando: o logger do Nest não está disponível fora da aplicação.
  const logger = {
    setContext: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  } as unknown as PinoLogger;
  const storage = new StorageService(config, logger);
  const { client, db } = createDatabase(env.DATABASE_URL, { max: 1 });

  try {
    if (options.remove) {
      await removeImported(db, storage, options);
      return;
    }
    if (!options.dir) throw new Error('Informe o diretório com as imagens.');

    const category = await db.query.categories.findFirst({
      where: eq(categories.slug, options.categorySlug),
    });
    if (!category) throw new Error(`Categoria "${options.categorySlug}" não encontrada.`);
    const collection = options.collectionSlug
      ? await db.query.collections.findFirst({
          where: eq(collections.slug, options.collectionSlug),
        })
      : null;
    if (options.collectionSlug && !collection)
      throw new Error(`Coleção "${options.collectionSlug}" não encontrada.`);

    const albums = await findAlbums(path.resolve(options.dir));
    if (albums.length === 0) throw new Error('Nenhuma pasta com imagens encontrada.');
    const totalFiles = albums.reduce((sum, a) => sum + a.files.length, 0);
    console.log(`${albums.length} pasta(s) e ${totalFiles} imagem(ns) encontradas.`);

    let created = 0;
    let skipped = 0;
    let uploaded = 0;
    const priceRange = options.maxPriceCents - options.minPriceCents;

    for (const album of albums) {
      const seed = hashOf(album.folder);
      const reference = referenceOf(album.folder, seed);
      const line = pick(MODEL_LINES, seed >>> 11);
      const name = `${options.brand} ${line} ${reference}`;
      const slug = slugify(name);

      const exists = await db.query.products.findFirst({
        where: eq(products.slug, slug),
        columns: { id: true },
      });
      if (exists) {
        skipped++;
        continue;
      }

      // Preço estável por pasta, arredondado para a dezena de reais mais próxima.
      const priceCents = Math.round((options.minPriceCents + (seed % priceRange)) / 1000) * 1000;
      const { attributes, shortDescription } = buildSpec(
        category.kind,
        reference,
        seed,
        options.tag,
      );

      if (options.dryRun) {
        console.log(
          `[simulação] ${name} · ${album.files.length} foto(s) · R$ ${(priceCents / 100).toFixed(2)}`,
        );
        created++;
        continue;
      }

      const [product] = await db
        .insert(products)
        .values({
          slug,
          name,
          brand: options.brand,
          categoryId: category.id,
          collectionId: collection?.id ?? null,
          status: options.status,
          shortDescription,
          description:
            'Peça da curadoria Vellor. Descrição e ficha técnica podem ser ajustadas no painel administrativo.',
          priceCents,
          attributes,
          seoTitle: `${name} | Vellor`,
          seoDescription: shortDescription,
        })
        .returning({ id: products.id });

      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product!.id,
          sku: slug.toUpperCase(),
          name: 'Único',
          stockQuantity: options.stock,
        })
        .returning({ id: productVariants.id });
      if (options.stock > 0) {
        await db.insert(inventoryMovements).values({
          variantId: variant!.id,
          delta: options.stock,
          reason: 'Estoque inicial (importação de catálogo)',
          referenceType: 'import',
        });
      }

      for (const [index, file] of album.files.entries()) {
        const buffer = await readFile(file);
        try {
          const stored = await storage.putImage(buffer, `produtos/${slug}`);
          await db.insert(productImages).values({
            productId: product!.id,
            storageKey: stored.key,
            url: stored.url,
            alt: name,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            position: index,
          });
          uploaded++;
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          console.warn(`  imagem ignorada (${path.basename(file)}): ${reason}`);
        }
      }
      created++;
      console.log(`${name} · ${album.files.length} foto(s)`);
    }

    console.log(
      options.dryRun
        ? `[simulação] ${created} produto(s) seriam criados, ${skipped} já existem.`
        : `${created} produto(s) criados, ${skipped} já existiam, ${uploaded} imagem(ns) enviadas.`,
    );
    if (!options.dryRun && created > 0) {
      console.log(
        `Para desfazer: node dist/scripts/import-catalog.js --remove --tag ${options.tag}`,
      );
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
