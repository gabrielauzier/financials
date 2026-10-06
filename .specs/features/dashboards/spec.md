# Dashboards e Patrimônio Specification

Fonte: `docs/PRD.md` §5.6 (US-14), §5.7 (US-15 a US-18), §5.7.1 (US-19), §5.9.

## Problem Statement

O usuário quer enxergar para onde o dinheiro vai e quanto acumulou: despesas dos últimos 30 dias, tendência de 12 meses, gastos por categoria, gastos de cartão e patrimônio. Os números só são confiáveis se neutras, estornos, investimentos e compras de cartão seguirem uma regra única de cálculo, implementada em um só ponto da API.

## Goals

- [ ] Todos os painéis usam o mesmo módulo de regras de cálculo.
- [ ] Neutras, compras de cartão e investimentos nunca alteram receitas ou despesas.
- [ ] Patrimônio inclui rendimentos de investimentos lançados manualmente.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Saldo inicial por conta | Fora do MVP |
| Cotação / rendimento automático de investimentos | Lançamento manual no MVP |
| Orçamentos e metas | Fora do MVP |
| Exportação de relatórios | Fora do MVP |
| Comparação entre usuários | Produto pessoal |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| "Últimos 30 dias" | Janela de 30 dias corridos terminando hoje (inclusive), no fuso local; comparação com os 30 dias imediatamente anteriores | PRD diz janela móvel até hoje | n |
| "Últimos 12 meses" | 12 meses-calendário terminando no mês corrente (inclusive) | PRD não define | n |
| Gastos por categoria (US-17), padrão | Mês corrente; período selecionável | PRD §5.7 | n |
| Rendimentos de investimentos (PRD Q11) | Lançamentos de variação (ganho ou perda, data, valor) | Modelo mais simples; alternativa "saldo informado" fica fora | n |
| Compras de cartão na distribuição por categoria geral (PRD Q14) | Excluídas; o gasto por categoria do cartão aparece só na visão de cartão | Preserva a regra de totais do PRD | n |
| Compras de cartão na tendência (PRD Q15) | O gasto entra no mês do pagamento da fatura, não da compra | Consequência da regra de totais do PRD | n |
| Estorno (Reversal) | Só abate despesa quando o tipo é Income; com tipo Expense é despesa normal | PRD define abatimento sem tratar o tipo Expense | n |
| Estorno na distribuição por categoria | Aparece como valor negativo na categoria *Estorno* | Mantém a soma igual ao total de despesas | n |
| Patrimônio: série temporal | Um ponto por mês, acumulado até o fim do mês | PRD pede série sem granularidade | n |
| Primeira transação | Série do patrimônio começa no mês da primeira transação ou rendimento | PRD: "desde o início" | n |
| Lançamento de rendimento: conta | Obrigatória, entre contas do usuário | PRD US-19 lista conta/instituição | n |
| Valor de rendimento | Diferente de zero, positivo ou negativo, 2 casas | PRD: positivo ou negativo | n |
| Transações em data futura | Contadas somente quando a data é ≤ hoje | Painéis refletem o realizado | n |
| Visão de cartão: grupos de soma zero, estornos e despesas parceladas | Categoria cujas compras e estornos de cartão somam 0,00 é omitida; estorno (Income em CreditCard) reduz a sua categoria; despesas de crédito em aberto ignoram o período | Mantém a lista só com valores a mostrar, como o painel de categorias; o saldo restante não depende do período | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Regras de cálculo ⭐ MVP

**User Story**: Como usuário, quero que todos os totais sigam a mesma regra para confiar nos números.

**Why P1**: Base de todos os painéis.

**Acceptance Criteria**:

1. The sistema SHALL calcular despesas como a soma de Expenses não neutras que não sejam CreditCard nem categoria Investments, menos a soma de Incomes de categoria Reversal.
2. The sistema SHALL calcular receitas como a soma de Incomes não neutras que não sejam CreditCard, categoria Investments nem Reversal.
3. The sistema SHALL ignorar transações neutras em receitas, despesas e patrimônio.
4. The sistema SHALL ignorar transações CreditCard em receitas, despesas e patrimônio.
5. The sistema SHALL ignorar transações da categoria Investments em receitas, despesas e patrimônio.
6. The sistema SHALL implementar essas regras em um único módulo usado por todos os painéis.
7. The sistema SHALL ignorar nos painéis transações com data posterior a hoje.

**Independent Test**: Conjunto fixo com uma transação de cada tipo especial produz exatamente os totais esperados.

---

### P1: Despesas dos últimos 30 dias ⭐ MVP

**User Story**: Como usuário, quero ver o total gasto nos últimos 30 dias.

**Why P1**: Indicador principal de acompanhamento.

**Acceptance Criteria**:

1. WHEN o usuário abre o dashboard THEN o sistema SHALL exibir o total de despesas dos últimos 30 dias corridos terminando hoje.
2. WHEN o dashboard é exibido THEN o sistema SHALL exibir a variação percentual em relação aos 30 dias imediatamente anteriores.
3. IF o total dos 30 dias anteriores é zero THEN o sistema SHALL exibir "sem base de comparação" em vez da variação.
4. IF não há despesas na janela THEN o sistema SHALL exibir R$ 0,00.

**Independent Test**: Despesas de R$ 100 e R$ 50 na janela e R$ 100 antes: total R$ 150,00 e variação +50%.

---

### P1: Tendência de 12 meses ⭐ MVP

**User Story**: Como usuário, quero ver receitas, despesas e balanço mês a mês.

**Why P1**: Visão de tendência pedida no PRD.

**Acceptance Criteria**:

