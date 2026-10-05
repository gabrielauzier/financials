# Despesas de Cartão (CreditExpenses) Specification

Fonte: `docs/PRD.md` §5.6 (US-13).

## Problem Statement

Parcelas e recorrências de cartão (assinaturas, compras parceladas) precisam de acompanhamento próprio do que ainda falta pagar. É um controle manual e independente de `Transaction`: não gera nem é gerado por transações.

## Goals

- [ ] CRUD completo de despesas de cartão com valor restante calculado.
- [ ] Filtro por status funcionando sobre todos os 5 status.
- [ ] Nenhuma `CreditExpense` altera os totais do dashboard.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Vínculo com Transactions | Decisão do PRD: controle independente |
| Transição automática de status e de `paid_amount` | Manual no piloto (decisão do PRD) |
| Importação de CreditExpenses por CSV | Não pedido |
| Avisos / notificações de vencimento | Não pedido |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Transições de status | Qualquer status pode ir para qualquer outro, manualmente | PRD: transição manual no piloto | n |
| `paid_amount` | Editado manualmente; deve estar entre 0 e `total_amount` | PRD: manual no piloto | n |
| `recurrency_day` | Inteiro de 1 a 31 | PRD não define faixa; dia do mês | n |
| Campo `date` | Data em que a despesa foi realizada, meia-noite no fuso local | Consistente com Transactions | n |
| Categoria padrão | *Sem categoria* | Consistente com Transactions | n |
| Valor restante | `total_amount − paid_amount` | PRD US-14 | n |
| Conta/banco | Obrigatória, escolhida entre contas ativas do usuário | PRD US-13 lista "conta/banco" | n |
| Exclusão | Permitida com confirmação | CRUD completo no PRD | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: CRUD de despesas de cartão ⭐ MVP

**User Story**: Como usuário, quero registrar despesas de cartão parceladas ou recorrentes para acompanhar o que ainda vou pagar.

**Why P1**: Requisito do PRD (US-13).

**Acceptance Criteria**:

1. WHEN o usuário envia nome, valor total maior que zero, data, dia de recorrência, status e conta válidos THEN o sistema SHALL criar a despesa com `paid_amount` igual a 0 se não informado.
2. IF o valor total é menor ou igual a zero THEN o sistema SHALL rejeitar com mensagem de valor inválido.
3. IF `paid_amount` é negativo ou maior que `total_amount` THEN o sistema SHALL rejeitar com mensagem de valor pago inválido.
4. IF `recurrency_day` não é inteiro entre 1 e 31 THEN o sistema SHALL rejeitar com mensagem de dia inválido.
5. WHEN o usuário edita qualquer campo THEN o sistema SHALL persistir a alteração sem modificar os demais campos.
6. WHEN o usuário confirma a exclusão THEN o sistema SHALL remover a despesa definitivamente.
7. The sistema SHALL identificar cada despesa por `uuid` e aplicar `user_id` e RLS.
8. The sistema SHALL calcular o valor restante como `total_amount − paid_amount` em cada leitura.

**Independent Test**: Criar uma despesa de R$ 600,00 com R$ 200,00 pagos e ver R$ 400,00 restantes.

---

### P1: Status e filtro ⭐ MVP

**User Story**: Como usuário, quero controlar o status de cada despesa para saber o que está ativo, cancelado ou a cancelar.

**Why P1**: Status define o acompanhamento no cartão.

**Acceptance Criteria**:

1. The sistema SHALL aceitar apenas os status Once, Active, Inactive, Canceled e ToCancel.
2. WHEN o usuário altera o status de uma despesa THEN o sistema SHALL persistir o novo status sem alterar `paid_amount` nem outros campos.
3. WHEN o usuário filtra por status THEN o sistema SHALL listar somente despesas com esse status.
4. The sistema SHALL não alterar status nem `paid_amount` automaticamente.
5. IF o usuário envia um status fora da lista THEN o sistema SHALL rejeitar com erro de validação.

**Independent Test**: Alterar uma despesa de Active para ToCancel e filtrar por ToCancel.

---

### P2: Isolamento dos totais

**User Story**: Como usuário, quero que despesas de cartão cadastradas não distorçam meus totais de dashboard.

**Why P2**: Evita dupla contagem com Transactions.

**Acceptance Criteria**:

1. The sistema SHALL não incluir CreditExpenses em receitas, despesas, tendência, distribuição por categoria geral nem patrimônio.
2. The sistema SHALL expor CreditExpenses somente na visão de cartão (spec `dashboards`).

**Independent Test**: Criar uma CreditExpense e ver os totais de dashboard inalterados.

---

## Edge Cases

- IF o usuário reduz `total_amount` para menos que `paid_amount` THEN o sistema SHALL rejeitar a edição.
- IF a categoria é excluída com reatribuição THEN o sistema SHALL exibir a categoria destino na despesa.
- WHEN a conta da despesa é desativada THEN o sistema SHALL manter a despesa visível e editável.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| CARD-01 | P1: CRUD (criar, validar) | - | Implementing |
| CARD-02 | P1: CRUD (editar, excluir, valor restante) | - | Implementing |
| CARD-03 | P1: Status (valores e filtro) | - | Implementing |
| CARD-04 | P1: Status (sem automação) | - | Implementing |
| CARD-05 | P2: Isolamento dos totais | - | Pending |

**Coverage:** 5 total, 0 mapped to tasks, 5 unmapped ⚠️

---

## Success Criteria

- [ ] Valor restante sempre igual a total − pago.
- [ ] Totais de dashboard idênticos antes e depois de criar uma CreditExpense.
