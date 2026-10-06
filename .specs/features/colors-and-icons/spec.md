# Cores e ícones: categorias, contas e bancos (colors-and-icons) Specification

Origem: `docs/v1/plano-implementacao.md` (F4, itens C1 a C3 e a tabela de decisões) e `docs/v1/bugs-e-melhorias.md` (seções Transações, Categorias e Contas, e as respostas do Q&A: "Paleta", "Ícones"). Escopo: `supabase/migrations/0008_colors.sql`, `api/` (módulos `accounts` e `categories`, constante da paleta, `openapi.json`), `web/src/` (paleta, `ColorPicker`, `CategoryBadge`, `BankIcon`, formulários, selects, extrato, lista de contas, preview do import, mocks e tipos) e `web/src/assets/banks/` (SVGs e `NOTICE`).

## Problem Statement

Categorias e contas só têm nome: no extrato, nos selects e no preview do import tudo aparece como texto igual, e o usuário não distingue uma categoria ou uma conta de relance. O usuário quer escolher uma cor para cada categoria e cada conta (dentro de uma paleta fixa), ver as categorias como badges coloridos em todo select e coluna do extrato, e reconhecer o banco de cada conta pelo ícone, no extrato, na lista de contas e no seletor de conta.

## Goals

- [ ] `categories.color` e `accounts.color` existem no banco como chave da paleta (22 chaves: uma por família do Tailwind, sempre na tonalidade 400; revisão `docs/v1/ajustes-pontuais.md`), nunca como hex livre, com `check` no banco, linhas existentes preenchidas e novos usuários com as categorias padrão já coloridas.
- [ ] A API aceita e devolve `color` em contas e categorias, valida contra a lista de chaves (422 com o campo) e a lista da API, a do banco e a do `web/` não divergem (testes falham se divergirem).
- [ ] Os formulários de conta e de categoria têm um `ColorPicker` acessível (grade da paleta, nomes em português, estado selecionado, operável por teclado).
- [ ] Toda categoria mostrada em um select (extrato: linha, modal, filtro, aplicar em massa; formulários de despesa de cartão; import) aparece como `CategoryBadge` colorido, legível no tema claro e no escuro, a partir de um único mapa de 22 classes literais.
- [ ] Todo lugar que mostra uma conta (extrato, lista de contas, seletor de conta) mostra o `BankIcon` do banco (Nubank, Sofisa Direto, Neon e XP com SVG local; `Outro` com ícone genérico) e a cor da conta como detalhe visual.
- [ ] Os SVGs dos bancos são arquivos locais versionados com `NOTICE` (origem e confirmação do dono), pequenos e sem script nem referência externa.

## Out of Scope

Explicitamente excluído para evitar crescimento de escopo.

