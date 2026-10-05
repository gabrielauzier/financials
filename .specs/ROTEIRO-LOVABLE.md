# Roteiro de execução dos prompts Lovable

O front é construído no Lovable. Cada feature tem **um único prompt** em `.specs/features/<feature>/lovable.md`, que substitui as tasks de interface (fases "Web" de cada `tasks.md`). A API (Fastify + Supabase) continua sendo feita pelas tasks de `api/` e `supabase/`.

## Como os dois trabalhos se encaixam

- O front só conversa com o Supabase para **autenticação**; todos os dados vêm da API (AD-001, AD-002).
- Enquanto uma área da API não existe, o front roda com **mocks em memória** que reproduzem o contrato (códigos de erro incluídos). A variável `VITE_MOCK_AREAS` define quais áreas usam mock (`*` = todas, vazio = nenhuma). Quando a API de uma área fica pronta, remove-se a área da lista e o front passa a chamar `VITE_API_URL`.
- Por isso os prompts podem rodar **em paralelo** à implementação da API, na mesma ordem de features.

## Passo 0 — Preparação (uma vez)

1. Criar o projeto Supabase (ou usar o local do `supabase start`) com **confirmação de e-mail ligada**; anotar URL e anon key.
2. Criar o projeto no Lovable, conectar a integração com o Supabase **apenas para autenticação** e ativar a sincronização com o GitHub.
3. Definir como o código do Lovable entra neste repositório como `web/` (**decisão pendente**, ver D1 abaixo).
4. Configurar no Lovable as variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL` (pode ficar vazia no início) e `VITE_MOCK_AREAS=*`.

## Passo a passo dos prompts

Rodar na ordem. Cada prompt depende dos anteriores (reusa componentes e o cliente da API).

| # | Prompt | Depende de | Entrega no front | Tasks substituídas |
| - | ------ | ---------- | ---------------- | ------------------ |
| 1 ✅ | [auth](features/auth/lovable.md) | Passo 0 | Fundação: cliente da API, mocks, formatação, layout, cadastro, login, rota protegida | auth T14–T20 |
| 2 ✅ | [accounts-categories](features/accounts-categories/lovable.md) | 1 | `/contas`, `/categorias`, `AccountSelect`, `CategorySelect` | accounts-categories T12–T16 |
| 3 ✅ | [transactions](features/transactions/lovable.md) | 1, 2 | `/extrato` com filtros, formulário, edição inline, lote, neutra | transactions T13–T21 |
| 4 ⏸ | [import](features/import/lovable.md) | 1, 2, 3 | `/importar` com prévia obrigatória e resumo | import T19–T23 |
| 5 | [credit-expenses](features/credit-expenses/lovable.md) | 1, 2 | `/cartao` com status manual | credit-expenses T8–T12 |
| 6 | [dashboards](features/dashboards/lovable.md) | 1, 2 | `/` com painéis, patrimônio e rendimentos | dashboards T14–T20 |

Os prompts 3, 4, 5 e 6 só dependem de 1 e 2 (e 4 também de 3 para o botão "Ver extrato"); a ordem acima segue a das features da API.

### Rotina de cada prompt

1. Abrir `features/<feature>/lovable.md` e colar o bloco do prompt no chat do Lovable (um prompt por vez; não juntar).
2. Esperar o Lovable terminar e abrir o preview com `VITE_MOCK_AREAS=*`.
3. Percorrer o **Checklist de aceite** do mesmo arquivo; o que falhar vira uma mensagem de correção curta no Lovable (citando o item do checklist).
4. Salvar o zip exportado do Lovable em `.lovable/codebases/` (ex.: `v3-transactions.zip`) e sincronizar com `.lovable/sync-codebase.sh --dry-run v3-transactions` seguido de `.lovable/sync-codebase.sh v3-transactions` (preserva `node_modules`, `.git`, `.env*` e `yarn.lock`; o que for sobrescrito vai para `.lovable/backups/`). Depois rodar localmente, dentro de `web/`, `yarn typecheck`, `yarn lint` e `yarn test`.
5. Só avançar para o próximo prompt com os três comandos verdes e o checklist completo; fazer um commit por prompt.

## Troca de mocks pela API real (pontos de integração)

Quando as tasks de API de uma feature estiverem concluídas e verificadas, retirar a área do `VITE_MOCK_AREAS` e repetir o checklist do prompt contra a API real.

| Área(s) em `VITE_MOCK_AREAS` | Pode sair do mock quando | Observação |
| ---------------------------- | ------------------------- | ---------- |
| login/cadastro (não usam mock) | auth T1–T13 concluídas (JWT validado, `withUser`, RLS) | Login funciona só com o Supabase; as rotas da API passam a exigir o token |
| `accounts`, `categories` | accounts-categories T1–T11 concluídas | Confirmar seed de 17 categorias e códigos de erro |
| `transactions` | transactions T1–T12 concluídas | Confirmar fuso (`X-Timezone`) nos filtros de data |
| `import` | import T1–T18 concluídas | Testar com `references/exemplo_extrato_nubank.csv` e `exemplo_fatura_nubank.csv` |
| `creditExpenses` | credit-expenses T1–T7 concluídas | — |
| `dashboard`, `investmentReturns` | dashboards T1–T13 concluídas | Conferir que a soma por categoria bate com o total de despesas |

Tipos da API: depois de `pnpm -C api openapi:export` (auth T12), gerar localmente os tipos com `openapi-typescript` e substituir `src/lib/api/types.ts` escrito à mão; o `typecheck` deve acusar qualquer divergência de contrato (corrigir no front ou na API conforme a spec).

## Ordem sugerida de trabalho (API e front em paralelo)

```
API auth (T1–T13) ─────────────► Lovable 1 (auth)
API accounts-categories ───────► Lovable 2
API transactions ──────────────► Lovable 3
API import ────────────────────► Lovable 4
API credit-expenses ───────────► Lovable 5
API dashboards ────────────────► Lovable 6
Integração por área (tabela acima) à medida que cada API conclui
```

O prompt de uma feature pode rodar antes ou depois da API correspondente; o único requisito é que o prompt 1 exista antes dos demais.

## O que muda no processo de qualidade

- As fases "Web" dos `tasks.md` deixam de ser executadas pelo fluxo do `tlc-spec-driven`; o gate dessas partes passa a ser: checklist de aceite do prompt + `typecheck`, `lint` e `test` do `web/`. Os prompts exigem testes Vitest, mas o Lovable não garante que eles passem: **rodar localmente é obrigatório** antes de aceitar cada prompt.
- A regra de cálculo continua só na API (AD-003): o front apenas exibe. Qualquer cálculo de total no front é defeito.
- Dinheiro continua string decimal (AD-004) e o fuso vai em `X-Timezone` (AD-005): ambos estão nos prompts e nos checklists.
- A Verifier final de cada feature deve incluir uma conferência manual do checklist do prompt contra a API real, já que o front não tem teste de integração com ela.

## Decisões pendentes

| # | Decisão | Recomendação |
| - | ------- | ------------ |
| D1 | Como o repositório do Lovable vira `web/` neste projeto | Clonar o repositório do Lovable em `web/` (cópia versionada neste repo, sincronizando manualmente após cada prompt); alternativa: submódulo git. Este diretório ainda não é um repositório git |
| D2 | Detecção de "e-mail já cadastrado" | O prompt 1 usa regra provisória (`identities` vazio); a task auth T13 confirma o comportamento real e a função `isEmailAlreadyRegistered` pode precisar de ajuste |

## Registro de execução

| # | Prompt | Situação | Verificação |
| - | ------ | -------- | ----------- |
| 1 | auth | Aplicado e verificado em 2026-10-04 | 7 de 9 itens do checklist ok; `typecheck` e `lint` pendentes de correção de configuração (ver `features/auth/lovable.md`) |
| 2 | accounts-categories | Aplicado e verificado em 2026-10-04 | 8 de 10 itens ok; `typecheck` (script `tsgo`) e `lint` (arquivos Prettier ausentes em `web/`) pendentes; 8 achados em `features/accounts-categories/lovable.md` |
| 3 | transactions | Aplicado (v3) e corrigido (v3.1), verificado em 2026-10-04 | Mocks, datas, `typecheck` e dependência de testes resolvidos; **testes de UI ainda faltando**; achados atualizados em `features/transactions/lovable.md` |
| 4–6 | import, credit-expenses, dashboards | **Pausado** (2026-10-04, ver "Pausa" abaixo) | — |

## Desvios registrados

Detalhes e ações em `features/auth/lovable.md` (seção "Desvios registrados"). Resumo do que afeta as próximas etapas:

- **Stack TanStack Start (SSR)**, não SPA Vite: o próximo código do Lovable segue rotas por arquivo em `src/routes/`; a hospedagem exige Node. Decisão pendente (D3).
- **Gerenciador `yarn`** em `web/` (não pnpm) e chave pública `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Cliente da API sem `FormData`**: o prompt de `import` agora inclui o ajuste; verificar no checklist do prompt 4.
- **Mocks de todas as áreas já existem**; conferir, a cada prompt, que o Lovable ajusta os existentes em vez de duplicar.
- **Dívida de qualidade do front**: corrigir `typecheck` (script `tsgo`) e `lint` (Prettier em 100 colunas) antes de aceitar o prompt 2, para que os gates dos próximos prompts sejam confiáveis.

