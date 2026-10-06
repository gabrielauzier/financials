# Cores e ícones (colors-and-icons) Design

**Spec**: `.specs/features/colors-and-icons/spec.md`
**Status**: Draft

Contexto lido: `.specs/STATE.md` (decisões ativas AD-001 a AD-005, todas respeitadas: apps independentes com contrato no OpenAPI, RLS por requisição, sem dinheiro neste escopo, sem datas neste escopo); lições confirmadas L-004, L-006, L-013 e L-027 aplicadas (igualdade da chave declarada, status único 422/400 por tipo de falha, caminho de falha e lista condicional testados com o texto em português, teste pesado de jsdom com orçamento). Nenhuma decisão nova de projeto para o `STATE.md`: a lista de chaves por app com teste de sincronia segue AD-001.

---

## Architecture Overview

Uma lista de 22 chaves (`<família>-400`; revisão pós-verificação, migration 0009), três cópias vigiadas por testes: o domínio SQL `palette_color` (quem de fato impede lixo no banco), a constante `COLOR_KEYS` da API (validação com 422 e `enum` no OpenAPI) e `COLOR_KEYS` do `web/` (mapa de classes literais, picker e mocks). O `openapi.json` é o elo entre API e web: o teste do web lê o arquivo e compara. O banco e a API são comparados por um teste de integração que lê as constraints do domínio.

No `web/`, três peças compartilhadas concentram a feature, e as telas só as usam: `palette.ts` (chaves, nomes, classes), `CategoryOptionLabel`/`CategoryBadge` (todo select de categoria passa por aqui, hoje um único ponto) e `AccountLabel`/`BankIcon` (todo select ou célula de conta). O extrato não recebe cor nem banco da API; resolve por `accountId` e `categoryId` nas listas já em cache do react-query.

```mermaid
graph TD
    SQL[0008_colors.sql + 0009_palette_400.sql<br/>domain palette_color (22 keys) + color cols + remap + seed_categories]
    PAL_API[api/src/lib/palette.ts<br/>COLOR_KEYS]
    ROUTES[accounts and categories routes<br/>color in schemas, 422 field color]
    OAS[api/openapi.json<br/>enum of 22 keys]
    PAL_WEB[web/src/features/colors/palette.ts<br/>COLOR_KEYS, labels, class map]
    PICKER[ColorPicker]
    BADGE[CategoryBadge via CategoryOptionLabel]
    BANK[BankIcon + AccountLabel]
    FORMS[AccountForm, CategoriesPage]
    SELECTS[CategorySelect, AccountSelect]
    PAGES[Extrato, AccountsPage, Import preview]
    SQL -- int test compares --> PAL_API
    PAL_API --> ROUTES --> OAS
    OAS -- web contract test compares --> PAL_WEB
    PAL_WEB --> PICKER --> FORMS
    PAL_WEB --> BADGE --> SELECTS --> PAGES
    PAL_WEB --> BANK --> SELECTS
    BANK --> PAGES
```

### Tabela de cores semeadas (as mesmas na migration, nos mocks e no teste)

17 chaves distintas, todas na paleta. `Uncategorized` usa `slate-400`, que é também o padrão das categorias sem `key` (a categoria de sistema é a única com essa cor).

| `key` | Nome | Cor |
| ----- | ---- | --- |
| `Entertainment` | Entretenimento | `purple-400` |
| `Food` | Alimentação | `orange-400` |
| `Salaries` | Salários | `emerald-400` |
| `Healthcare` | Saúde | `rose-400` |
| `Utilities` | Utilidades | `sky-400` |
| `Unknown` | Desconhecida | `zinc-400` |
| `Transport` | Transporte | `blue-400` |
| `Help` | Ajuda (a terceiros) | `pink-400` |
| `PJ` | PJ | `indigo-400` |
| `Bills` | Contas | `amber-400` |
| `Emergency` | Emergência | `red-400` |
| `Uncategorized` | Sem categoria | `slate-400` |
| `Wishes` | Desejos | `fuchsia-400` |
| `Reversal` | Estorno (de compras) | `teal-400` |
| `Shopping` | Compras | `lime-400` |
| `Pets` | Pets | `yellow-400` |
| `Investments` | Investimentos | `green-400` |