| Feature | Reason |
| ------- | ------ |
| Cor livre (hex ou seletor de cor do navegador) | Decisão do dono: só a paleta; o banco guarda a chave |
| Cor ou badge em `transactions`, `credit_expenses`, dashboards e gráficos | Não pedido; o pedido cobre categorias e contas e os selects/colunas do extrato e do import |
| Mudar a tabela de despesas de cartão e a de retornos de investimento (texto `categoryName` / `accountNickname`) | Essas tabelas só recebem o nome na API; os formulários delas usam `CategorySelect`/`AccountSelect` e ganham badge e ícone pelos componentes compartilhados |
| Devolver `categoryColor`, `accountColor` ou `accountBank` nas respostas de transações | O extrato já tem `accountId` e `categoryId` e resolve cor e banco pelas listas de contas e categorias, sem mudar o contrato de transações |
| Cor ou ícone em `GET /imports` e na lista "Arquivos importados" | Não pedido |
| Cor da categoria de sistema editável pelo usuário | O RLS e a regra `category_protected` impedem alterar categorias de sistema; elas ganham cor fixa na migration |
| Upload de ícone ou logo personalizado | Não pedido; só os quatro bancos do enum e o genérico |
| Ícones para outros bancos do repositório de logos (Inter, C6, Itaú, etc.) | `Account.bank` só tem Nubank, SofisaDireto, Neon, XP e Other; novos bancos entram com a feature que ampliar o enum |
| Cores diferentes por tema (a cor guardada ser outra no escuro) | A chave é única; a legibilidade nos dois temas vem do mapa de classes |
| Reordenar ou filtrar categorias e contas por cor | Não pedido |
| Migrar os dados para a produção (`supabase db push`) e redeploy | Passo manual do dono após o merge, como nas outras features |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida ou registrada aqui.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Paleta | 22 famílias do Tailwind (red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose, slate, gray, zinc, neutral, stone) × uma única tonalidade, 400 = 22 chaves no formato `<família>-400` em minúsculas (ex.: `blue-400`) | Decisão do dono (plano e Q&A); revisada em `docs/v1/ajustes-pontuais.md` (antes 66 chaves em 400, 600 e 900); migration `0009_palette_400.sql` | y |
| O que o banco guarda | A chave, nunca hex; comparação exata e sensível a caixa: `Blue-400`, ` blue-400`, `blue-500`, `blue-600`, `blue-900`, `blue` e `#60a5fa` são inválidos | Decisão do dono; chave exata evita variantes que o mapa de classes não conhece (L-004: regra de igualdade declarada) | y |
| Itens de cor de categoria | Um só item: a mesma coluna e o mesmo seletor atendem "adicionar opção de cores" e "selecionar cores da paleta" | Decisão do dono (Q&A) | y |
| Tipo da coluna e `check` | `create domain public.palette_color as text check (value in (<22 chaves>))`; as colunas usam o domínio; a lista de chaves existe uma única vez no SQL | Duas tabelas com a mesma lista sem copiar; violação continua sendo erro de check (23514) | n |
| Nulidade e padrão | `color public.palette_color not null default 'slate-400'` nas duas tabelas (padrão `slate-600` na 0008, movido para `slate-400` pela 0009) | Sem `null` para tratar na API, no mapa e nos testes; `slate-400` é neutro e a única tonalidade da paleta | n |
| Preenchimento das linhas existentes | Categorias com `key` conhecida recebem a cor da tabela do design (17 cores distintas); categorias de usuário (sem `key`) ficam `slate-400`; contas recebem a cor por banco (Nubank `purple-400`, SofisaDireto `teal-400`, Neon `sky-400`, XP `zinc-400`, Other `slate-400`); a 0009 converte os valores já gravados pela 0008 (`-600` e `-900`) para `<família>-400`, mantendo a família escolhida | "Cores padrão determinísticas por `key`" do plano; por banco o usuário já reconhece a conta antes de escolher | n |
| Categorias semeadas para novos usuários | A função `seed_categories` (a que insere as 17 categorias; `handle_new_user` só a chama e não muda) é redefinida na 0008 com a coluna `color` e a mesma tabela de cores do preenchimento; o resto do comportamento (chaves, nomes, `is_system`, `on conflict do nothing`, revogação de execução) fica igual | A definição vigente está na 0002; a 0007 não a altera | n |
| Quais categorias contam como "de sistema" para a cor | Todas as 17 semeadas ganham cor própria; as de sistema (`Uncategorized`, `Reversal`, `Investments`) não podem ser recoloridas pelo usuário (403 `category_protected`, regra já existente para PATCH) | Mantém o RLS (`not is_system` no update) sem exceção nova | n |
| Contrato de `color` na criação | `color` é opcional no POST de contas e de categorias; ausente grava o padrão do banco (`slate-400`); presente é validado | Clientes antigos continuam funcionando; contrato aditivo | n |
| Contrato de `color` na edição | `PATCH /accounts/:id` aceita `color` junto dos outros campos opcionais; `PATCH /categories/:id` passa a ter `name` e `color` opcionais (corpo vazio devolve a categoria sem alterar, como em contas); nome em branco continua 422 | Uma rota por recurso; antes `name` era obrigatório (400 se faltasse), agora nenhum campo é obrigatório no PATCH | n |
| Validação e status | `color` string fora da lista (inclui `""`) responde 422 `validation_error` no campo `color`, na API inteira; tipo errado (`null`, número, objeto) é barrado pelo schema com o 400 `validation_error` já usado para `bank` | L-006: um status por tipo de falha, igual ao `bank` | n |
| Sem normalização da cor | A API não faz trim nem troca de caixa da `color` | Chave exata (linha da paleta) | n |
| Unicidade | Cores podem repetir entre contas e categorias; nenhuma regra de unicidade | Pedido não exige; L-004 sem aplicação | n |
| Mesma lista nos dois lados | API: constante `COLOR_KEYS` em `api/src/lib/palette.ts` (famílias × tons); web: `COLOR_KEYS` em `web/src/features/colors/palette.ts`; banco: o domínio. Sincronia por teste: o `openapi.json` expõe `enum` de 22 chaves em `color` (contas e categorias); um teste do web lê `api/openapi.json` e compara com `COLOR_KEYS`; um teste de integração da API compara o domínio do banco com `COLOR_KEYS` | AD-001 (apps independentes, contrato = OpenAPI); falha ao divergir sem pacote compartilhado | n |
| Onde a API usa a lista | Schemas de resposta com `Type.Unsafe({ type: "string", enum: COLOR_KEYS })`; corpos de entrada como `Type.String` com a lista na descrição, validados no handler (como `bank`) | Mantém 422 com campo e `enum` no OpenAPI | n |
| Mapa de classes | Um único módulo `palette.ts` no web com 22 entradas literais `{ bg, text }` (ex.: `{ bg: "bg-blue-400", text: "text-blue-800" }`); nenhuma classe é montada por template; o Tailwind v4 as encontra por `@source "../src"` | Classes dinâmicas não são geradas pelo Tailwind | n |
| Regra de cor do texto do badge | Fundo `bg-<família>-400` e texto `text-<família>-800`, da mesma família (decisão do dono em `docs/v1/ajustes-pontuais.md`) | Contraste medido com os valores oklch do `tailwindcss/theme.css`: 800 sobre 400 chega a 4,5:1 só em lime, slate, gray, zinc, neutral e stone; as outras 16 famílias ficam entre 2,77 e 4,38. **Desvio conhecido (COLOR-09 AC 3): o par mandatado fica abaixo de 4,5:1 nessas 16; o limiar não foi enfraquecido e a decisão é do dono** (ver validation.md, adendo) | n |
| Legibilidade nos dois temas | O badge é um preenchimento sólido da cor escolhida com texto próprio (não depende do fundo da página), mais `ring-1 ring-inset ring-black/10 dark:ring-white/25` para o contorno aparecer sobre fundo claro e escuro | Texto legível igual nos dois temas e o tom 900 não some no fundo escuro | n |
| Teste de contraste | Teste unitário calcula o contraste de cada entrada a partir do `theme.css` (`require.resolve("tailwindcss/theme.css")`), tratando `none` como matiz 0, e exige ≥ 4,5 | Evidência objetiva, sem hex copiado à mão | n |
| Componente do badge | `CategoryBadge({ name, color })` sobre o `Badge` do shadcn (`web/src/components/ui/badge.tsx`), com `variant="outline"` zerado pelas classes do mapa; `CategoryOptionLabel` passa a renderizá-lo; cor fora do mapa cai em `slate-400` | `CategoryOptionLabel` já é o único ponto de conteúdo dos selects (decisão da import-improvements) | n |
| Onde o badge aparece | Itens e valor exibido de todo `CategorySelect` (extrato: linha, cartão mobile, filtro, aplicar em massa, formulário/modal; destino de reatribuição na exclusão; formulário de despesa de cartão; preview do import), lista da página de Categorias e as linhas `ignored`/`invalid` do preview (que mostram texto) | O trigger do Select do Radix mostra o conteúdo do item selecionado; as células de texto passam a usar o mesmo componente | n |
| Resolver cor e banco no extrato | `useCategoryLookup` e `useAccountLookup` (mapas por `id` sobre `useCategories()` e `useAccounts()`); enquanto a lista carrega ou se falhar, a célula mostra só o texto atual (nome da conta, sem ícone nem cor) | A resposta de transações não traz cor nem banco (fora do escopo mudar o contrato); a degradação não bloqueia o extrato | n |
| Assets dos bancos | `Nubank`: `Nu Pagamentos S.A/nubank-logo-fundo-roxo2021.svg` (quadrado roxo, 6,7 KB, `viewBox 0 0 2500 2500`); `SofisaDireto`: `Banco Sofisa/logo-sofisa.svg` (ícone circular laranja e verde, 2,2 KB, `viewBox 0 0 2500.0001 2500.0001`); `Neon`: `Neon/header-logo-neon.svg` (marca azul, 2,6 KB, `viewBox 0 0 2500 2500` com a marca ocupando uma faixa central); `XP`: `XP Investimentos/xp-investimentos-logo.svg` (quadrado preto com "xp", 2,6 KB). `Other` e valor desconhecido: ícone `Landmark` do `lucide-react` (sem arquivo) | Os quatro existem no repositório; os escolhidos são os únicos formatos quadrados ou de ícone; `Landmark` já é usado na página de contas; nenhuma alternativa melhor foi encontrada para os quatro bancos | y (repositório e licença) |
| Ajustes permitidos nos SVGs | Remover declaração XML, comentários e metadados de editor (`sodipodi`, `inkscape`, `rdf`, `cc`, `dc`), e ajustar o `viewBox` do Neon para a caixa da marca; nenhuma outra alteração de desenho; cada ajuste vai no `NOTICE` | Marca ilegível em 20 px com o `viewBox` de 2500 e 70% de espaço vazio; sanitização é parte da regra | n |
| Regra de sanitização | Cada SVG versionado: raiz `<svg>` com `viewBox`; sem `<script>`, `<foreignObject>`, `<image>`, `<iframe>`, `<use>` com href externo; sem atributos `on*`; todo `href`/`xlink:href` apenas `#fragmento`; sem `url(` com `http`, `https` ou `//`; sem `@import`; tamanho máximo de 12 KB por arquivo e 40 KB no total; teste lê os arquivos e falha ao violar | O arquivo vem de repositório de terceiros sem licença; a regra mantém os assets inertes mesmo se alguém trocar um arquivo | n |
| Como o SVG é usado | Importado pelo Vite (`import nubank from "./nubank.svg"`) e renderizado em `<img src>` com `width`/`height`, `alt=""` e `aria-hidden`; nunca em HTML inline | `<img>` não executa script nem carrega recurso externo e evita colisão de classes CSS entre os SVGs (o do Neon traz `<style>`) | n |
| Moldura do ícone | Todo `BankIcon` fica em um quadrado de 20 px (extrato e selects) ou 32 px (lista de contas) com `overflow-hidden rounded-md` (mesmo raio para todos), sem fundo branco, sem `ring` e sem padding; a imagem é `size-full`. Cada SVG é um quadrado `viewBox="0 0 2500 2500"` com fundo sangrado na cor da marca e o logo centralizado, sem cantos arredondados próprios; o Neon (letreiro largo) foi recomposto no quadrado. O ícone genérico `Landmark` usa a mesma moldura (com fundo `bg-muted`) | O arredondamento vem de um único lugar e preenche todo o espaço (ajuste pontual de ícones); antes: moldura branca com `ring-1 ring-border` e `object-contain` com margem de 2 px | n |
| Nome acessível do ícone | `BankIcon` decorativo por padrão (`aria-hidden`, `alt=""`) porque o apelido da conta já está ao lado; com `decorative={false}` vira `role="img"` com `aria-label` `Banco <rótulo>` (rótulos: Nubank, Sofisa Direto, Neon, XP, Outro) | O ícone nunca é o único portador da informação; a opção existe para uso isolado | n |
| Cor da conta como detalhe | Um ponto de 10 px (`bg-<cor>`, `rounded-full`, `aria-hidden`) depois do apelido em `AccountLabel` (select, extrato) e uma faixa vertical de 6 px (`bg-<cor>`) à esquerda do cartão na lista de contas; a cor nunca é o único portador de informação | Detalhe discreto e legível nos dois temas; o apelido segue identificando a conta | n |
| Conta inativa | `AccountLabel` mantém o sufixo ` (inativa)` no mesmo nó de texto do apelido; o cartão inativo da lista continua com `opacity-55` | Os testes e os leitores de tela existentes dependem do texto | n |
| Nome das cores em português | Famílias: red Vermelho, orange Laranja, amber Âmbar, yellow Amarelo, lime Lima, green Verde, emerald Esmeralda, teal Verde-azulado, cyan Ciano, sky Céu, blue Azul, indigo Índigo, violet Violeta, purple Roxo, fuchsia Fúcsia, pink Rosa, rose Rosê, slate Ardósia, gray Cinza, zinc Zinco, neutral Neutro, stone Pedra; nome da chave: só o nome da família (ex.: `Azul`), porque há uma única tonalidade; os 22 nomes são únicos | Nome acessível de cada swatch; únicos para o leitor de tela e para os testes | n |
| Forma do `ColorPicker` | Gatilho (botão com o swatch e o nome atual, `id` para o `Label`) que abre um `Popover` com `role="radiogroup"` `aria-label="Paleta de cores"` e 22 botões `role="radio"` em grade de 6 colunas (4 linhas, a última com 4 células) na ordem das famílias; fechar com Esc ou ao escolher | A grade inline não cabe no formulário inline de categoria; o popover serve aos dois formulários | n |
| Teclado do `ColorPicker` | Um único `tabIndex=0` (o selecionado ou o primeiro, reposto ao reabrir); setas esquerda/direita movem 1, cima/baixo movem 6 (sem sair da grade: baixo numa célula da última linha e cima numa célula da primeira linha não movem o foco, tanto nos cantos quanto nas demais células da borda, sem ir para a célula de borda mais próxima: as setas travam na borda, ou seja, fazem clamp; com 22 cores a última linha tem 4 células, então baixo nas duas células acima das células que faltam, índices 16 e 17, também não move o foco), Home/End vão ao primeiro/último, Enter e Espaço escolhem; escolher fecha o popover e devolve o foco ao gatilho | Padrão de grupo de rádios com navegação 2D; operável sem mouse | n |
| Valor inicial dos formulários | Conta e categoria novas abrem com `slate-400` (o padrão do banco); edição abre com a cor atual | O envio sempre leva uma cor válida; o padrão coincide com o do banco | n |
| Formulário de categoria | O formulário de criação (inline) ganha o `ColorPicker`; o de edição (hoje só renomear) ganha o picker e o botão passa de "Salvar nome" para "Salvar categoria"; categoria de sistema não tem edição, só mostra o badge | A edição passa a salvar nome e cor em um `PATCH` | n |
| Erro de cor no formulário | 422 no campo `color` mostra "Escolha uma cor da paleta." no formulário; qualquer outro erro segue `messageForError` | Mensagem em português que nomeia o campo (L-013) | n |
| Testes determinísticos | Nenhum `setTimeout`, `sleep` ou espera fixa; nenhum timeout aumentado (`testTimeout` segue 15 000 ms); interações do picker por `fireEvent`/`userEvent` e `findBy*`/`waitFor`; nada dos helpers lentos de data ou dropdown (o `ColorPicker` não usa calendário nem `select` aninhado); o teste mais lento fica abaixo de 7,5 s | Lições confirmadas L-027 e as de determinismo da feature transactions-ux | n |
| Orçamento de teste do picker | 22 botões renderizados no popover são aceitos; testes de teclado disparam as teclas em sequência com `fireEvent.keyDown` | Mantém o teste leve no jsdom (L-027) | n |
| Mocks do front | Os handlers de contas e categorias guardam e devolvem `color`, validam a lista (422 `validation_error` no campo `color`), usam as mesmas cores semeadas da migration para as 17 categorias e as cores por banco para as duas contas semente; a lista de chaves vem do módulo `palette.ts` | Mocks fiéis ao contrato (risco do plano) | n |
| Fixtures dos testes | `Account` e `Category` ganham `color` obrigatório nos tipos; as fixtures dos testes existentes recebem a cor e o `typecheck` precisa passar a cada commit | Evita `color` opcional só para não editar testes | n |
| Migration aditiva | A 0008 não remove nem renomeia nada; reaplicável com `supabase db reset`; RLS e policies de contas e categorias ficam como estão (a coluna nova é coberta pelas policies existentes) | Plano: "Todas aditivas" | n |
| Atomicidade | `domain`, `alter table` (com o `not null default`, o Postgres preenche as linhas existentes com o padrão), `update` de preenchimento e `create or replace function` rodam na mesma migration (transação do `db reset`) | Sem estado intermediário sem cor | n |
| Dados de outros usuários | O `update` de preenchimento roda sem filtro de usuário (migration, papel dono do esquema) e só altera `color`; o RLS segue valendo para toda leitura pela API | Migrations não passam pelo RLS; nada mais é tocado | n |
| Concorrência | PATCH de cor concorrente: vale o último (sem versão); nenhum estado compartilhado novo | Mesmo comportamento dos outros campos | n |
| Observabilidade | Nenhum log novo; erro 422 de cor não registra o valor recebido além do que o handler padrão já faz | Sem segredo na cor; sem mudança | n |
| Licença dos SVGs | O repositório `Tgentil/Bancos-em-SVG` não tem arquivo de licença; o dono confirmou que o uso é aceitável para o uso pessoal do projeto; `web/src/assets/banks/NOTICE` registra a origem (URL do repositório, pastas e arquivos de origem, commit consultado), a confirmação do dono, os ajustes feitos (remoção de metadados, `viewBox` do Neon) e a observação de que as marcas pertencem aos respectivos bancos | Decisão do dono; registro pedido no plano | y |
| Risco de uso não pessoal | O `NOTICE` avisa que o uso fora do pessoal exige revisar a origem dos arquivos | A confirmação do dono cobre só o uso pessoal | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Paleta única e coluna de cor no banco ⭐ MVP

