# Contas e Categorias — Prompt Lovable

**Specs**: `.specs/features/accounts-categories/spec.md` · **Design**: `.specs/features/accounts-categories/design.md`
**Substitui as tasks de interface**: T12–T16 de `tasks.md` (hooks, página de contas, `AccountSelect`, página de categorias, `CategorySelect`).
**Pré-requisito**: prompt de `auth` aplicado (cliente da API, mocks, layout, `formatBRL`).

## Prompt (colar no Lovable)

~~~~text
Continue o app "Financials" (React + Vite + TS + Tailwind + shadcn/ui + TanStack Query, UI em pt-BR). Mantenha TODAS as regras de arquitetura já estabelecidas: dados só pela API via `src/lib/api/client.ts` (nunca tabelas do Supabase), mocks em `src/lib/api/mock/` para as áreas listadas em `VITE_MOCK_AREAS`, dinheiro como string. Agora implemente as áreas "Contas" (rota `/contas`) e "Categorias" (rota `/categorias`) e dois componentes reutilizáveis de seleção. Código em `src/features/accounts/` e `src/features/categories/`.

## Contrato da API (implemente o cliente tipado e o mock exatamente assim)
Erros: `{ "error": { "code", "message", "field"? } }`.

Contas:
- `GET /accounts?active=true|false` → `Account[]` (sem o filtro, retorna todas)
- `POST /accounts` body `{ bank, nickname, holderNames: string[] }` → `Account`
- `PATCH /accounts/:id` body parcial `{ bank?, nickname?, holderNames? }` → `Account`
- `POST /accounts/:id/deactivate` e `POST /accounts/:id/activate` → `Account`
- NÃO existe exclusão de conta (nenhum DELETE).
`Account = { id: uuid, bank: "Nubank"|"SofisaDireto"|"Neon"|"XP"|"Other", nickname: string, holderNames: string[], active: boolean, createdAt: string }`.
Rótulos de banco na UI: Nubank, Sofisa Direto, Neon, XP, Outro.
Códigos de erro: `duplicate_name` (409), `holder_required` (422), validação (422 com `field`), 404.

Categorias:
- `GET /categories` → `Category[]`
- `POST /categories` body `{ name }` → `Category`
- `PATCH /categories/:id` body `{ name }` → `Category`
- `DELETE /categories/:id?reassignTo=<uuid>` → 204
`Category = { id: uuid, key: string|null, name: string, isSystem: boolean }`.
Códigos de erro: `duplicate_name` (409), `category_protected` (403), `reassign_required` (422).

## Mocks
Seed de categorias (nomes exibidos em português; as 3 com `isSystem: true` são Sem categoria, Estorno (de compras) e Investimentos): Entretenimento, Alimentação, Salários, Saúde, Utilidades, Desconhecida, Transporte, Ajuda (a terceiros), PJ, Contas, Emergência, Sem categoria*, Desejos, Estorno (de compras)*, Compras, Pets, Investimentos* (* = sistema). Keys: Entertainment, Food, Salaries, Healthcare, Utilities, Unknown, Transport, Help, PJ, Bills, Emergency, Uncategorized, Wishes, Reversal, Shopping, Pets, Investments. Seed de contas: "Nubank pessoal" (titular "Gabriel Vasconcelos Auzier") e "Nubank PJ" (titular "Gabriel Vasconcelos Auzier LTDA"), ambas ativas. O mock deve reproduzir as regras de erro do contrato (duplicidade sem diferenciar maiúsculas, titular obrigatório, categoria de sistema protegida, exclusão em uso exigindo destino).

## Hooks
`useAccounts({ active? })`, `useCategories()` e mutations (criar, editar, ativar/desativar, renomear, excluir) com invalidação do cache do TanStack Query.

## Tela de Contas (`/contas`)
- Lista com apelido, banco (rótulo), titulares (chips) e situação (badge "Ativa"/"Inativa"; inativas com aparência esmaecida).
- Botão "Nova conta" abre formulário (dialog): Banco (select), Apelido, Titulares (campo de chips: adicionar com Enter, remover; pelo menos 1; sem duplicados na mesma conta; espaços nas pontas removidos).
- Mensagens: apelido vazio/só espaços "Informe o apelido"; sem titular "Informe ao menos um titular"; apelido repetido "Já existe uma conta com esse apelido"; titular repetido "Titular já informado".
- Editar conta (mesmo formulário). Ações "Desativar" e "Reativar" (com confirmação curta). NÃO exiba nenhum botão de excluir conta. Texto de ajuda: "Contas desativadas continuam no extrato e nos cálculos, mas não podem receber novas transações."
- Estado vazio: "Nenhuma conta cadastrada. Cadastre uma conta para começar a importar extratos."

## Seletor de conta
`<AccountSelect value onChange includeInactive? />` em `src/features/accounts/AccountSelect.tsx`: por padrão lista SOMENTE contas ativas; emite o id selecionado. Será usado nos formulários e nos filtros das próximas telas.

## Tela de Categorias (`/categorias`)
- Lista com o nome em português. Linhas de sistema (Sem categoria, Estorno (de compras), Investimentos) mostram cadeado e tooltip "Categoria de sistema: não pode ser alterada" e NÃO têm botões de renomear nem excluir.
- "Nova categoria": campo de nome. Vazio/só espaços "Informe o nome"; duplicado (qualquer caixa) "Já existe uma categoria com esse nome".
- Renomear inline para categorias comuns. Se a API devolver `category_protected`, mostrar "Categoria protegida".
- Excluir: se a categoria não está em uso, confirma e exclui; se a API responder `reassign_required`, abre diálogo "Esta categoria está em uso. Escolha para qual categoria mover as transações" com seletor de destino (exclui a própria categoria da lista) e só então reenvia com `reassignTo`. Em falha, a categoria permanece e é mostrado o erro.