Contas existentes por banco: `Nubank` `purple-400`, `SofisaDireto` `teal-400`, `Neon` `sky-400`, `XP` `zinc-400`, `Other` `slate-400`. As 17 cores são 17 famílias distintas das 22.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --------- | -------- | ---------- |
| `CategoryOptionLabel` | `web/src/features/categories/CategoryOptionLabel.tsx` | Único ponto de conteúdo dos itens e do valor dos selects: passa a renderizar `CategoryBadge`; nenhuma tela de select muda |
| `CategorySelect` | `web/src/features/categories/CategorySelect.tsx` | Sem mudança de código: o `SelectValue` do Radix mostra o conteúdo do item selecionado, então o gatilho também vira badge |
| `AccountSelect` | `web/src/features/accounts/AccountSelect.tsx` | Troca `{account.nickname}{inativa}` por `AccountLabel` (mesmo texto acessível) |
| `Badge` | `web/src/components/ui/badge.tsx` | Base visual do `CategoryBadge` (classes do mapa por cima) |
| `Popover` | `web/src/components/ui/popover.tsx` | Container do `ColorPicker` (mesmo padrão do `DatePicker`) |
| `useCategories`, `useAccounts` | `web/src/features/categories/hooks.ts`, `web/src/features/accounts/hooks.ts` | Base dos mapas `useCategoryLookup`/`useAccountLookup` do extrato e do preview |
| `messageForError`, `fieldForError` | `web/src/lib/api/errorMessages.ts` | Erro de `color` nos formulários (`fieldForError(reason) === "color"`) |
| `bank` validation pattern | `api/src/modules/accounts/routes.ts:25-60` | O `color` segue o mesmo desenho: `Type.String` no corpo, validação no handler, 422 com campo |
| `categories` PATCH com `assertEditable` | `api/src/modules/categories/routes.ts:67,134` | A regra 403 `category_protected` já cobre a cor |
| `seed_categories` | `supabase/migrations/0002_accounts_categories.sql` | Redefinida com `create or replace` e a coluna `color` |
| `Landmark` (lucide-react) | `web/src/features/accounts/AccountsPage.tsx` | Ícone genérico do `BankIcon` |
| `bankLabels` | `web/src/features/accounts/AccountsPage.tsx:20`, `AccountForm.tsx` (`banks`) | Movidos para um módulo único (`bankLabels` em `BankIcon.tsx`) usado pelos dois |
| Test helpers | `api/test/helpers/db.ts` (`createTestUser`, `getAdminSql`), `web/src/test/apiSpy.tsx` (`renderWithQuery`, `responses`) | Testes de integração e de componentes seguem o mesmo padrão |

### Integration Points

| System | Integration Method |
| ------ | ------------------ |
| Postgres (`supabase/migrations`) | Migrations 0008 e 0009 aditivas (a 0009 remapeia `-600`/`-900` para `-400`, troca o `check` do domínio e o padrão das colunas); policies de RLS intocadas; `seed_categories` redefinida |
| API accounts/categories | `color` nos schemas e no `columns`; sem mudança em `transactions`, `import`, dashboards |
| `api/openapi.json` | Regenerado por `pnpm -C api openapi:export`; elo de sincronia com o web |
| Tailwind v4 | `@source "../src"` em `web/src/styles.css` encontra as classes literais de `palette.ts`; nenhuma mudança de configuração |
| Vite | `import x from "./nubank.svg"` devolve a URL do arquivo (assets abaixo de 4 KB podem virar `data:`); sem plugin novo |
| `react-query` | `["accounts", ...]` e `["categories"]` já são invalidados nas mutações; os mapas do extrato leem os mesmos caches |

---

## Components

### Paleta da API (`palette.ts`)

- **Purpose**: Fonte única da lista de chaves na API.
- **Location**: `api/src/lib/palette.ts`
- **Interfaces**:
  - `COLOR_FAMILIES: readonly [...]` e `COLOR_SHADE = 400`
  - `COLOR_KEYS: readonly ColorKey[]` - `<família>-400` na ordem das famílias (a mesma ordem do web)
  - `type ColorKey`
  - `isColorKey(value: string): value is ColorKey` - igualdade exata (sem trim nem caixa)
  - `DEFAULT_COLOR = "slate-400"`