**User Story**: Como dono do sistema, quero que categorias e contas tenham uma cor da paleta guardada como chave, com defaults para tudo que já existe, para que a API e o front mostrem cores sem tratar ausência.

**Why P1**: Sem a coluna, a lista de chaves e os defaults nada mais da feature funciona.

**Acceptance Criteria** (each line is one EARS pattern):

1. The sistema SHALL definir a paleta como as 22 chaves `<família>-400`, uma para cada uma das 22 famílias do Tailwind listadas, sem repetição e sem outra chave (nenhuma `-600` ou `-900`).  <!-- COLOR-01 -->
2. The sistema SHALL manter as chaves da paleta idênticas na API (`COLOR_KEYS`), no banco (domínio `palette_color`) e no `web/` (`COLOR_KEYS`), e um teste de cada lado SHALL falhar quando a lista de outro divergir.  <!-- COLOR-01 -->
3. WHEN as migrations 0008 e 0009 são aplicadas THEN `categories.color` e `accounts.color` SHALL existir com o tipo `palette_color`, `not null` e padrão `slate-400`.  <!-- COLOR-02 -->
4. IF um `insert` ou `update` grava em `color` um valor fora das 22 chaves (inclusive uma `-600` ou `-900`) THEN o banco SHALL rejeitá-lo com violação de check (23514), tanto em contas quanto em categorias.  <!-- COLOR-02 -->
5. WHEN a migration 0009 é aplicada sobre categorias existentes com `key` conhecida THEN cada uma SHALL receber a cor da tabela do design, e as 17 cores SHALL ser distintas entre si.  <!-- COLOR-02 -->
6. WHEN a migration 0009 é aplicada sobre categorias sem `key` e sobre contas THEN as cores `-600` e `-900` SHALL virar `<família>-400` da mesma família, as categorias sem cor escolhida SHALL ficar com `slate-400` e cada conta SHALL ficar com a cor do seu banco na tonalidade 400 (Nubank `purple-400`, SofisaDireto `teal-400`, Neon `sky-400`, XP `zinc-400`, Other `slate-400`).  <!-- COLOR-02 -->
7. WHEN um novo usuário é criado THEN suas 17 categorias padrão SHALL nascer com as cores da tabela do design, e o restante do comportamento de `seed_categories` e `handle_new_user` SHALL ser o mesmo de antes.  <!-- COLOR-03 -->
8. The políticas de RLS de `accounts` e `categories` SHALL permanecer as mesmas: o usuário B não lê nem altera a cor das linhas do usuário A, e uma categoria de sistema não aceita `update` de cor pelo usuário.  <!-- COLOR-03 -->

