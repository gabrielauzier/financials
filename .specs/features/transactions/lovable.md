# Transações — Prompt Lovable

**Specs**: `.specs/features/transactions/spec.md` · **Design**: `.specs/features/transactions/design.md`
**Substitui as tasks de interface**: T13–T21 de `tasks.md` (formatação, hook, tabela, filtros, formulário, edição inline, lote, neutra, página).
**Pré-requisito**: prompts de `auth` e `accounts-categories` aplicados (usa `AccountSelect`, `CategorySelect`, `formatBRL`, `formatDateLocal`).

## Prompt (colar no Lovable)

~~~~text
Continue o app "Financials" (React + Vite + TS + Tailwind + shadcn/ui + TanStack Query, UI em pt-BR). Mantenha as regras de arquitetura: dados só pela API via `src/lib/api/client.ts` (nunca tabelas do Supabase), mocks em `src/lib/api/mock/` para as áreas listadas em `VITE_MOCK_AREAS`, dinheiro SEMPRE string decimal. Implemente a tela de Extrato (rota `/extrato`) em `src/features/transactions/`, reutilizando `AccountSelect`, `CategorySelect`, `formatBRL` e `formatDateLocal` já existentes.

## Contrato da API
Erros: `{ "error": { "code", "message", "field"? } }`.
`Transaction = { id: uuid, accountId: uuid, accountNickname: string, categoryId: uuid, categoryName: string, name: string, type: "Income"|"Expense", occurredAt: string (ISO UTC), amount: string ("1234.56", sempre positivo), paymentMethod: "BankTransfer"|"Boleto"|"Cash"|"CreditCard"|"DebitCard"|"NuPay"|"PIX", notes: string|null, receipt: string|null, neutral: boolean, counterpartyDocument: string|null, counterpartyBank: string|null }`
- `GET /transactions?from&to&accountId&categoryId&type&neutral&q&sort&order&page` → `{ items: Transaction[], total: number, page: number, pageSize: 50 }`. `from` e `to` são datas locais `YYYY-MM-DD`; `sort` ∈ `date|name|amount|category`; `order` ∈ `asc|desc`; padrão: data decrescente.
- `POST /transactions` body `{ name, type, occurredAt, amount, accountId, categoryId?, paymentMethod, notes?, receipt? }` → `Transaction` (sem categoria informada o servidor usa "Sem categoria")
- `PATCH /transactions/:id` body parcial (inclui `neutral`) → `Transaction`
- `DELETE /transactions/:id` → 204
- `PATCH /transactions/category` body `{ ids: uuid[], categoryId }` → 204 (atômico: tudo ou nada)
Códigos de erro: `invalid_amount`, `invalid_account`, `invalid_receipt_url` (422, com `field`), 404.
A API usa `X-Timezone` (o cliente já envia).

## Mocks
Gere ~120 transações realistas distribuídas em 2 contas e 6 meses, com receitas, despesas, algumas neutras, uma `CreditCard` e categorias variadas; o mock implementa filtros (todos combinados com E), busca ignorando maiúsculas e acentos, ordenação sobre o conjunto inteiro (desempate por id), paginação de 50, e as validações do contrato.

## Tabela de extrato
- Colunas: Data, Nome, Conta, Categoria, Método de pagamento, Tipo, Valor, Neutra, Observações. Data via `formatDateLocal`; valor via `formatBRL` (despesas em vermelho com sinal "-", receitas em verde). Rótulos: tipo "Receita"/"Despesa"; método Transferência bancária, Boleto, Dinheiro, Cartão de crédito, Cartão de débito, NuPay, PIX.
- Ordenação clicando no cabeçalho de Data, Nome, Valor e Categoria (alterna asc/desc; ordena o conjunto inteiro via API, não só a página).
- Paginação de 50 por página com total.
- Linhas neutras com indicação visual (badge "Neutra" e aparência esmaecida).
- Estado vazio: "Nenhuma transação encontrada".
- Responsivo: no mobile cada linha vira cartão.

