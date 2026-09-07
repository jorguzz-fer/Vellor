# Guia do catálogo — o que precisamos para cadastrar os produtos

O sistema já está pronto para receber o catálogo real. Enquanto isso, a loja usa
**produtos de demonstração** (marcados internamente com `_placeholder`), que podem ser
removidos com `pnpm --filter @vellor/api db:seed -- --remove-placeholders`.

## 1. Fotos

- Formato JPG ou WEBP, fundo neutro, mínimo **1600 × 1600 px** (quadrada), até 8 MB.
- Por produto: 1 foto principal + 3 a 6 detalhes (mostrador/caixa/pulseira/fundo para
  relógios; frasco/caixa/lacre para perfumes). Nomeie os arquivos com o SKU
  (`VS-CH-001-01.jpg`).
- Se houver variações com aparência diferente (cor de mostrador, tamanho de frasco),
  envie uma foto por variação e informe a qual variação pertence.
- Não temos processamento automático de imagem na v1: envie já otimizadas
  (ex.: exporte em WEBP 85% ou JPG 80%).

## 2. Planilha por produto

Campos comuns: nome, marca, categoria (Relógios ou Perfumes de Nicho), coleção,
descrição curta (até 300 caracteres), descrição completa, preço (R$), preço "de"
(opcional), destaque / novidade / mais vendido (sim/não), peso (g) e dimensões da
embalagem (cm) para o frete, título e descrição para SEO (opcionais).

Variações: SKU (único), nome da variação (ex.: "Mostrador azul", "100 ml"), preço
próprio (se diferente), estoque.

Ficha técnica de **relógios**: referência, movimento, calibre, reserva de marcha,
funções, material da caixa, diâmetro (mm), espessura (mm), vidro, resistência à água,
cor do mostrador, pulseira, fecho, público, condição (novo/seminovo/vintage), caixa e
documentos, ano, garantia.

Ficha técnica de **perfumes**: concentração, família olfativa, notas de saída/coração/
fundo, fixação, projeção, perfumista, país de origem, ano de lançamento, público,
estado (lacrado/sem lacre/testado).

## 3. Cadastro no Admin

1. _Categorias e coleções_: ajuste nomes/ordem das coleções (já existem sugestões).
2. _Produtos > Novo produto_: preencha as seções, cadastre as variações com estoque
   inicial, salve e então envie as imagens (arraste ou selecione vários arquivos).
   Marque a imagem de cada variação, se houver.
3. Deixe como **Rascunho** até revisar; publique mudando o status para **Publicado**.
4. Ajustes de estoque posteriores: botão _Ajustar estoque_ (sempre com motivo, fica na auditoria).

## 4. Textos e dados da loja

No Admin > Configurações: razão social, CNPJ, endereço (obrigatórios no rodapé por lei),
e-mail e WhatsApp de atendimento, horário, texto do anúncio no topo, CEP de origem e
regras de frete/seguro, parcelamento (máximo de parcelas, valor mínimo da parcela,
juros repassados ou não, desconto no Pix), e os três textos legais (privacidade,
termos de compra, trocas e devoluções). Os trechos marcados com **‹decidir›** precisam
ser substituídos antes do go-live.

## 5. Importação em massa a partir de pastas de fotos

Quando as fotos já estiverem organizadas em uma pasta por produto, o script
`import-catalog` cria os produtos de uma vez. Ele roda dentro do container da API, lê
qualquer estrutura de diretórios e trata cada pasta com imagens como um produto, com as
fotos na ordem alfabética do nome do arquivo.

```bash
# extraia as fotos em um diretório dentro do container da API
docker exec <api> mkdir -p /tmp/fotos
docker cp fotos.tar.gz <api>:/tmp/fotos.tar.gz
docker exec <api> tar xzf /tmp/fotos.tar.gz -C /tmp/fotos

# confira o que seria criado, sem gravar nada
docker exec <api> node dist/scripts/import-catalog.js /tmp/fotos --dry-run

# importe
docker exec <api> node dist/scripts/import-catalog.js /tmp/fotos --category relogios
```

Cada produto nasce com a marca da loja (`--brand`, padrão Vellor), nome derivado da
pasta, uma variação única com estoque, preço estável sorteado na faixa informada e uma
ficha técnica coerente com o tipo da categoria. Nada disso é definitivo: o objetivo é ter
o catálogo navegável rápido, e todos os campos são editáveis no Admin depois.

| Opção                         | Para que serve                                 |
| ----------------------------- | ---------------------------------------------- |
| `--category` / `--collection` | destino dos produtos (padrão: `relogios`)      |
| `--brand`                     | marca gravada nos produtos (padrão: `Vellor`)  |
| `--status`                    | `active` ou `draft` (padrão: `active`)         |
| `--min-price` / `--max-price` | faixa de preço em reais (padrão: 8000 a 60000) |
| `--stock`                     | estoque inicial de cada variação (padrão: 3)   |
| `--tag`                       | rótulo da carga, usado para desfazer           |
| `--dry-run`                   | só mostra o que faria                          |

Rodar de novo não duplica nada: produtos cujo slug já existe são pulados. A carga é
reversível pelo rótulo, o que também apaga as imagens do storage:

```bash
docker exec <api> node dist/scripts/import-catalog.js --remove --tag import
```

Use apenas fotos próprias ou licenciadas. Imagens de catálogos de terceiros pertencem a
quem as produziu, e nomes de marcas registradas não devem ser aplicados a peças que não
sejam originais daquela marca.