**Independent Test**: `supabase db reset`, criar um usuário, e ler suas categorias e contas com `color` preenchido; inserir `color = 'blue-500'` e ver a violação do check.

---

### P1: Cor de contas na API ⭐ MVP

**User Story**: Como usuário, quero que a API aceite e devolva a cor das minhas contas, para escolher e ver a cor de cada uma.

**Why P1**: É o contrato que o formulário e as telas consomem.

**Acceptance Criteria**:

1. WHEN o cliente chama `POST /accounts` com uma `color` válida THEN a API SHALL criar a conta e responder 201 com `color` igual à enviada.  <!-- COLOR-04 -->
2. WHEN o cliente chama `POST /accounts` sem `color` THEN a API SHALL criar a conta com `color` `slate-400`.  <!-- COLOR-04 -->
3. IF `POST /accounts` ou `PATCH /accounts/:id` traz uma `color` string fora da lista (`""`, `"blue"`, `"blue-500"`, `"blue-600"`, `"blue-900"`, `"Blue-400"`, `" blue-400"`, `"#60a5fa"`) THEN a API SHALL responder 422 `validation_error` com `field: "color"` sem gravar nada.  <!-- COLOR-04 -->
4. IF a `color` enviada não é string (`null`, número ou objeto) THEN a API SHALL responder 400 `validation_error`, como já faz para `bank`.  <!-- COLOR-04 -->
5. WHEN o cliente chama `PATCH /accounts/:id` só com `color` válida THEN a API SHALL alterar a cor, manter os outros campos e responder 200 com a conta completa.  <!-- COLOR-04 -->
6. WHEN o cliente chama `GET /accounts` THEN cada conta SHALL trazer `color`, e `POST /accounts/:id/deactivate` e `activate` SHALL devolver a conta com `color`.  <!-- COLOR-04 -->
7. IF o usuário B chama `PATCH /accounts/:id` para uma conta do usuário A THEN a API SHALL responder 404 `not_found` e a cor da conta de A SHALL permanecer.  <!-- COLOR-04 -->