- **Dependencies**: nenhuma.
- **Reuses**: o desenho de `BANKS` em `accounts/routes.ts`.

### Migration 0008 e 0009 (0009_palette_400.sql)

- **Purpose**: Domínio da paleta, colunas, preenchimento e semente com cor.
- **Location**: `supabase/migrations/0008_colors.sql`
- **Interfaces** (ordem do arquivo):
  1. `create domain public.palette_color as text check (value in (<66 chaves>))` (0008); a 0009 solta o `check` (`palette_color_check`), remapeia por `regexp_replace(color, '-(600|900)$', '-400')` no bloco `-- remap:begin` / `-- remap:end`, recria o `check` com as 22 chaves (`not valid` e `validate`), move os padrões das colunas para `slate-400` e redefine `seed_categories` com as 17 cores em 400
  2. `alter table public.categories add column color public.palette_color not null default 'slate-600'` e o mesmo em `accounts` (o Postgres preenche as linhas existentes com o padrão)
  3. Bloco entre os comentários `-- backfill:begin` e `-- backfill:end`: `update public.categories set color = case key when 'Entertainment' then 'purple-600' ... end where key in (...)` e `update public.accounts set color = case bank when 'Nubank' then 'purple-600' ... end`; o teste de integração extrai esse bloco do arquivo e o executa
  4. `create or replace function public.seed_categories(p_user uuid)` com a lista de 17 linhas agora com a coluna `color` (mesmos nomes, chaves e `is_system` da 0002), `security definer`, `set search_path = public`, `on conflict do nothing`, mais o `revoke execute ... from public, anon, authenticated` (o `create or replace` mantém os grants, mas o revoke é repetido por clareza e é idempotente)
  5. `handle_new_user` não é redefinida: continua chamando `seed_categories` (definição vigente na 0002; a 0007 não a toca)
- **Dependencies**: 0002 (tabelas e função), 0007 aplicada antes.
- **Reuses**: o estilo e a lista de 17 categorias de `0002_accounts_categories.sql`.

### Rotas de contas

- **Purpose**: Aceitar e devolver `color`.
- **Location**: `api/src/modules/accounts/routes.ts`
- **Interfaces**:
  - `AccountSchema.color = Type.Unsafe<ColorKey>({ type: "string", enum: [...COLOR_KEYS] })`
  - `CreateBody.color` e `UpdateBody.color` = `Type.Optional(Type.String({ description: "One of: ..." }))`
  - `validColor(value: string): ColorKey` - lança `AppError("validation_error", 422, "color must be one of the palette keys", "color")`
  - `columns` inclui `color`; `AccountRow` e `toAccount` incluem `color`
  - POST: `color` ausente não entra no `insert` (vale o padrão do banco); PATCH: `patch.color` quando presente
- **Dependencies**: `palette.ts`, migration 0008.
- **Reuses**: `validBank`, `invalid`, o `tx(patch)` do PATCH.

### Rotas de categorias

- **Purpose**: Aceitar e devolver `color`; PATCH com `name` e `color` opcionais.
- **Location**: `api/src/modules/categories/routes.ts`
- **Interfaces**:
  - `CategorySchema.color` como em contas
  - `CreateBody = { name: string; color?: string }`; `UpdateBody = { name?: string; color?: string }`
  - PATCH: valida os campos presentes antes de abrir a transação (nome em branco 422, cor inválida 422); dentro de `withUser`: `assertEditable` (403 se de sistema), depois `update ... set ${tx(patch)}`; corpo vazio devolve a linha (um `select`) depois do `assertEditable`
  - `columns` inclui `color`
- **Dependencies**: `palette.ts`, migration 0008.
- **Reuses**: `validName`, `assertEditable`, `isNameConflict`, `duplicateName`.

### Paleta do web (`palette.ts`)

