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

- [ ] Não existe nenhuma ação de excluir conta (ACCT-02).
- [ ] `AccountSelect` oculta contas inativas (ACCT-03).
- [ ] As 3 categorias de sistema não têm renomear/excluir (CAT-02).
- [ ] Exclusão em uso exige destino e só então chama a API com `reassignTo` (CAT-04).
- [ ] Todos os nomes de categoria aparecem em português (CAT-01).
- [ ] Mocks reproduzem os códigos de erro do contrato.
