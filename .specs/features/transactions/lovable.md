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

- [ ] Ordenação refaz a consulta ordenando o conjunto inteiro (TXN-01).
- [ ] Filtros combinam com E e voltam à página 1 (TXN-02).
- [ ] Categoria inline salva sem formulário e faz rollback em erro (TXN-06).
- [ ] Lote usa uma única chamada e é tudo-ou-nada (TXN-07).
- [ ] Neutras com marca visual e switch persistido (TXN-08).
- [ ] Valor nunca passa por `parseFloat`; "1.234,56" vira "1234.56".