- **Purpose**: Chaves, nomes em português e mapa de classes literais.
- **Location**: `web/src/features/colors/palette.ts`
- **Interfaces**:
  - `COLOR_FAMILIES`, `COLOR_SHADES`, `COLOR_KEYS: readonly ColorKey[]` (mesma ordem da API), `type ColorKey`
  - `isColorKey(value: unknown): value is ColorKey`
  - `DEFAULT_COLOR: ColorKey = "slate-400"`
  - `colorLabel(key: ColorKey): string` - `"Azul"` (nomes da tabela das Assumptions, só a família)
  - `COLOR_CLASSES: Record<ColorKey, { bg: string; text: string }>` - 22 entradas literais (ex.: `"blue-400": { bg: "bg-blue-400", text: "text-blue-800" }`); regra do texto: `text-<família>-800` da mesma família do fundo (decisão do dono); o contorno do badge e dos swatches segue `ring-1 ring-black/10 dark:ring-white/25`
  - `colorClasses(value: string | undefined): { bg: string; text: string }` - cor fora do mapa cai em `DEFAULT_COLOR`
- **Dependencies**: nenhuma.
- **Reuses**: nada; o arquivo é a única definição.

### ColorPicker

- **Purpose**: Gatilho e popover com a grade de 22 cores (4 linhas de 6 colunas, a última com 4). Setas esquerda e direita movem 1; cima e baixo movem 6; quando o destino cai fora da grade o foco fica onde está (clamp, inclusive nas células 16 e 17, sem célula abaixo). `focusIndex` volta ao item selecionado a cada abertura.
- **Location**: `web/src/features/colors/ColorPicker.tsx`
- **Interfaces**:
  - `ColorPicker({ value, onChange, id, disabled, ariaLabel? })`, `value: string` (aceita chave desconhecida), `onChange(key: ColorKey)`
  - Gatilho: `Button variant="outline"` com o swatch (`bg` da cor) e `colorLabel(value)`; `id` repassado
  - Popover: `div role="radiogroup" aria-label="Paleta de cores"` com `grid grid-cols-6 gap-1`; cada cor é `button role="radio" aria-checked aria-label={colorLabel(key)} tabIndex={roving}`; selecionado leva `Check` (ícone com a classe `text` da entrada) e `ring-2 ring-offset-2 ring-ring`
  - Teclado: setas ±1/±6 limitadas à grade (sem dar a volta), Home/End, Enter/Espaço (clique nativo do botão); escolher ou Esc fecha e o Radix devolve o foco ao gatilho
  - Foco inicial ao abrir: o selecionado, ou o primeiro se o valor é desconhecido
- **Dependencies**: `palette.ts`, `Popover`, `Button`.
- **Reuses**: o padrão Popover + trigger de `web/src/components/ui/date-picker.tsx`.

### CategoryBadge e CategoryOptionLabel

- **Purpose**: Badge colorido da categoria; conteúdo único dos selects.
- **Location**: `web/src/features/categories/CategoryBadge.tsx`; `CategoryOptionLabel.tsx` (modify)
- **Interfaces**:
  - `CategoryBadge({ name, color, className? })`: `Badge variant="outline"` com `cn(bg, text, "border-transparent ring-1 ring-inset ring-black/10 dark:ring-white/25 max-w-full truncate")`, `title={name}`
  - `CategoryOptionLabel({ category })` -> `<CategoryBadge name={category.name} color={category.color} />`
  - `useCategoryLookup(): { byId: Map<string, Category>; ready: boolean }` em `categories/hooks.ts`
- **Dependencies**: `palette.ts`, `Badge`, `useCategories`.
- **Reuses**: `CategoryOptionLabel` já usado por `CategorySelect`; `Badge`.

### BankIcon e AccountLabel

