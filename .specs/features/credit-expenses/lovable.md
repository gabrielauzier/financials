# Despesas de Cartão — Prompt Lovable

**Specs**: `.specs/features/credit-expenses/spec.md` · **Design**: `.specs/features/credit-expenses/design.md`
**Substitui as tasks de interface**: T8–T12 de `tasks.md` (hooks, tabela, formulário, seletor de status, página).
**Pré-requisito**: prompts `auth` e `accounts-categories` aplicados.

## Prompt (colar no Lovable)

~~~~text
Continue o app "Financials" (React + Vite + TS + Tailwind + shadcn/ui + TanStack Query, UI em pt-BR). Mantenha as regras de arquitetura: dados só pela API via `src/lib/api/client.ts`, mocks em `src/lib/api/mock/` para as áreas listadas em `VITE_MOCK_AREAS`, dinheiro SEMPRE string decimal. Implemente a tela "Cartão de crédito" na rota `/cartao`, em `src/features/creditExpenses/`. Esta tela é o controle MANUAL e INDEPENDENTE de parcelas e recorrências do cartão: não tem relação com as transações do extrato.

## Contrato da API
Erros: `{ "error": { "code", "message", "field"? } }`.
`CreditExpense = { id: uuid, accountId: uuid, categoryId: uuid, categoryName: string, name: string, totalAmount: string, paidAmount: string, remainingAmount: string, occurredAt: string (ISO), recurrencyDay: number (1-31), status: "Once"|"Active"|"Inactive"|"Canceled"|"ToCancel", notes: string|null }`
- `GET /credit-expenses?status=` → `CreditExpense[]` (`remainingAmount` = total − pago, calculado pelo servidor)
- `POST /credit-expenses` body `{ name, totalAmount, paidAmount?, occurredAt, recurrencyDay, status, accountId, categoryId?, notes? }` → `CreditExpense` (`paidAmount` padrão "0.00"; categoria padrão "Sem categoria")
- `PATCH /credit-expenses/:id` body parcial → `CreditExpense`
- `DELETE /credit-expenses/:id` → 204
Códigos de erro (422 com `field`): `invalid_amount`, `invalid_paid_amount`, `invalid_day`, `invalid_status`; 404.

## Mocks
~8 despesas (assinaturas e parcelas) cobrindo os 5 status, em duas categorias; o mock calcula `remainingAmount` e aplica as validações do contrato (inclusive rejeitar reduzir o total abaixo do valor pago).

## Tela
- Tabela: Nome, Categoria, Valor total, Valor pago, Restante (`formatBRL`), Dia da fatura, Status (badge), Observações. Filtro por status (Todos + os 5). Estado vazio: "Nenhuma despesa de cartão cadastrada."
- Rótulos de status em pt-BR: Once = "Única (inativa na próxima fatura)", Active = "Ativa (recorre até quitar)", Inactive = "Inativa", Canceled = "Cancelada", ToCancel = "A cancelar".
- Seletor de status em cada linha: oferece SEMPRE os 5 status, a partir de qualquer status atual (sem restrição de transição); salva ao escolher, com rollback e mensagem em caso de erro. O sistema nunca altera status nem valor pago sozinho (tudo é manual). Texto de ajuda: "Status e valor pago são atualizados manualmente."
- Formulário (dialog) criar/editar: Nome*, Valor total*, Valor já pago, Data*, Dia da fatura* (1–31), Status*, Conta* (`AccountSelect`, ativas), Categoria (`CategorySelect`), Observações. Mensagens: total ≤ 0 → "Valor total inválido"; pago negativo ou maior que o total → "Valor pago inválido"; dia fora de 1–31 → "Dia inválido (use de 1 a 31)"; obrigatório vazio → "Informe <campo>". Valores em formato brasileiro ("1.234,56") viram string decimal sem float.
- Excluir com confirmação.
- Aviso fixo na página: "Estes valores não entram no dashboard de receitas, despesas nem patrimônio."

## Testes
Vitest + Testing Library: restante exibido por linha, filtro por status, seletor com os 5 status de qualquer origem, validações do formulário (total, pago, dia), edição que reduz o total abaixo do pago exibe o erro da API, excluir com confirmação, fluxo criar/editar/status/excluir com API mockada.

## Fora do escopo
Vínculo com transações, transição automática de status, importação, avisos de vencimento.
~~~~

## Checklist de aceite

- [ ] Os 5 status ficam disponíveis a partir de qualquer status (CARD-04).
- [ ] Restante exibido = total − pago vindo da API (CARD-02).
- [ ] Validações de total, pago e dia com as mensagens do prompt (CARD-01).
- [ ] Nada altera status ou valor pago automaticamente.
- [ ] Aviso de que não entra nos totais está visível (CARD-05).
