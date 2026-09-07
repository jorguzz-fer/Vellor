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

## 5. Importação em massa (opcional, próxima etapa)

Se o catálogo tiver muitos itens, podemos importar a planilha diretamente (CSV) em vez
de cadastrar um a um. Envie a planilha no formato acima e faremos a carga.