- **Purpose**: Ícone do banco em moldura uniforme; rótulo de conta (ícone, apelido, ponto de cor).
- **Location**: `web/src/features/accounts/BankIcon.tsx`, `AccountLabel.tsx`, `web/src/assets/banks/*.svg`, `NOTICE`
- **Interfaces**:
  - `bankLabels: Record<Bank, string>` (`Nubank`, `Sofisa Direto`, `Neon`, `XP`, `Outro`)
  - `BankIcon({ bank, size?: "sm" | "lg", decorative?: boolean })`: moldura `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md` de `size-5` (sm) ou `size-8` (lg), mais `bg-muted text-muted-foreground` só no `Landmark`; `<img src alt="" aria-hidden className="size-full" onError>` (sem padding, sem anel, sem fundo branco; o SVG quadrado de fundo sangrado preenche a moldura); `onError` (estado local) troca para `Landmark`; `decorative={false}` -> `role="img" aria-label="Banco <rótulo>"` e sem `aria-hidden`
  - mapa interno `Record<Exclude<Bank,"Other">, string>` de URL importada de `nubank.svg`, `sofisa-direto.svg`, `neon.svg`, `xp.svg`; qualquer outra chave usa `Landmark`
  - `AccountLabel({ account, showInactive? })`: `<span class="flex min-w-0 items-center gap-2">` com `BankIcon`, `<span class="truncate">{account.nickname}{showInactive && !account.active ? " (inativa)" : ""}</span>` e o ponto `span aria-hidden size-2.5 shrink-0 rounded-full {bg}`
  - `useAccountLookup(): { byId: Map<string, Account>; ready: boolean }` em `accounts/hooks.ts` sobre `useAccounts()` (todas as contas)
- **Dependencies**: `palette.ts`, `lucide-react`, os SVGs.
- **Reuses**: `Landmark` e `bankLabels` hoje duplicados.

### Assets dos bancos

- **Purpose**: Quatro SVGs inertes e o registro de origem.
- **Location**: `web/src/assets/banks/` (`nubank.svg`, `sofisa-direto.svg`, `neon.svg`, `xp.svg`, `NOTICE`)
- **Interfaces**: arquivos de origem em `Tgentil/Bancos-em-SVG` (branch `main`, commit anotado no `NOTICE` ao copiar): `Nu Pagamentos S.A/nubank-logo-fundo-roxo2021.svg` -> `nubank.svg`; `Banco Sofisa/logo-sofisa.svg` -> `sofisa-direto.svg`; `Neon/header-logo-neon.svg` -> `neon.svg` (letreiro largo recomposto no quadrado); `XP Investimentos/xp-investimentos-logo.svg` -> `xp.svg`
- **Contrato visual (ICON-01, ajuste pontual)**: cada arquivo é um quadrado `viewBox="0 0 2500 2500"` cujo primeiro elemento é um `rect` 2500 por 2500 sem `rx`/`ry` na cor da marca (Nubank `#820ad1`, Sofisa branco, Neon `#0f92ff` com letreiro branco, XP preto), com o logo centralizado e sem cantos arredondados próprios; o arredondamento é só da moldura do `BankIcon`. Exceção declarada: no XP o "p" sai pela borda inferior direita, como no desenho original, então o desenho não fica centrado no quadrado.
- **Dependencies**: nenhuma.
- **Reuses**: nada.

### Integração nas telas

- **Purpose**: Usar os componentes onde conta e categoria aparecem.
- **Location**: `AccountForm.tsx`, `AccountsPage.tsx`, `AccountSelect.tsx`, `CategoriesPage.tsx`, `TransactionsPage.tsx`, `ImportPreviewTable.tsx`, `features/*/api.ts`, `lib/api/types.ts`, `lib/api/mock/{accounts,categories}.ts`
- **Interfaces**:
  - `AccountForm`: novo estado `color` (inicia `DEFAULT_COLOR` ou a da conta), campo "Cor" (`Label htmlFor="account-color"` + `ColorPicker id="account-color"`), `color` no `AccountInput`; erro 422 em `color` mostra "Escolha uma cor da paleta."
  - `AccountsPage`: cartão com a faixa `span aria-hidden w-1.5 self-stretch rounded-full {bg}`, `BankIcon size="lg"`, apelido e rótulo; importa `bankLabels` do `BankIcon`
  - `CategoriesPage`: `submitNew` envia `{ name, color }`; edição envia `{ id, name, color }` por `updateCategory`; lista mostra `CategoryBadge`; botão "Salvar categoria"; o `renameCategory`/`useRenameCategory` viram `updateCategory`/`useUpdateCategory`
  - `TransactionsPage`: `useAccountLookup` na linha e no cartão; célula da conta -> `AccountLabel` (sem `showInactive`) quando a conta existe no mapa, senão o texto `accountNickname`
  - `ImportPreviewTable`: linhas `ignored`/`invalid` e o fallback de falha de categorias: `CategoryBadge` quando `useCategoryLookup` tem a categoria (`byId.get(row.categoryId)`), senão `row.categoryName` em texto
  - `api.ts` de contas e categorias: `createCategory({ name, color? })`, `updateCategory({ id, name?, color? })`
  - `types.ts`: `Account.color: ColorKey`, `AccountInput` e `AccountUpdate` com `color`, `Category.color: ColorKey`
  - mocks: `listMockAccounts`/`listMockCategories` e handlers com `color`, `isColorKey` do `palette.ts`