**Independent Test**: Criar conta com `color: "teal-400"`, ler em `GET /accounts`, trocar por `PATCH` e tentar `"teal-500"`.

---

### P1: Cor de categorias na API ⭐ MVP

**User Story**: Como usuário, quero que a API aceite e devolva a cor das minhas categorias, para colori-las e ver as cores padrão das categorias semeadas.

**Why P1**: É o contrato do seletor de cor e do badge.

**Acceptance Criteria**:

1. WHEN o cliente chama `GET /categories` THEN cada categoria SHALL trazer `color`, e as 17 semeadas SHALL trazer as cores da tabela do design.  <!-- COLOR-05 -->
2. WHEN o cliente chama `POST /categories` com `name` e `color` válida THEN a API SHALL responder 201 com a categoria e a cor enviada.  <!-- COLOR-05 -->
3. WHEN o cliente chama `POST /categories` sem `color` THEN a API SHALL criar a categoria com `slate-400`.  <!-- COLOR-05 -->
4. IF `POST /categories` ou `PATCH /categories/:id` traz uma `color` string fora da lista THEN a API SHALL responder 422 `validation_error` com `field: "color"` sem gravar nada.  <!-- COLOR-05 -->
5. WHEN o cliente chama `PATCH /categories/:id` só com `color` válida THEN a API SHALL alterar a cor, manter o nome e responder 200.  <!-- COLOR-05 -->
6. WHEN o cliente chama `PATCH /categories/:id` com `name` e `color` THEN a API SHALL gravar os dois na mesma operação, e SHALL não gravar nenhum dos dois se um deles for inválido ou o nome estiver em conflito (409 `duplicate_name`).  <!-- COLOR-05 -->
7. WHEN o cliente chama `PATCH /categories/:id` com corpo vazio THEN a API SHALL responder 200 com a categoria sem alterações.  <!-- COLOR-05 -->
8. IF o cliente chama `PATCH /categories/:id` para uma categoria de sistema (nome ou cor) THEN a API SHALL responder 403 `category_protected` e a cor SHALL permanecer.  <!-- COLOR-05 -->
9. IF o usuário B chama `PATCH /categories/:id` para uma categoria do usuário A THEN a API SHALL responder 404 `not_found`.  <!-- COLOR-05 -->

**Independent Test**: Criar categoria com `color: "rose-400"`, trocar por `PATCH`, e tentar recolorir `Uncategorized` (403).

---

### P1: Contrato: OpenAPI, tipos e mocks ⭐ MVP

**User Story**: Como desenvolvedor, quero o contrato novo no `openapi.json`, nos tipos e nos mocks do front, para que os testes do web não mascarem divergência da API.

**Why P1**: Sem os mocks e tipos o front não compila nem testa com `color`.

**Acceptance Criteria**:

1. The `api/openapi.json` SHALL ser regenerado (nunca editado à mão) e documentar `color` com `enum` das 22 chaves nos schemas de resposta de conta e de categoria e, nos corpos de POST e PATCH, como `type: string` com a lista das chaves na descrição (a validação é do handler, para manter o 422), e o teste do swagger SHALL passar.  <!-- COLOR-06 -->
2. WHEN o teste de contrato do `web/` compara `COLOR_KEYS` com o `enum` de `color` do `api/openapi.json` (contas e categorias) THEN as duas listas SHALL ser iguais como conjuntos de 22 chaves, e SHALL falhar com a diferença quando divergirem.  <!-- COLOR-06 -->
3. The tipos `Account` e `Category` do `web/` SHALL ter `color: ColorKey` obrigatório, e `AccountInput`/`AccountUpdate` e as entradas de categoria SHALL aceitar `color`.  <!-- COLOR-06 -->
4. WHEN os mocks recebem POST ou PATCH com `color` válida THEN SHALL gravá-la e devolvê-la, e WHEN a `color` é inválida THEN SHALL responder 422 `validation_error` no campo `color`.  <!-- COLOR-06 -->
5. The mocks SHALL semear as 17 categorias com as cores da tabela do design e as duas contas semente com as cores por banco da migration.  <!-- COLOR-06 -->

**Independent Test**: `pnpm -C api openapi:export` sem diff depois do commit; o teste de contrato do web verde; trocar uma chave em `palette.ts` e ver o teste falhar.

---

### P1: ColorPicker acessível ⭐ MVP

**User Story**: Como usuário, quero escolher a cor em uma grade com nomes em português, por mouse ou teclado, para colorir contas e categorias sem erro.

**Why P1**: É a única forma de o usuário escolher cor.

**Acceptance Criteria**:

1. WHEN o `ColorPicker` é aberto THEN SHALL mostrar um `radiogroup` "Paleta de cores" com 22 `radio`, cada um com nome acessível igual ao nome da família em português (ex.: `Azul`), todos únicos.  <!-- COLOR-07 -->
2. WHILE uma cor está selecionada o `ColorPicker` SHALL marcar só o radio dessa cor com `aria-checked="true"` e um indicador visual (marca de seleção), e o gatilho SHALL mostrar o swatch e o nome dela.  <!-- COLOR-07 -->
3. WHEN o usuário clica em uma cor THEN o `ColorPicker` SHALL chamar `onChange` com a chave exata (ex.: `blue-400`), fechar o popover e devolver o foco ao gatilho.  <!-- COLOR-07 -->
4. WHEN o foco está em uma cor e o usuário pressiona seta direita, esquerda, baixo ou cima THEN o foco SHALL mover 1 posição para os lados ou 6 para cima e para baixo, sem sair da grade; quando o destino ficaria fora da grade, o foco SHALL permanecer na mesma célula (seta baixo numa célula da última linha, inclusive numa que não é a última cor, e seta cima numa célula da primeira linha não movem o foco; seta direita na última cor e esquerda na primeira também ficam).  <!-- COLOR-07 -->
5. WHEN o usuário pressiona Home ou End THEN o foco SHALL ir à primeira ou à última cor, e WHEN pressiona Enter ou Espaço THEN a cor focada SHALL ser escolhida.  <!-- COLOR-07 -->
6. WHEN o usuário pressiona Esc com o popover aberto THEN o popover SHALL fechar sem chamar `onChange`.  <!-- COLOR-07 -->
7. WHILE o `ColorPicker` está desabilitado o gatilho SHALL não abrir o popover.  <!-- COLOR-07 -->
8. IF o `value` recebido não é uma das 22 chaves (inclusive uma `-600` ou `-900` antiga) THEN o `ColorPicker` SHALL tratá-lo como `slate-400` no gatilho e não marcar nenhum radio.  <!-- COLOR-07 -->
9. The `ColorPicker` SHALL ter um único elemento da grade com `tabIndex=0` (o selecionado ou o primeiro), SHALL repor esse elemento ao reabrir o popover depois de mover o foco ou de escolher outra cor, e SHALL aceitar `id` para ser associado a um `Label`.  <!-- COLOR-07 -->

**Independent Test**: Abrir o picker, navegar por setas até `Azul`, Enter, e ver o gatilho "Azul".

---

### P1: Cor nos formulários de conta e de categoria ⭐ MVP

**User Story**: Como usuário, quero escolher a cor ao criar ou editar uma conta ou categoria, para personalizá-las.

**Why P1**: Sem o picker nos formulários a cor nunca muda.

**Acceptance Criteria**:

1. WHEN o formulário de conta abre para criar THEN o campo "Cor" SHALL mostrar o `ColorPicker` com `Ardósia`, e WHEN abre para editar THEN SHALL mostrar a cor da conta.  <!-- COLOR-08 -->
2. WHEN o usuário salva uma conta THEN o front SHALL enviar a `color` escolhida no `POST` ou no `PATCH`, junto dos demais campos.  <!-- COLOR-08 -->
3. WHEN o formulário de criação de categoria é enviado THEN o front SHALL enviar `name` e a `color` escolhida (padrão `slate-400`), e WHEN o envio dá certo THEN o nome SHALL limpar e a cor SHALL voltar a `slate-400`.  <!-- COLOR-08 -->
4. WHEN o usuário edita uma categoria não de sistema THEN o formulário SHALL mostrar o nome e o `ColorPicker` com a cor atual, e o botão "Salvar categoria" SHALL enviar um único `PATCH` com `name` e `color`.  <!-- COLOR-08 -->
5. IF a API responde 422 no campo `color` THEN o formulário SHALL mostrar "Escolha uma cor da paleta." e manter o que o usuário digitou.  <!-- COLOR-08 -->
6. IF o salvar falha por outro erro THEN o formulário SHALL mostrar a mensagem de `messageForError` em português e manter o diálogo ou a edição abertos.  <!-- COLOR-08 -->
7. WHILE a categoria é de sistema a página SHALL mostrar o badge com a cor fixa e nenhum botão de edição de cor.  <!-- COLOR-08 -->

**Independent Test**: Criar uma categoria "Mercado" em `Verde`, recarregar a lista e ver o badge verde; editar a conta para `Laranja` e ver o ponto laranja.

---

### P1: Badge de categoria e mapa de classes ⭐ MVP

**User Story**: Como usuário, quero ver cada categoria como um badge colorido legível no tema claro e no escuro, para reconhecê-la de relance.

**Why P1**: É o pedido central da feature.

**Acceptance Criteria**:

1. The mapa de classes SHALL ter 22 entradas, uma por chave da paleta, cada uma com `bg` e `text` como strings literais (`bg-<família>-400`) e nenhuma montada por template.  <!-- COLOR-09 -->
2. The mapa de classes SHALL usar a regra de texto do design: `text-<família>-800`, da mesma família do fundo `bg-<família>-400`.  <!-- COLOR-09 -->
3. The contraste entre o texto 800 e o fundo 400 de cada uma das 22 entradas, calculado dos valores do `tailwindcss/theme.css`, SHALL ser de pelo menos 4,5:1; **desvio conhecido: 16 famílias (red, orange, amber, yellow, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose) não chegam a 4,5:1 com o par mandatado, o limiar do teste não foi enfraquecido e o teste afirma a lista exata dessas famílias até a decisão do dono**.  <!-- COLOR-09 -->
4. WHEN `CategoryBadge` recebe `name` e uma chave da paleta THEN SHALL renderizar um `Badge` com o nome e as classes `bg` e `text` da chave, mais o contorno `ring-1 ring-inset ring-black/10 dark:ring-white/25`.  <!-- COLOR-09 -->
5. IF `CategoryBadge` recebe uma cor fora do mapa THEN SHALL usar as classes de `slate-400`.  <!-- COLOR-09 -->
6. WHERE o nome da categoria é longo o `CategoryBadge` SHALL truncar o texto com reticências sem quebrar a linha do select.  <!-- COLOR-09 -->

**Independent Test**: Renderizar o badge das 22 chaves e conferir as classes; o teste de contraste verde, com a lista de desvios conhecidos exata.

---

### P1: Badge em selects, extrato e import ⭐ MVP

**User Story**: Como usuário, quero ver a categoria colorida em todo select e coluna onde ela aparece, para não ler só texto.

**Why P1**: O pedido lista os selects do extrato, o modal e o preview do import.

**Acceptance Criteria**:

1. WHEN um `CategorySelect` é aberto THEN cada item SHALL ser renderizado como `CategoryBadge` com o nome e a cor da categoria, e o nome acessível de cada `option` SHALL continuar sendo o nome da categoria.  <!-- COLOR-10 -->
2. WHILE um `CategorySelect` tem valor o gatilho SHALL mostrar o `CategoryBadge` da categoria selecionada.  <!-- COLOR-10 -->
3. WHEN o extrato mostra uma linha (tabela e cartão mobile) THEN a categoria da linha SHALL aparecer como badge no select da linha, e o filtro de categoria, o aplicar em massa e o formulário/modal de transação SHALL mostrar badges nos itens e no valor.  <!-- COLOR-10 -->
4. WHEN o select de destino da exclusão de categoria e o select de categoria do formulário de despesa de cartão são abertos THEN os itens SHALL ser badges, pelo mesmo `CategoryOptionLabel`.  <!-- COLOR-10 -->
5. WHEN o preview do import mostra uma linha selecionável THEN o select da linha SHALL mostrar o badge, e WHEN a linha é `ignored` ou `invalid` THEN a célula SHALL mostrar o `CategoryBadge` com o nome do preview e a cor da categoria do usuário quando a lista de categorias carregou.  <!-- COLOR-10 -->
6. IF a lista de categorias falha ao carregar no preview THEN a coluna SHALL mostrar o `categoryName` em texto, como já faz, sem badge.  <!-- COLOR-10 -->
7. WHEN a página de Categorias lista as categorias THEN cada linha SHALL mostrar o `CategoryBadge` no lugar do texto do nome, e SHALL manter o nome acessível dos botões ("Renomear <nome>", "Excluir <nome>").  <!-- COLOR-10 -->
8. WHILE as categorias carregam o select SHALL mostrar o texto "Carregando categorias…" e ficar desabilitado, como hoje.  <!-- COLOR-10 -->

**Independent Test**: Abrir o select de categoria de uma linha do extrato e ver as 17 categorias em cores diferentes; selecionar uma e ver o badge no gatilho.

---

### P1: Ícones de banco versionados ⭐ MVP

**User Story**: Como dono, quero os SVGs dos bancos no repositório com a origem registrada e conferidos, para o app não depender de rede nem de arquivo sem controle.

**Why P1**: Sem os arquivos não há ícone; a sanidade dos arquivos é a única defesa contra conteúdo ativo.

**Acceptance Criteria**:

1. The repositório SHALL conter em `web/src/assets/banks/` um SVG para cada um de Nubank, SofisaDireto, Neon e XP, com os arquivos de origem listados nas Assumptions, sem outros SVGs de bancos.  <!-- ICON-01 -->
2. The pasta SHALL conter um `NOTICE` com a URL do repositório de origem, os arquivos copiados, a confirmação do dono de que a licença serve ao uso pessoal do projeto, os ajustes feitos nos arquivos e o aviso de uso fora do pessoal.  <!-- ICON-01 -->
3. The teste de sanidade dos assets SHALL falhar se algum SVG não tiver `viewBox="0 0 2500 2500"` na raiz (quadrado), se o primeiro `rect` não for o fundo sangrado de 2500 por 2500 sem `rx`/`ry`, se algum SVG tiver `rect` com cantos arredondados próprios, exceder 12 KB (ou 40 KB no total), contiver `<script`, `<foreignObject`, `<image`, `<iframe`, atributo `on*`, `href`/`xlink:href` que não seja `#fragmento`, `url(` com `http`, `https` ou `//`, ou `@import`.  <!-- ICON-01 -->
4. The teste SHALL falhar se um dos quatro arquivos faltar ou se o `NOTICE` não citar os quatro arquivos.  <!-- ICON-01 -->

**Independent Test**: Rodar o teste de sanidade; adicionar `<script>` a um SVG e ver o teste falhar.

---

### P1: BankIcon ⭐ MVP

**User Story**: Como usuário, quero um ícone por banco, e um ícone genérico quando o banco não tem logo, para reconhecer a conta.

**Why P1**: É o componente que as telas usam.

**Acceptance Criteria**:

1. WHEN `BankIcon` recebe `bank` igual a `Nubank`, `SofisaDireto`, `Neon` ou `XP` THEN SHALL renderizar o SVG local correspondente em um `<img>` `size-full`, sem padding, anel nem fundo branco, dentro da moldura quadrada de 20 px (ou 32 px com `size="lg"`) com `overflow-hidden rounded-md`, o mesmo raio para todos os bancos.  <!-- ICON-02 -->
2. WHEN `bank` é `Other` ou um valor desconhecido THEN `BankIcon` SHALL renderizar o ícone genérico `Landmark` na mesma moldura (`overflow-hidden rounded-md`), sem lançar erro.  <!-- ICON-02 -->
3. WHILE `decorative` é verdadeiro (padrão) o `BankIcon` SHALL ficar `aria-hidden` com `alt=""` e SHALL não aparecer na árvore de acessibilidade.  <!-- ICON-02 -->
4. WHERE `decorative={false}` o `BankIcon` SHALL expor `role="img"` com nome acessível `Banco <rótulo>` (Nubank, Sofisa Direto, Neon, XP, Outro).  <!-- ICON-02 -->
5. IF o arquivo de imagem falha ao carregar THEN o `BankIcon` SHALL trocar a imagem pelo ícone genérico, sem quebrar o layout.  <!-- ICON-02 -->

**Independent Test**: Renderizar os cinco bancos e um valor desconhecido e conferir o `img` ou o ícone genérico.

---

### P1: Ícone e cor da conta nas telas ⭐ MVP

**User Story**: Como usuário, quero ver o ícone do banco e a cor da conta no seletor de conta, no extrato e na lista de contas, para reconhecer a conta de relance.

**Why P1**: É o pedido de ícones de banco do extrato e das contas.

**Acceptance Criteria**:

1. WHEN `AccountSelect` é aberto THEN cada item SHALL mostrar `AccountLabel` (ícone do banco, apelido, ponto da cor da conta e o sufixo ` (inativa)` quando a conta está inativa), e WHILE há valor o gatilho SHALL mostrar o mesmo `AccountLabel`.  <!-- ICON-03 -->
2. The nome acessível de cada `option` do `AccountSelect` SHALL continuar sendo o apelido (com ` (inativa)` quando for o caso).  <!-- ICON-03 -->
3. WHEN o extrato mostra uma linha (tabela e cartão mobile) THEN a coluna ou o texto da conta SHALL mostrar o `AccountLabel` da conta da transação, resolvido por `accountId` na lista de contas.  <!-- ICON-03 -->
4. IF a lista de contas ainda carrega ou falha THEN o extrato SHALL mostrar apenas o `accountNickname` da transação, sem ícone nem cor, e SHALL não bloquear nem alterar o resto da linha.  <!-- ICON-03 -->
5. WHEN a página de Contas lista as contas THEN cada cartão SHALL mostrar o `BankIcon` de 32 px, o apelido, o rótulo do banco, a faixa vertical com a cor da conta à esquerda, e SHALL manter os botões "Editar", "Desativar" e "Reativar".  <!-- ICON-03 -->
6. WHEN o seletor de conta do filtro do extrato, do formulário de transação, do formulário de despesa de cartão, do retorno de investimento e da importação é aberto THEN SHALL mostrar o `AccountLabel`, pelo mesmo `AccountSelect`.  <!-- ICON-03 -->
7. The cor da conta SHALL ser mostrada como ponto ou faixa decorativa (`aria-hidden`), nunca como a única informação que identifica a conta.  <!-- ICON-04 -->
8. WHEN a cor da conta muda por `PATCH` e a lista é invalidada THEN o ponto e a faixa SHALL refletir a nova cor sem recarregar a página.  <!-- ICON-04 -->
9. WHILE a conta está inativa o cartão da lista SHALL manter a opacidade reduzida de hoje e a faixa e o ícone SHALL continuar visíveis.  <!-- ICON-04 -->

**Independent Test**: Abrir o seletor de conta, ver o ícone do Nubank e o ponto roxo ao lado de "Nubank pessoal"; abrir o extrato e ver a mesma coisa na coluna Conta.

---

## Edge Cases

Edge cases are usually unwanted-behavior (IF/THEN) or boundary (WHEN) criteria:

- IF a API devolve uma `color` fora das 22 chaves (versão futura da API ou uma `-600` ou `-900` antiga) THEN `CategoryBadge`, `AccountLabel` e a faixa da conta SHALL usar `slate-400`, e o `ColorPicker` SHALL abrir sem selecionar nenhuma cor.
- WHEN o usuário tem uma categoria com nome muito longo THEN o badge SHALL truncar com reticências dentro do select e o `title` do badge SHALL mostrar o nome completo.
- WHEN duas categorias têm a mesma cor THEN os dois badges SHALL aparecer iguais e distinguidos pelo nome.
- WHEN a mesma conta é a de uma transação e está inativa THEN o extrato SHALL mostrar o apelido com o ícone e a cor, sem o sufixo (` (inativa)` só aparece nos seletores).
- WHEN o `POST /categories` chega com `color` válida e `name` em conflito THEN a API SHALL responder 409 `duplicate_name` e não criar a categoria.
- WHEN a migration roda em um banco com um usuário que já excluiu categorias semeadas THEN o preenchimento SHALL atingir só as linhas que existem, sem recriar as excluídas.
- IF o usuário abre o `ColorPicker` em uma tela de 320 px THEN a grade de 6 colunas SHALL caber sem rolagem horizontal da página.
- WHEN o tema escuro está ativo THEN o texto do badge SHALL permanecer o definido pelo mapa e o contorno SHALL usar `dark:ring-white/25`.
- WHEN o `BankIcon` é renderizado com um arquivo SVG de 2500 unidades em 20 px THEN o `viewBox` SHALL fazer a imagem caber na moldura sem cortar (`object-contain`).
- IF a lista de contas carrega depois do extrato THEN as células SHALL passar do texto ao `AccountLabel` sem salto de coluna além da largura do ícone.

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| COLOR-01 | P1: Paleta única e coluna de cor no banco | In Tasks | Pending |
| COLOR-02 | P1: Paleta única e coluna de cor no banco | In Tasks | Pending |
| COLOR-03 | P1: Paleta única e coluna de cor no banco | In Tasks | Pending |
| COLOR-04 | P1: Cor de contas na API | In Tasks | Pending |
| COLOR-05 | P1: Cor de categorias na API | In Tasks | Pending |
| COLOR-06 | P1: Contrato: OpenAPI, tipos e mocks | In Tasks | Pending |
| COLOR-07 | P1: ColorPicker acessível | In Tasks | Pending |
| COLOR-08 | P1: Cor nos formulários de conta e de categoria | In Tasks | Pending |
| COLOR-09 | P1: Badge de categoria e mapa de classes | In Tasks | Pending |
| COLOR-10 | P1: Badge em selects, extrato e import | In Tasks | Pending |
| ICON-01 | P1: Ícones de banco versionados | In Tasks | Pending |
| ICON-02 | P1: BankIcon | In Tasks | Pending |
| ICON-03 | P1: Ícone e cor da conta nas telas | In Tasks | Pending |
| ICON-04 | P1: Ícone e cor da conta nas telas | In Tasks | Pending |

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 14 total, 14 mapped to tasks, 0 unmapped

**Ajustes pontuais (`docs/v1/ajustes-pontuais.md`)**: revisaram COLOR-01, COLOR-02, COLOR-03, COLOR-07, COLOR-09, COLOR-10 (valores de cor) e ICON-01, ICON-02 (tarefas T14, T15 e T16 em `tasks.md`); os IDs não mudaram.

---

## Success Criteria

- [ ] `pnpm -C api test` (com `supabase start`) e `yarn --cwd web test`, mais typecheck e lint de cada app, passam; o teste do swagger confirma o `openapi.json` atualizado e o teste de contrato do web confirma as 22 chaves iguais.
- [ ] Os testes de integração mostram as 17 categorias de um novo usuário com as cores da tabela (todas distintas), o preenchimento das linhas existentes, o 422 de cor inválida em contas e categorias e o RLS inalterado.
- [ ] Os testes de contraste mostram as 22 combinações 800 sobre 400 com a lista exata das famílias abaixo de 4,5:1 (desvio conhecido, decisão do dono) e as demais com pelo menos 4,5:1, e os testes de sanidade mostram os quatro SVGs sem script nem referência externa, cada um com até 12 KB.
- [ ] No navegador, contra a API local: o picker troca a cor de uma conta e de uma categoria e o extrato, os selects e a lista de contas refletem a troca; os selects mostram badges nos temas claro e escuro; o extrato e o seletor de conta mostram o ícone certo de Nubank, Sofisa Direto, Neon, XP e o genérico para Outro.
- [ ] Nenhum arquivo versionado de banco tem origem sem registro no `NOTICE`.