## Filtros e busca
Barra com período (de/até), conta (`AccountSelect` incluindo inativas), categoria, tipo (Todos/Receita/Despesa), neutra (Todas/Sim/Não) e campo de busca por nome (debounce de 300 ms). Mudar qualquer filtro volta para a página 1. Botão "Limpar filtros".

## Formulário de transação (criar/editar, em dialog)
Campos: Nome*, Tipo*, Data*, Valor*, Conta* (somente ativas), Método de pagamento*, Categoria (padrão "Sem categoria"), Observações, Recibo (URL), Neutra (switch).
Validações no cliente (e exiba também o erro da API): campo obrigatório vazio → "Informe <campo>"; valor ≤ 0 ou com mais de 2 casas decimais → "Valor inválido"; recibo que não comece com http:// ou https:// → "URL inválida". Valor digitado em formato brasileiro ("1.234,56") deve ser convertido para string decimal "1234.56" sem usar float.
Exclusão pede confirmação ("Excluir esta transação? Essa ação não pode ser desfeita."); cancelar mantém a linha.

## Edição rápida de categoria
Cada linha tem um seletor de categoria que salva IMEDIATAMENTE ao escolher, sem abrir formulário, com atualização otimista. Se a API falhar, restaura a categoria anterior e mostra "Não foi possível salvar a categoria".

## Seleção em lote
Checkbox por linha (e "selecionar todas da página"). Com linhas selecionadas aparece uma barra "Aplicar categoria" com `CategorySelect` que chama `PATCH /transactions/category` em UMA chamada. Se falhar, nenhuma linha muda e é mostrado o erro.

## Neutra
Switch na linha e no formulário que persiste `neutral`; em falha, reverte o switch. Texto de ajuda: "Transferências neutras não contam em receitas, despesas nem patrimônio."

## Testes
Vitest + Testing Library: colunas e formatação, ordenação por cabeçalho, estado vazio, indicação de neutra, filtros emitindo os parâmetros corretos, busca com debounce, validações do formulário (obrigatório, valor, URL, conta inativa não oferecida), edição inline com sucesso e com rollback, lote com sucesso e falha, switch de neutra, fluxo de criar/editar/excluir com confirmação.

## Fora do escopo
Importação de CSV (próximo prompt), recibo com upload, transações recorrentes/parceladas, exportação.
~~~~

## Checklist de aceite

Verificação inicial em 2026-10-04 sobre `v3-transactions.zip`; **reverificação após as correções em `v3.1-transactions.zip`** (script de sincronização confirma `web/` idêntico ao zip; leitura dos mocks, de `utils.ts`, do formulário e dos testes; `yarn test`, `yarn typecheck`, `eslint` e uma instalação limpa em cópia de `web/`).