### Decisões pendentes (adições)

| # | Decisão | Recomendação |
| - | ------- | ------------ |
| D3 | Aceitar TanStack Start (SSR) ou exigir SPA Vite | Aceitar se o deploy em Node for aceitável; caso contrário pedir ao Lovable a migração antes de mais telas |
| D4 | Projeto Supabase do Lovable é o mesmo da API? | Confirmar `project_id` e usar a mesma URL/JWKS na API |

### Achados que afetam as próximas etapas (prompt 2)

- **Aplicar zips sempre com `.lovable/sync-codebase.sh`**: a cópia manual deixou de fora arquivos ocultos (`.prettierrc`, `.prettierignore`), o que explica os 788 erros de lint.
- **`@testing-library/dom` ausente do `package.json`** (alta): `yarn install` limpo quebra todos os testes; declarar a dependência antes de aceitar o prompt 3.
- **`typecheck` com `tsgo`**: ainda aberto desde o prompt 1.
- **Mocks de categorias em uso são fixos**: o prompt de `transactions` deve ligar a exclusão com reatribuição aos mocks de transações.

### Correções enviadas e pendentes

| Prompt | Mensagem | Situação |
| ------ | -------- | -------- |
| 3 transactions | [Mensagem de correção](features/transactions/lovable.md#mensagem-de-correção-enviar-ao-lovable-antes-do-prompt-de-import) | Aplicada em `v3.1-transactions`: mocks conectados, datas locais e `package.json` ok; **testes de UI não entregues** (pendente) |

### Achados que afetam as próximas etapas (prompt 3)

- ~~Mock de transações desconectado dos mocks de contas e categorias~~ **resolvido no v3.1**: o prompt de `import` pode reutilizar `listMockAccounts`, `listMockCategories` e `transactionRelations`.
- **Testes de UI ainda faltando** (média): o gate de `test` passa mas não protege categoria inline, lote, neutra e filtros; o plano do Lovable afirma ter entregado, o código não. Pedir novamente ou validar manualmente.
- ~~Datas em UTC no formulário de edição~~ **resolvido no v3.1** (`toLocalDateInput`).
- ~~`@testing-library/dom` ausente~~ **resolvido no v3.1**; `yarn.lock` ficou fora de sincronia (rodar `yarn install`).
- **`.env` versionado**: decidir a política antes de conectar a API real.

## Pausa do desenvolvimento no Lovable

**Registrada em 2026-10-04**, após a versão **v3.1-transactions** (`.lovable/codebases/v3.1-transactions.zip`, idêntica a `web/` no momento da pausa). O foco passa para o backend (`api/` e `supabase/`), começando pela feature `auth`.

### Estado congelado do front
- Aplicados e verificados: prompts 1 (auth), 2 (accounts-categories) e 3 (transactions, com correções do v3.1).
- Todo o front usa mocks (`VITE_MOCK_AREAS=*`); nenhuma área foi integrada à API real.
- Gates em `web/` na pausa: `yarn test` 35 testes ok, `yarn typecheck` ok, `yarn lint` 0 erros.
- Fases "Web" dos `tasks.md` continuam marcadas como substituídas pelo Lovable; não executar essas tasks no fluxo do backend.

### Pendências que o front carrega até a retomada
| Pendência | Origem | Severidade |
| --------- | ------ | ---------- |
| Testes de UI do extrato não entregues (categoria inline, lote, neutra, debounce, filtros, ordenação, vazio, paginação, exclusão, criar/editar) | v3.1 | Média |
| `yarn.lock` fora de sincronia com `package.json` (`yarn install` resolve) | v3.1 | Baixa |
| `.env` versionado (só chave publicável e id do projeto) | v3 | Baixa |
| Receitas com `text-primary` em vez de verde | v3 | Baixa |
| `AccountsPage` sem tratamento de erro ao ativar/desativar; lacunas de validação no mock de contas | v2 | Baixa |
| Decisões D3 (TanStack Start/SSR) e D4 (projeto Supabase do Lovable é o da API) | prompt 1 | D4 relevante para o backend |
| **Contrato 400 x 422 em contas e categorias**: a API responde 400 `validation_error` para corpo malformado (campo ausente, tipo errado) e 422 só para as regras semânticas; o contrato do prompt 2 diz 422 com `field`. O front já cai na mensagem genérica, mas conferir na integração e ajustar o contrato ou o tratamento de erro | backend accounts-categories | Baixa |
| **`web/src/features/auth/emailExists.ts` precisa de um terceiro critério** para detectar e-mail já cadastrado e não confirmado: `confirmation_sent_at - created_at >= 1000 ms` (hoje esse caso mostra "Verifique seu e-mail" em vez de "E-mail já cadastrado"). O caso de e-mail confirmado já funciona (`user_already_exists`). Achado do backend (T13) | backend auth | Média |

### Como retomar
1. Aplicar qualquer zip novo com `.lovable/sync-codebase.sh` (primeiro `--dry-run`).
2. Reenviar a mensagem pedindo os testes de UI do extrato e confirmar no código que foram entregues.
3. Rodar o prompt 4 (`import`); antes, conferir que o mock de importação usa `listMockAccounts`, `listMockCategories` e `transactionRelations`.
4. Com as APIs prontas, retirar as áreas de `VITE_MOCK_AREAS` na ordem da tabela "Troca de mocks pela API real" e repetir o checklist de cada prompt contra a API real.