- **Dependencies**: todos os componentes acima.
- **Reuses**: as próprias telas; sem mudar rotas nem layout geral.

---

## Data Models

```sql
create domain public.palette_color as text
  check (value in ('red-400','orange-400', /* ... 22 chaves, só -400 (0009; a 0008 criou 66) ... */ 'stone-400'));

alter table public.categories add column color public.palette_color not null default 'slate-400';
alter table public.accounts   add column color public.palette_color not null default 'slate-400';
```

```typescript
// api/src/lib/palette.ts and web/src/features/colors/palette.ts (same list, same order)
export type ColorFamily = "red" | "orange" | /* ... 22 */ "stone";
export type ColorKey = `${ColorFamily}-400`;

// web/src/lib/api/types.ts
export type Account = { id: string; bank: Bank; nickname: string; holderNames: string[];
  active: boolean; color: ColorKey; createdAt: string };
export type AccountInput = Pick<Account, "bank" | "nickname" | "holderNames"> & { color?: ColorKey };
export type AccountUpdate = Partial<AccountInput>;
export type Category = { id: string; key: string | null; name: string; isSystem: boolean; color: ColorKey };
```

**Relationships**: nenhuma relação nova; `color` é atributo de `accounts` e `categories`. As policies de RLS existentes cobrem a coluna.

**Sincronia das listas (três vigilâncias)**:

| Teste | Onde | Compara | Falha quando |
| ----- | ---- | ------- | ------------ |
| Forma da paleta da API | `api/src/lib/palette.test.ts` (unit) | 22 famílias, tom único 400, sem repetição, formato `^[a-z]+-400$`, `DEFAULT_COLOR` na lista, `isColorKey` exato | uma chave some, repete ou muda de formato |
| Banco × API | `api/test/colors-schema.int.test.ts` (integração) | as chaves do domínio (consulta a `pg_constraint` com `contypid`) × `COLOR_KEYS` | o SQL e a constante divergem |
| OpenAPI × web | `web/src/features/colors/paletteContract.test.ts` (unit) | `enum` de `color` em contas e categorias de `api/openapi.json` × `COLOR_KEYS` do web | a API mudou a lista e o web não |

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| -------------- | -------- | ----------- |
| `color` string fora da lista no POST/PATCH | `AppError("validation_error", 422, ..., "color")` antes de tocar o banco | Formulário mostra "Escolha uma cor da paleta." e mantém o digitado |
| `color` com tipo errado (`null`, número, objeto) | Schema do Fastify: 400 `validation_error` com o campo | Mensagem genérica "Dados inválidos. Revise os campos" (o front nunca envia isso) |
| Categoria de sistema recebe PATCH de cor | `assertEditable` -> 403 `category_protected` | A página nem oferece edição de sistema; se chegar, "Categoria protegida" |
| Nome em conflito junto de cor válida | `update` falha com 23505 na mesma transação, nada é gravado | "Já existe uma categoria com esse nome" |
| Cor desconhecida vinda da API (versão futura) | `colorClasses` cai em `slate-400`; `ColorPicker` abre sem seleção | Badge e ponto cinza-escuros; nada quebra |
| SVG do banco não carrega | `onError` do `<img>` troca para o ícone genérico | Ícone `Landmark` no lugar |
| Banco desconhecido | O mapa não tem a chave -> `Landmark` | Ícone genérico |
| Lista de contas ou de categorias carregando ou com erro no extrato/preview | O mapa fica vazio e `ready` falso; a célula mostra o texto de hoje | Extrato igual ao de antes, sem ícone nem badge, até a lista chegar |
| Falha ao salvar conta ou categoria (qualquer outro erro) | `messageForError(reason, context)`; diálogo ou edição ficam abertos | Mensagem em português no formulário |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| ------- | -------------------- | ------ | ---------- |
| Os 22 mapeamentos de classes têm que ser literais para o Tailwind gerar; um template string (`bg-${f}-${s}`) passaria no teste de chaves e sairia sem CSS | `web/src/styles.css:2` (`@source "../src"`), `web/src/features/colors/palette.ts` (novo) | Badges e swatches sem cor em produção | Teste unitário confere por regex que cada `bg`/`text` é exatamente a string esperada (`bg-<família>-400` e `text-<família>-800`), e um teste lê o arquivo-fonte e falha se houver `${` dentro de `COLOR_CLASSES`; verificação no navegador no fim |
| O par mandatado `text-<família>-800` sobre `bg-<família>-400` não chega a 4,5:1 em 16 famílias (red, orange, amber, yellow, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose); passam lime, slate, gray, zinc, neutral e stone. Desvio conhecido, decisão do dono | `web/src/features/colors/palette.ts` | Texto ilegível se alguém trocar a regra | O teste de contraste lê `tailwindcss/theme.css`, mantém o limiar de 4,5 e afirma a lista exata das famílias abaixo dele (falha tanto se uma nova família cair quanto se uma da lista passar a cumprir); o parser trata `none` como matiz 0, usado por `neutral` |
| `Badge` do shadcn é um `div`; dentro do `ItemText` do Radix (um `span`) pode gerar aviso de aninhamento no console do teste | `web/src/components/ui/badge.tsx:29` | Ruído ou falha em teste que falha com `console.error` | `CategoryBadge` usa `Badge` com `className="inline-flex"`; se aparecer o aviso, o `Badge` troca o elemento raiz por `span` (mudança de uma linha com teste) |
| O gatilho do Select mostra o conteúdo do item selecionado só depois que os itens montam; com o select fechado, o Radix usa o `SelectValue` do item registrado | `web/src/features/categories/CategorySelect.tsx` | Gatilho sem badge se a lista ainda não montou | O `CategorySelect` já renderiza os itens no `SelectContent` com a lista pronta; teste do gatilho com valor (AC 2 do badge em selects) e o estado de carga existente |
| Testes existentes usam o texto do `CategoryOptionLabel` mockado (`label:<nome>`) e `getByRole("option", { name })` | `web/src/features/categories/CategorySelect.test.tsx:12-18` | Quebra por mudança de renderização | O mock do rótulo continua válido (a feature não muda o contrato do componente); os testes do badge são novos e o nome acessível do `option` é conferido |
| Fixtures de `Account` e `Category` em vários testes ganham `color` obrigatório | `web/src/features/accounts/accounts.test.tsx`, `categories/categories.test.tsx`, `transactions/transactions.test.tsx`, `transactions/extratoCrud.test.tsx`, `creditExpenses/CreditExpenseForm.test.tsx`, `dashboard/InvestmentReturns.test.tsx` | `typecheck` quebra no primeiro commit de tipos | A task de tipos e mocks atualiza as fixtures no mesmo commit (spec: fixtures dos testes) |
| `PATCH /categories/:id` deixa de exigir `name` (antes 400 se faltasse) | `api/src/modules/categories/routes.ts:17,125-140`, `api/test/categories.int.test.ts:112` | Clientes que dependiam do 400 para corpo vazio | Nenhum cliente conhecido (o web sempre envia `name`); mudança registrada nas Assumptions e o teste existente é ajustado para o novo contrato |
| A migration usa `create domain`, tipo que o `postgres.js` devolve como texto; as colunas aparecem como `text` na introspecção | `api/test/accounts-categories-schema.int.test.ts` | Teste de schema que checa `data_type` pode falhar | O teste novo checa `domain_name = 'palette_color'` em `information_schema.columns`; os existentes são revisados no mesmo commit |
| O repositório de logos não tem licença; as marcas pertencem aos bancos | `web/src/assets/banks/` (novo) | Risco de uso fora do pessoal | `NOTICE` com origem, confirmação do dono e aviso; teste de sanidade; os arquivos são trocáveis por um só mapa |
| SVG de terceiros pode conter conteúdo ativo | `web/src/assets/banks/*.svg` (novo) | Script ou recurso externo | Regra de sanitização testada, uso só em `<img>` (sem execução), limite de 12 KB por arquivo |
| O letreiro largo do Neon (2500x543) fica pequeno num quadrado de 20 px | `Neon/header-logo-neon.svg` (origem) | Ícone pouco legível | Recomposição no quadrado (fundo azul, letreiro branco a 84%), registrada no `NOTICE`; conferência visual em 20, 32 e 96 px (a 20 px o letreiro tem cerca de 3 px de altura) |
| Jsdom renderiza 22 botões e um popover por teste do picker | `web/src/features/colors/ColorPicker.test.tsx` (novo) | Teste lento quando a suíte divide a máquina (L-027) | Interações por `fireEvent`, sem calendário nem dropdown aninhado, medição de duas suítes em paralelo e teste mais lento abaixo de 7,5 s; sem aumentar `testTimeout` |
| O extrato resolve conta e categoria por duas listas extras | `web/src/features/transactions/TransactionsPage.tsx:597,657` | Duas consultas a mais na página | As consultas já existem em cache (`useCategories` via `CategorySelect`, `useAccounts` via `AccountSelect`); só `useAccounts()` sem filtro é nova e é a mesma chave da página de contas |
| `AccountSelect` e o extrato usam chaves de consulta diferentes (`{active: true}` vs `{}`) | `web/src/features/accounts/hooks.ts` | Dois caches de contas | Aceito: lista pequena; a invalidação por `["accounts"]` atualiza as duas |

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Onde fica a lista no banco | Domínio `palette_color` | Uma lista só para duas tabelas e erro de check normal |
| Colunas `not null` com padrão | `slate-400` | Sem `null` na API, no mapa e nos testes; preenchimento das linhas existentes pelo próprio `add column` |
| Preenchimento por chave e por banco | `update` com `case` entre marcadores `-- backfill:begin/end` | O teste de integração executa o mesmo bloco; sem lógica duplicada |
| Redefinir `seed_categories`, não `handle_new_user` | `create or replace function public.seed_categories` | É a função que insere; `handle_new_user` só a chama (comportamento igual) |
| Validação de cor | No handler, 422 com campo; lista na descrição do corpo, `enum` na resposta | Igual a `bank`; `enum` no OpenAPI vira o elo de sincronia com o web |
| Sincronia web × API | O teste do web lê `api/openapi.json` | AD-001: o contrato é o OpenAPI; sem pacote compartilhado nem fixture duplicada |
| Chaves em ordem família a família | `COLOR_KEYS` igual nos dois apps | Grade do picker previsível e diff legível |
| Mapa `{ bg, text }` | Literais, uma entrada por chave | O Tailwind só gera classes que aparecem inteiras no código |
| Regra de texto | `text-<família>-800` sobre `bg-<família>-400` | Decisão do dono; contraste medido contra o `theme.css`, com 16 famílias abaixo de 4,5:1 registradas como desvio conhecido |
| Tema claro e escuro | Preenchimento sólido + anel adaptativo | O texto não depende do fundo da página; o anel mostra o contorno |
| Badge no select | Trocar o conteúdo de `CategoryOptionLabel` | Um ponto de mudança para todos os selects; o gatilho acompanha |
| Cor e banco no extrato | Mapas por `id` sobre as listas em cache | Não muda o contrato de transações (fora do escopo); degrada para texto |
| Picker em popover | Gatilho + `radiogroup` de 22 radios, 6 colunas | Cabe nos dois formulários (inline e em diálogo); teclado 2D |
| SVG por `<img>` | Importado pelo Vite | Inerte (sem script nem recurso externo), sem colisão de CSS entre arquivos |
| Moldura uniforme | Quadrado branco 20/32 px com anel | Logos de formatos diferentes e legíveis nos dois temas |
| Ícone genérico | `Landmark` (lucide) | Já no projeto; sem arquivo novo |
| Cor da conta | Ponto no rótulo e faixa na lista | Detalhe discreto, redundante com o apelido (a11y) |
| Testes de contraste e de sanidade lendo arquivos | Leitura de `theme.css` e dos SVGs no teste | Evidência objetiva; falha ao trocar um arquivo |