- [x] Ordenação refaz a consulta ordenando o conjunto inteiro (TXN-01). *(Cabeçalhos Data, Nome, Categoria e Valor alteram `sort`/`order` e refazem a consulta; o mock ordena tudo antes de paginar, com desempate por id. O teste só confere que o clique não quebra, não a ordem.)*
- [x] Filtros combinam com E e voltam à página 1 (TXN-02). *(`changeFilter`, a busca com debounce de 300 ms e "Limpar filtros" reiniciam `page: 1`; o mock combina todos os filtros e agora compara a data **local**. Sem teste de UI.)*
- [x] Categoria inline salva sem formulário e faz rollback em erro (TXN-06). *(Seletor por linha, atualização otimista e restauração em `onError`. Sem teste de UI.)*
- [x] Lote usa uma única chamada e é tudo-ou-nada (TXN-07). *(Uma chamada com todos os ids; o mock valida antes de aplicar, agora também contra as categorias reais. Teste cobre o mock, não a barra de lote.)*
- [x] Neutras com marca visual e switch persistido (TXN-08). *(Badge, linha esmaecida e switch otimista com rollback. Sem teste do switch.)*
- [x] Valor nunca passa por `parseFloat`; "1.234,56" vira "1234.56". *(`parseBRLToDecimal` só usa regex e string.)*
- [x] Mocks de transações, contas e categorias consistentes entre si. *(Novo: `listMockAccounts`/`listMockCategories`, `transactionRelations.ts`; categoria renomeada ou criada aparece nas transações, categoria inexistente dá 404, conta inativa só bloqueia na criação, exclusão com `reassignTo` move as transações e `reassign_required` vem de transações reais. Cobertos por 2 testes.)*
- [x] Datas no fuso local. *(`toLocalDateInput` usado no formulário de edição; filtros `from`/`to` do mock comparam a data local; teste confirma `2026-10-05T01:00:00Z` → 04/10/2026 em São Paulo.)*
- [x] `test` passa. *(10 arquivos, 35 testes; 3 novos desde o v3.)*
- [x] `typecheck` passa. *(Script agora é `tsc --noEmit`; 0 erros.)*
- [x] `lint` passa. *(0 erros, 7 avisos `react-refresh/only-export-components`.)*
- [x] Instalação limpa funciona. *(`@testing-library/dom` declarado em `devDependencies`; em cópia sem `node_modules`, `yarn install` seguido de `yarn test` e `yarn typecheck` passam.)*
- [ ] Testes de UI pedidos no prompt e na mensagem de correção (categoria inline com rollback, lote, neutra, debounce, filtros, ordenação, vazio, paginação, exclusão, criar/editar). *(**Não entregues**: os únicos 3 testes novos são de data local e de mocks. O plano do Lovable (`web/.lovable/plan/correções-de-integração-e-testes-do-extrato-…md`) afirma que foram completados, mas o arquivo de testes não os contém.)*

### Achados (após as correções)

| # | Achado | Situação | Severidade |
| - | ------ | -------- | ---------- |
| 1 | Mock de transações com listas fixas de contas e categorias | **Resolvido** (ver item "mocks consistentes") | — |
| 2 | Testes de UI insuficientes (categoria inline, lote, switch de neutra, debounce, filtros, ordenação, vazio, paginação, exclusão, criar/editar) | **Em aberto**: nada disso foi adicionado e o plano do Lovable declara o contrário | Média |
| 3 | Datas: formulário e filtros do mock usavam UTC | **Resolvido** (`toLocalDateInput`, filtros locais, teste). Resíduo: o teste altera `process.env.TZ` e restaura com `undefined`, o que grava a string "undefined" e pode afetar testes seguintes; os filtros por data local não têm teste próprio | Baixa |
| 4 | Receitas com `text-primary` em vez de verde | Em aberto (conferir visualmente o tema) | Baixa |
| 5 | `parseBRLToDecimal` aceita "10.000" como 10000 e rejeita "1234.56" | Informativo, mantido | Informativo |
| 6 | Erro do lote exibe a mensagem da API | Informativo, mantido | Informativo |
| 7 | `@testing-library/dom` fora do `package.json` | **Resolvido** (`^10.4.1`) | — |
| 8 | `yarn typecheck` com `tsgo` | **Resolvido** (`tsc --noEmit`) | — |
| 9 | `.env` copiado do zip e versionado (só chave publicável e id do projeto) | Em aberto: decidir política ou ignorar no git | Baixa |
| 10 | `sync-codebase.sh` silencioso sem diferenças | **Resolvido** | — |
| 11 | **Novo**: `yarn.lock` fora de sincronia com o `package.json` (lista `@testing-library/dom@^10.4.2`, o `package.json` pede `^10.4.1`); `yarn install --frozen-lockfile` falha, `yarn install` passa. O Lovable mantém só o `bun.lock`, e o script protege o `yarn.lock` local | Em aberto | Baixa |
| 12 | **Novo (processo)**: o plano do Lovable descreve entregas que o código não contém (testes de UI). O resumo do Lovable não substitui a verificação | Registrado | Informativo |

## Mensagem de correção (enviar ao Lovable antes do prompt de `import`)

