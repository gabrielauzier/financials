# Prontidão para iniciar o backend (feature `auth`)

**Verificado em 2026-10-04.** Escopo: tasks de API de `features/auth/tasks.md`, T1 a T13 (fases 1 e 2). As tasks T14 a T20 (web) foram substituídas pelo Lovable e não entram.

## Veredito

Pronto em especificação, design e tasks. **Falta ligar o Docker** (bloqueia T5 em diante) e tomar 4 decisões rápidas antes de começar.

## Artefatos

| Item | Situação |
| ---- | -------- |
| `spec.md`, `design.md`, `tasks.md` de `auth` | Existem; specs e tasks passam nos validadores (`validate_spec.py`, `validate_tasks.py`) |
| Decisões de arquitetura (`.specs/STATE.md`, AD-001 a AD-005) | Registradas |
| Matriz de testes e comandos (`pnpm -C api test:unit`, `test:int`, `test`, `typecheck`, `lint`) | Definidos nas tasks; os scripts serão criados por T1 |
| Comandos do front nas tasks | Corrigidos de `pnpm -C web` para `yarn --cwd web` |
| Pasta `api/` e `supabase/` | Ainda não existem (criadas por T1 e T5) |

## Ferramentas e ambiente

| Requisito | Situação |
| --------- | -------- |
| Node | ✅ v22.22.0 |
| pnpm (gerenciador da API) | ✅ 10.28.1 |
| yarn (front) | ✅ 1.22.22 |
| git | ✅ 2.49.0, branch `main` |
| psql | ✅ 14.18 (útil para inspecionar o banco local) |
| Docker (CLI) | ✅ 28.0.4 |
| **Docker daemon** | ❌ **Não está rodando**. `supabase start` (T5, T6 e todos os testes de integração) não funciona sem ele |
| Supabase CLI | ⚠️ Não está no PATH; disponível via `npx supabase` (2.119.0). Decidir: usar `npx supabase` ou instalar globalmente (`brew install supabase/tap/supabase`) |
| Portas 54321 a 54324 e 5432 | ✅ Livres |
| Disco | ⚠️ Partição de dados com 15 GiB livres (93% usada). As imagens do Supabase local ocupam alguns GB; monitorar |

## Riscos a verificar nas primeiras tasks

- **JWT local com chaves assimétricas**: o CLI 2.119 pode usar chaves de assinatura assimétricas no stack local, enquanto T6 mintaria tokens HS256. T6 deve ler a configuração real com `supabase status -o env` e T9 já suporta JWKS e HS256. Não dá para confirmar sem o Docker rodando.
- **`signUp` duplicado** (T13): o comportamento real do GoTrue define a mensagem "E-mail já cadastrado" (AUTH-01.5); o front já usa a regra provisória `identities` vazio.
- **`SET ROLE authenticated`** (T8): a conexão local como `postgres` deve permitir; o teste de fumaça de T8 confirma.

## Git

- A árvore tem mudanças não commitadas (front v3.1, `.specs`, `.lovable/sync-codebase.sh`, backups e zips). O fluxo exige **um commit atômico por task**, então convém commitar o estado atual em commits separados e trabalhar numa branch (sugestão: `feat/backend-auth`).
- O `.gitignore` da raiz só tem `.claude`; T1 deve criar `api/.gitignore` (`node_modules`, `dist`, `.env`), e `supabase/.temp`, `supabase/.branches` devem ser ignorados na T5.
- Nenhum push ou deploy será feito sem pedido explícito.

## Decisões necessárias para começar

| # | Decisão | Recomendação |
| - | ------- | ------------ |
| 1 | Aprovar tasks de `auth`, matriz de testes e `pnpm` para a API | Aprovar |
| 2 | Execução: inline nesta sessão ou em lotes com sub-agents (auth tem 13 tasks de API, cerca de 2 lotes) | Inline para auth; revisar nas features maiores |
| 3 | Supabase CLI: `npx supabase` ou instalação global | `npx supabase` (sem instalar nada) |
| 4 | **D4**: o projeto Supabase `unyohhnzkhsnlnrrcfms` do Lovable é seu (acesso ao dashboard, senha do banco e JWT)? Isso só bloqueia a integração real, não T1 a T13, que usam o stack local | Confirmar antes de integrar o front com a API |