1. WHEN o usuário abre a tendência THEN o sistema SHALL exibir 12 meses-calendário, o mês corrente e os 11 anteriores, cada um com receitas, despesas e balanço.
2. The sistema SHALL calcular o balanço de cada mês como receitas menos despesas.
3. WHEN um mês não tem transações THEN o sistema SHALL exibi-lo com receitas, despesas e balanço iguais a R$ 0,00.
4. The sistema SHALL atribuir cada transação ao mês da sua data no fuso local do usuário.

**Independent Test**: Transações em 3 meses diferentes; os outros 9 meses exibem zeros.

---

### P1: Gastos por categoria ⭐ MVP

**User Story**: Como usuário, quero ver como minhas despesas se distribuem por categoria.

**Why P1**: Responde para onde o dinheiro vai.

**Acceptance Criteria**:

1. WHEN o usuário abre a distribuição THEN o sistema SHALL exibir as despesas do mês corrente agrupadas por categoria, com nome em português.
2. WHEN o usuário seleciona um período THEN o sistema SHALL recalcular a distribuição para esse período.
3. The sistema SHALL aplicar as regras de cálculo da seção de regras a cada valor da distribuição.
4. WHEN existem estornos no período THEN o sistema SHALL exibi-los como valor negativo na categoria *Estorno*.
5. The sistema SHALL garantir que a soma das categorias seja igual ao total de despesas do mesmo período.
6. WHEN não há despesas no período THEN o sistema SHALL exibir o estado vazio.

**Independent Test**: Despesas em 3 categorias e um estorno: a soma das 4 linhas é igual ao total de despesas.

---

### P1: Patrimônio ⭐ MVP

**User Story**: Como usuário, quero ver meu patrimônio acumulado desde o início.

**Why P1**: Indicador de acumulação pedido no PRD.

**Acceptance Criteria**:

1. WHEN o usuário abre o patrimônio THEN o sistema SHALL exibir o valor atual igual a receitas menos despesas acumuladas mais a soma de todos os lançamentos de rendimento.
2. The sistema SHALL exibir a série do patrimônio com um ponto por mês acumulado até o fim do mês.
3. WHEN não há transações nem rendimentos THEN o sistema SHALL exibir R$ 0,00 e a série vazia.
4. The sistema SHALL contar estornos no patrimônio como valor positivo.
5. The sistema SHALL contar o pagamento de fatura (Expense no extrato da conta) como despesa no patrimônio.

**Independent Test**: Receita de R$ 1.000, despesa de R$ 300, rendimento de R$ 50: patrimônio R$ 750,00.

---

### P1: Lançamentos de rendimento ⭐ MVP

**User Story**: Como usuário, quero lançar o rendimento dos meus investimentos para o patrimônio refletir a valorização.

**Why P1**: Decisão do PRD: aportes não mudam o patrimônio, rendimento sim.

**Acceptance Criteria**:

1. WHEN o usuário envia data, valor diferente de zero e conta válidos THEN o sistema SHALL criar o lançamento de rendimento.
2. IF o valor é zero ou tem mais de 2 casas decimais THEN o sistema SHALL rejeitar com mensagem de valor inválido.
3. WHEN o usuário edita ou exclui um lançamento THEN o sistema SHALL persistir a alteração e recalcular o patrimônio na próxima leitura.
4. The sistema SHALL listar os lançamentos ordenados por data decrescente.
5. The sistema SHALL aplicar `user_id` e RLS e identificar cada lançamento por `uuid`.
6. WHEN o último lançamento tem mais de 30 dias THEN o sistema SHALL exibir a data do último lançamento como lembrete visual.

**Independent Test**: Lançar +R$ 50 e -R$ 20; patrimônio varia +R$ 30,00.

---

### P1: Visão de cartão ⭐ MVP

**User Story**: Como usuário, quero ver os gastos do cartão por categoria.

**Why P1**: Pedido do PRD (US-14).

**Acceptance Criteria**:

1. WHEN o usuário abre a visão de cartão THEN o sistema SHALL exibir as transações CreditCard agrupadas por categoria no período selecionado, com total.
2. WHEN a visão de cartão é exibida THEN o sistema SHALL exibir as CreditExpenses de status Active, Once e ToCancel agrupadas por categoria com o valor restante a pagar.
3. The sistema SHALL não somar valores da visão de cartão em receitas, despesas nem patrimônio.
4. WHEN o período não tem compras de cartão THEN o sistema SHALL exibir o estado vazio.

**Independent Test**: Duas compras CreditCard em *Alimentação* somam o total da categoria sem alterar o total de despesas.

---

## Edge Cases

- IF nenhuma conta ou transação existe THEN o sistema SHALL exibir todos os painéis com R$ 0,00 e estado vazio.
- WHEN o usuário muda o fuso do navegador THEN o sistema SHALL recalcular as janelas e meses no novo fuso na próxima leitura.
- IF uma transação CreditCard é marcada neutra THEN o sistema SHALL mantê-la fora dos totais e exibi-la na visão de cartão.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| DASH-01 | P1: Regras de cálculo | - | Verified |
| DASH-02 | P1: Últimos 30 dias | - | Verified |
| DASH-03 | P1: Tendência de 12 meses | - | Verified |
| DASH-04 | P1: Gastos por categoria | - | Verified |
| DASH-05 | P1: Patrimônio | - | Verified |
| DASH-06 | P1: Lançamentos de rendimento | - | Verified |
| DASH-07 | P1: Visão de cartão | - | Verified |

**Coverage:** 7 total, 0 mapped to tasks, 7 unmapped ⚠️

---

## Success Criteria

- [ ] Soma da distribuição por categoria igual ao total de despesas do mesmo período.
- [ ] Mesmo conjunto de dados produz os mesmos totais em todos os painéis.