**Situação**: enviada e aplicada em `v3.1-transactions.zip`; **parcialmente atendida**: itens 1 (mocks), 2 (datas) e 4 (configuração) entregues e verificados; item 3 (testes de UI) não entregue. Cobria os achados 1, 2, 3, 7 e 8 da versão anterior da tabela. Depois de aplicada, gerar novo zip (`v3b-transactions-fix.zip`), sincronizar com `.lovable/sync-codebase.sh` e repetir a verificação dos itens afetados.

~~~~text
Faça apenas as correções abaixo no que já existe, sem mudar o comportamento das demais telas.

1) Mock de transações conectado aos mocks de contas e categorias
- Hoje `src/lib/api/mock/transactions.ts` tem listas fixas de contas e categorias. Faça-o ler as listas dos mocks `accounts` e `categories` (exporte funções de leitura desses módulos, por exemplo `listMockAccounts()` e `listMockCategories()`), sem copiar dados.
- Nomes de conta e de categoria devem sempre vir desses mocks: categoria renomeada aparece com o nome novo; conta ou categoria criada nas telas de Contas e Categorias deve poder ser usada em transações.
- Remova o fallback silencioso para "Sem categoria". Categoria inexistente em POST/PATCH → erro 404 `not_found`; no lote (`PATCH /transactions/category`) continua tudo-ou-nada (404 sem alterar nada). Só quando `categoryId` não é informado na criação, use a categoria de sistema "Sem categoria" (chave `Uncategorized`).
- Na criação, a conta precisa existir e estar ativa: caso contrário 422 `invalid_account`. Em edição, conta inativa continua permitida.
- Exclusão de categoria com `reassignTo`: o mock de categorias deve mover as transações mockadas para o destino e responder `reassign_required` (422) sempre que ainda houver transações na categoria sem destino, no lugar do conjunto fixo `categoriesInUse`.

2) Datas no fuso local
- Crie `toLocalDateInput(iso: string): string` (AAAA-MM-DD usando o fuso do navegador) em `src/features/transactions/utils.ts` e use no formulário de edição no lugar de `occurredAt.slice(0, 10)`.
- No mock de transações, os filtros `from` e `to` devem comparar a data LOCAL (do navegador) de `occurredAt`, não a data UTC.
- Teste: uma transação em `2026-10-05T01:00:00Z` com fuso `America/Sao_Paulo` aparece como 04/10/2026 na tabela, no formulário de edição e é encontrada pelo filtro de 04/10 a 04/10.

3) Testes de UI que faltam (Vitest + Testing Library, API mockada)
- Categoria inline: escolher uma categoria salva sem abrir formulário e atualiza a linha; com falha forçada, a categoria anterior é restaurada e aparece "Não foi possível salvar a categoria".
- Lote: marcar 2 linhas, escolher categoria e "Aplicar categoria" faz UMA chamada com os 2 ids; com falha, nenhuma linha muda e a seleção é mantida.
- Switch de neutra: persiste o novo valor; com falha, volta ao anterior.
- Busca: o debounce de 300 ms (use timers falsos) dispara uma única consulta e volta à página 1.
- Filtros: cada filtro emite o parâmetro correto e reinicia a página; "Limpar filtros" restaura o padrão.
- Ordenação: clicar em Valor e depois de novo inverte a ordem e a primeira linha muda conforme o esperado.
- Estado vazio ("Nenhuma transação encontrada") e paginação (Próxima/Anterior, "Página X de Y").
- Exclusão: confirmar remove a linha; cancelar mantém.
- Fluxo criar e editar pelo formulário, incluindo conta inativa não listada no seletor do formulário.

4) Configuração do projeto
- Declare `@testing-library/dom` em `devDependencies` do `package.json` (hoje falta e os testes só passam pelo node_modules local) e mantenha os lockfiles consistentes.
- Troque o script `typecheck` de `tsgo --noEmit` por `tsc --noEmit`.
- Ao final, `yarn test`, `yarn typecheck` e `yarn lint` devem passar em uma instalação limpa (0 erros de lint; os avisos atuais de `react-refresh/only-export-components` são aceitáveis).
~~~~