## Seletor de categoria
`<CategorySelect value onChange />` em `src/features/categories/CategorySelect.tsx`: lista todas as categorias (inclusive as de sistema) pelo nome em português; emite o id.

## Testes
Vitest + Testing Library: formulário de conta (titular obrigatório, apelido duplicado), ausência de botão de excluir conta, desativar/reativar atualizam a linha, `AccountSelect` sem contas inativas, categorias de sistema sem controles de edição, renomear, fluxo de exclusão com destino, nomes em português, `CategorySelect`.

## Fora do escopo
Exclusão de conta, saldo inicial, ícones/cores de categoria, subcategorias.
~~~~

## Checklist de aceite

Verificado em 2026-10-04 sobre `.lovable/codebases/v2-accounts-categories.zip` aplicado em `web/` (leitura do código das duas features e dos mocks + `yarn test`, `npx tsc --noEmit` e `eslint`).

- [x] Não existe nenhuma ação de excluir conta (ACCT-02). *(`AccountsPage.tsx` só tem Editar e Desativar/Reativar; `api.ts` não tem chamada DELETE de conta; teste "não oferece exclusão…" cobre.)*
- [x] `AccountSelect` oculta contas inativas (ACCT-03). *(Padrão `useAccounts({ active: true })`; `includeInactive` opcional marca "(inativa)"; teste cobre.)*
- [x] As 3 categorias de sistema não têm renomear/excluir (CAT-02). *(Linhas `isSystem` mostram cadeado e tooltip "Categoria de sistema: não pode ser alterada" e nenhum botão de ação; teste cobre.)*
- [x] Exclusão em uso exige destino e só então chama a API com `reassignTo` (CAT-04). *(Primeira chamada sem destino; em `reassign_required` abre o diálogo com `CategorySelect` sem a própria categoria e reenvia com `reassignTo`; teste cobre.)*
- [x] Todos os nomes de categoria aparecem em português (CAT-01). *(As 17 do seed do mock conferem com a spec, inclusive "Ajuda (a terceiros)" e "Estorno (de compras)".)*
- [x] Mocks reproduzem os códigos de erro do contrato. *(Contas: `duplicate_name` 409, `holder_required` 422, `validation` 422, 404. Categorias: `duplicate_name` 409, `category_protected` 403 em PATCH e DELETE, `reassign_required` 422, destino igual 422. Lacunas na tabela de achados.)*
- [x] Mensagens do prompt presentes: "Informe o apelido", "Informe ao menos um titular", "Já existe uma conta com esse apelido", "Titular já informado", "Informe o nome", "Já existe uma categoria com esse nome", "Categoria protegida", textos de ajuda e estado vazio.
- [x] `test` passa. *(9 arquivos, 26 testes: 7 novos nesta versão.)*
- [ ] `typecheck` passa. *(`npx tsc --noEmit`: 0 erros. O script `yarn typecheck` continua falhando: usa `tsgo`, pacote ausente. Pendência do prompt 1.)*
- [ ] `lint` passa. *(788 erros, todos Prettier. Causa: os arquivos `.prettierrc` e `.prettierignore` do zip não estão em `web/`. Com os dois aplicados: 0 erros e 7 avisos de `react-refresh/only-export-components`. Correção: rodar `.lovable/sync-codebase.sh v2-accounts-categories`, que copia esses arquivos.)*

### Achados

| # | Achado | Severidade | Ação |
| - | ------ | ---------- | ---- |
| 1 | `.prettierrc`, `.prettierignore`, `.lovable/` e o `.gitignore` atualizado do zip não chegaram a `web/` (cópia manual não levou arquivos ocultos). É a causa dos 788 erros de lint | Média | Usar `.lovable/sync-codebase.sh` para aplicar zips; já corrige o lint |
| 2 | `@testing-library/dom` continua fora do `package.json` do zip. Os testes só passam porque `node_modules` local o tem; um `yarn install` limpo volta a quebrar os 9 arquivos de teste | Alta | Pedir ao Lovable para declarar a dependência (`devDependencies`) ou rodar `yarn add -D @testing-library/dom` e manter o ajuste ao aplicar zips (o script faz backup do `package.json` sobrescrito) |
| 3 | `yarn typecheck` falha (script `tsgo`); `tsc` direto passa | Média | Pendente desde o prompt 1; trocar o script por `tsc --noEmit` |
| 4 | `AccountsPage`: `changeStatus` não trata erro de ativar/desativar (`mutateAsync` sem `catch`); se a API falhar o diálogo fica aberto sem mensagem | Baixa | Pedir tratamento de erro na próxima rodada ou ajustar depois |
| 5 | Mock de contas não valida titular duplicado na mesma conta nem banco inválido (a regra só existe no formulário). Contrato diz 422 em ambos | Baixa | Ajustar o mock ou aceitar até a API real (a API é a fonte da regra) |
| 6 | Mock de categorias simula "em uso" só para 4 categorias fixas (Entretenimento, Alimentação, Contas, Compras) e a reatribuição não move nada | Baixa | Esperado; conectar às transações mockadas no prompt de `transactions` |
| 7 | Comparação de nomes (conta e categoria) é sem diferenciar caixa, mas não sem acentos | Informativo | Alinhado à spec; confirmar o comportamento da API real |
| 8 | Mock não tem rota DELETE de conta: chamada cairia no erro genérico "Mock ainda não implementado" em vez de 404 | Informativo | Sem impacto: não há UI para isso |
