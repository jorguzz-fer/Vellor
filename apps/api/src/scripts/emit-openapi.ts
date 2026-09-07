import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { createApp } from '../main';
import { buildOpenApiDocument } from '../openapi';

/** Gera apps/api/openapi.json (contrato versionado no repositório; a CI verifica se está atualizado). */
async function main(): Promise<void> {
  process.env.LOG_LEVEL = 'silent';
  const app = await createApp({ logger: false });
  const document = buildOpenApiDocument(app);
  const target = path.resolve(__dirname, '../../openapi.json');
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`OpenAPI gerado em ${target} (${Object.keys(document.paths).length} rotas)`);
  await app.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
