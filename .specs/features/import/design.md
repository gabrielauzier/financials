# Importação de CSV Design

**Spec**: `.specs/features/import/spec.md`
**Status**: Draft

---

## Architecture Overview

A importação é **stateless em duas chamadas**, para que cancelar na prévia não grave nada (IMP-05.10):

1. `POST /imports/preview` (multipart: arquivo + `accountId`): parseia, classifica e devolve as linhas. Nada é gravado.
2. `POST /imports/confirm` (multipart: o mesmo arquivo + `accountId` + `idempotencyKey` + `selections`): reparseia o arquivo no servidor (nunca confia em linhas vindas do cliente), aplica as seleções e grava lote, transações e anexo em uma transação. O arquivo é enviado ao Storage antes da transação; se a transação falhar, o arquivo é removido.

```mermaid
sequenceDiagram
    participant W as web
    participant A as API
    participant P as Postgres
    participant S as Storage
    W->>A: preview(arquivo, accountId)
    A->>A: parser -> classify (dedup + neutras)
    A-->>W: linhas {index,status,neutral,...}
    W->>A: confirm(arquivo, accountId, key, selections)
    A->>A: reparseia e reclassifica
    A->>S: upload {userId}/{batchId}/{arquivo}
    A->>P: BEGIN; batch; transactions; attachment; COMMIT
    A-->>W: resumo {imported, skipped}
    Note over A,S: falha na transação => remove arquivo do Storage
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --------- | -------- | ---------- |
| `withUser`, `AppError`, `request.tz` | `api/src/plugins/*` | Transação e fuso |
| Tabelas `accounts`, `categories`, `transactions` | migrations 0002/0003 | Destino da gravação, titulares para neutras |
| `CategorySelect` etc. | `web/src/features/*` | Reuso na tabela após importar |

### Integration Points

| System | Integration Method |
| ------ | ------------------ |
| Supabase Storage | `supabase-js` criado com o JWT do usuário (`global.headers.Authorization`); bucket privado `imports` com policy por pasta `auth.uid()` |
| `transactions` | FK `import_batch_id` adicionada na migration 0004 |

---

## Components

### `api/src/modules/import/parsers/nubankAccount.ts`

- **Purpose**: Converter o CSV de conta Nubank em `ParsedRow[]`.
- **Interfaces**:
  - `parseNubankAccount(text: string): ParseResult` - detecta cabeçalho `Data,Valor,Identificador,Descrição` (remove BOM), mapeia cada linha.
  - Data `dd/mm/aaaa` → `localDate`; Valor negativo → `Expense`, positivo → `Income`, zero → `invalid`.
  - Descrição Pix: regex `^Transferência (recebida|enviada) pelo Pix - ((?:(?! - ).)+) - ([\d.\/•*-]+) - (.+?) Agência:` (validada nas 14 linhas da amostra) → nome, `counterpartyDocument`, `counterpartyBank`, método `PIX`.
  - `Débito em conta` → `DebitCard`/`Uncategorized`; `Pagamento de fatura` → `BankTransfer`/`Uncategorized`, `Expense`; `Dinheiro guardado com resgate planejado` → `BankTransfer`/`Investments`; demais → `unrecognized` (`BankTransfer`/`Uncategorized`).
- **Dependencies**: `csv-parse`.

### `api/src/modules/import/parsers/nubankInvoice.ts`

- **Purpose**: Converter a fatura Nubank (`date,title,amount`) em `ParsedRow[]`.
- **Interfaces**:
  - `parseNubankInvoice(text: string): ParseResult`.
  - `amount` `1.335,61` → `1335.61`; valor negativo (inclusive `- 1.335,61`) → `ignored`; positivo → `Expense`, `CreditCard`, `Uncategorized`; `title` integral em `name`; `identifier` nulo.

### `api/src/lib/normalize.ts` (criado em accounts-categories)

- **Purpose**: Normalização compartilhada de nomes.
- **Interfaces**: `normalizeName(s: string): string` - NFD, remove diacríticos, minúsculas, colapsa espaços, apara. `collapseSpaces(s)` para o `name` exibido.

### `api/src/modules/import/classify.ts`

- **Purpose**: Dedup e neutras sobre `ParsedRow[]`.
- **Interfaces**:
  - `classify(tx, rows, accountId, tz): ClassifiedRow[]` - status `new | duplicate | ignored | unrecognized | invalid`.
  - Dedup com `identifier`: um `select` por `identifier = any($ids)` na conta; segunda ocorrência no arquivo é `duplicate`.
  - Dedup sem `identifier`: `unnest` das tuplas (nome, dia local, valor, tipo) comparadas com `transactions` da conta (`(occurred_at at time zone $tz)::date`).
  - Neutra: `normalizeName(name)` ∈ conjunto dos `holder_names` normalizados de **todas** as contas do usuário (ativas e inativas).
- **Dependencies**: `withUser`.

### `api/src/modules/import/service.ts` e `routes.ts`

- **Purpose**: Orquestrar preview e confirmação.
- **Interfaces**:
  - `POST /imports/preview` - valida: arquivo ≤ 5 MB, conta ativa de banco Nubank, formato Nubank reconhecido; devolve linhas e totais.
  - `POST /imports/confirm` - valida que cada índice selecionado é `new|duplicate|unrecognized`; insere; resposta `{ batchId, imported, skipped }`; chave de idempotência repetida devolve o resumo existente sem gravar.
- **Dependencies**: parsers, `classify`, Storage client, `withUser`.

### `web/src/features/import`

- **Purpose**: Fluxo escolher conta → arquivo → prévia → confirmar.
- **Interfaces**:
  - `<ImportWizard />` - gera `idempotencyKey` (uuid) ao abrir a prévia.
  - `<ImportPreviewTable />` - badges nova/duplicada/ignorada/não reconhecida; checkbox por linha (duplicadas desmarcadas); toggle de neutra; resumo final.

---

## Data Models

```sql
-- supabase/migrations/0004_imports.sql
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null,
  bank text not null,
  idempotency_key uuid not null,
  row_count int not null,
  imported_count int not null,
  skipped_count int not null,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, idempotency_key),
  foreign key (account_id, user_id) references public.accounts(id, user_id) on delete restrict
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  import_batch_id uuid not null,
  filename text not null,
  mime_type text not null,
  size_bytes int not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  foreign key (import_batch_id, user_id) references public.import_batches(id, user_id) on delete cascade
);

alter table public.transactions
  add foreign key (import_batch_id, user_id) references public.import_batches(id, user_id);

alter table public.import_batches enable row level security;
alter table public.attachments enable row level security;
create policy import_batches_all on public.import_batches for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy attachments_all on public.attachments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Storage: bucket privado `imports`; policy por pasta
insert into storage.buckets (id, name, public) values ('imports', 'imports', false);
create policy imports_own_objects on storage.objects for all to authenticated
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'imports' and (storage.foldername(name))[1] = auth.uid()::text);
```

```typescript
type RowStatus = 'new' | 'duplicate' | 'ignored' | 'unrecognized' | 'invalid'

interface ParsedRow {
  index: number              // posição 0-based no arquivo (chave de seleção)
  localDate: string          // 'YYYY-MM-DD'
  type: 'Income' | 'Expense'
  amount: string             // decimal "1234.56" (AD-004)
  name: string
  paymentMethod: 'PIX' | 'DebitCard' | 'BankTransfer' | 'CreditCard'
  categoryKey: 'Uncategorized' | 'Investments'
  identifier: string | null
  counterpartyDocument: string | null
  counterpartyBank: string | null
  status: RowStatus
  reason?: string
}
interface ClassifiedRow extends ParsedRow { neutral: boolean }
```

**Relationships**: `transactions.import_batch_id` → `import_batches`; `attachments.import_batch_id` → `import_batches`. `occurred_at` da linha = meia-noite de `localDate` em `request.tz`.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| -------------- | -------- | ----------- |
| Cabeçalho não reconhecido | 422 `unsupported_format`, sem prévia | Mensagem do erro |
| Arquivo > 5 MB | 413 `file_too_large` | "Arquivo excede 5 MB" |
| Formato Nubank com conta de outro banco | 422 `bank_mismatch` | "Formato incompatível com a conta" |
| Arquivo vazio / só cabeçalho | 422 `empty_file` | "Arquivo sem linhas" |
| Linha com data/valor inválido | Linha `invalid`, fora da seleção | Aparece na prévia sem checkbox |
| Falha ao gravar | `ROLLBACK` + remoção do arquivo do Storage | Nada importado; mensagem de erro |
| Falha no upload | Aborta antes da transação | Nada importado; mensagem de erro |
| Confirmação repetida | `unique(user_id, idempotency_key)` → devolve o resumo anterior | Sem duplicação |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| ------- | -------------------- | ------ | ---------- |
| Reconfirmação com arquivo diferente do da prévia | `import/service.ts` (a criar) | Índices selecionados apontam para linhas erradas | A API reparseia e valida os índices; o cliente envia o mesmo `File`; teste cobre arquivo alterado entre prévia e confirmação (hash opcional enviado pelo cliente) |
| Remoção do arquivo após falha pode falhar | `import/service.ts` | Arquivo órfão no Storage | Caminho contém `batchId` sem linha no banco; limpeza best-effort e log; tarefa de limpeza fora do MVP |
| Regex de Pix só testada em 14 linhas de uma conta | `parsers/nubankAccount.ts` | Linhas válidas viram `unrecognized` | Tratamento de `unrecognized` já importável e sinalizado; fixtures reais adicionadas ao crescer |
| Dedup por nome+data+valor marca como duplicada compra legítima idêntica na reimportação | `import/classify.ts` | Falso positivo | Usuário desmarca a flag na prévia (IMP-05.6) |
| Parsers de Sofisa, Neon e XP ausentes | `parsers/` | Sem importação desses bancos | Interface `Parser` por banco; importação de outro banco responde `unsupported_format` até haver amostra |
| Arquivo de entrada não confiável | `import/service.ts` | CSV malicioso/grande | Limite 5 MB, parsing em memória com `csv-parse`, sem execução de conteúdo |

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Estado da prévia | Stateless (reenvio do arquivo no confirm) | Spec exige que cancelar não grave lote nem anexo |
| Idempotência | `idempotency_key` único por usuário | Confirmação repetida não duplica (IMP-05.11) |
| Gravação em lote | Um `INSERT ... SELECT unnest(...)` por lote | Atomicidade e desempenho |
| Upload antes da transação | Compensação por remoção do arquivo | Postgres e Storage não compartilham transação |
| Detecção de formato | Pelo cabeçalho, validada contra o banco da conta | Impede fatura num extrato e vice-versa por engano |
