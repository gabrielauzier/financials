# Transações Specification

Fonte: `docs/PRD.md` §5.3 (US-05, US-06, US-07, US-08), §5.8.

## Problem Statement

O extrato consolidado é o núcleo do produto. O usuário precisa ver todas as transações de todas as contas em uma tabela, criar e editar registros manualmente, categorizar rápido (inclusive em lote) e marcar transferências neutras que não devem afetar nenhum cálculo.

## Goals

- [ ] Tabela única com filtros e busca sobre todas as contas.
- [ ] Alterar a categoria de uma transação em um clique, sem abrir formulário.
- [ ] Valores sempre armazenados com 2 casas decimais exatas e exibidos em BRL.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Importação de CSV | Spec `import` |
| Upload de arquivo de recibo | PRD: `receipt` é só URL |
| Transações recorrentes / parceladas | Não pedido para Transactions |
| Edição em lote de campos além da categoria | Não pedido |
| Exportação da tabela | Fora do MVP |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Tamanho de página | 50 linhas | PRD pede paginação sem tamanho | n |
| Categoria padrão ao criar manualmente | *Sem categoria* | Mantém consistência com importação | n |
| Campos obrigatórios (manual) | nome, tipo, data, valor, conta, método de pagamento | PRD lista os campos; categoria tem padrão | n |
| Valor máximo | Menor que 1.000.000.000.000,00 (numeric(14,2)) | Limite do tipo de dado do PRD | n |
| Busca por nome | Contém, sem diferenciar caixa e acentos | PRD não detalha | n |
| Data de transação futura | Permitida | PRD não restringe | n |
| Recibo | Aceita apenas URL http ou https | PRD: apenas URL | n |
| Transação em conta inativa | Pode ser editada e excluída | PRD só bloqueia seleção em novas | n |
| Identificador externo (`identifier`) em transação manual | Vazio | Só existe em importação | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Tabela de extrato ⭐ MVP

**User Story**: Como usuário, quero ver todas as transações em uma tabela para acompanhar o extrato consolidado.

**Why P1**: É a visão principal de acompanhamento.

**Acceptance Criteria**:

1. WHEN o usuário abre o extrato THEN o sistema SHALL listar as transações de todas as contas do usuário ordenadas por data decrescente, 50 por página.
2. The sistema SHALL exibir por linha: data, nome, conta, categoria, método de pagamento, tipo, valor, indicador de neutra e observações.
3. WHEN o usuário aplica filtros de período, conta, categoria, tipo ou neutra THEN o sistema SHALL listar apenas transações que atendem a todos os filtros combinados.
4. WHEN o usuário digita um texto na busca THEN o sistema SHALL listar transações cujo nome contém o texto, sem diferenciar caixa e acentos.
5. WHEN o usuário ordena por uma coluna THEN o sistema SHALL reordenar a lista inteira, não apenas a página atual.
6. WHEN não há transações para os filtros THEN o sistema SHALL exibir o estado vazio com a mensagem "Nenhuma transação encontrada".
7. The sistema SHALL exibir valores em BRL no formato `R$ 1.234,56` e datas no fuso local do usuário.

**Independent Test**: Com 120 transações de 2 contas, filtrar por conta e ver só as dela, em 50 por página.

---

### P1: CRUD manual ⭐ MVP

**User Story**: Como usuário, quero criar, editar e excluir transações para registrar o que o extrato não cobre.

**Why P1**: Pedido explícito do PRD.

**Acceptance Criteria**:

1. WHEN o usuário envia nome, tipo, data, valor, conta e método de pagamento válidos THEN o sistema SHALL criar a transação com categoria *Sem categoria* se nenhuma for informada.
2. IF o valor é menor ou igual a zero THEN o sistema SHALL rejeitar a transação com mensagem de valor inválido.
3. IF o valor tem mais de 2 casas decimais THEN o sistema SHALL rejeitar a transação com mensagem de valor inválido.
4. IF algum campo obrigatório está vazio THEN o sistema SHALL rejeitar a transação indicando o campo.
5. IF a conta informada está inativa ou não pertence ao usuário THEN o sistema SHALL rejeitar a criação.
6. IF o recibo informado não é uma URL http ou https válida THEN o sistema SHALL rejeitar a transação com mensagem de URL inválida.
7. WHEN o usuário edita qualquer campo editável de uma transação THEN o sistema SHALL persistir a alteração e preservar os demais campos.
8. WHEN o usuário confirma a exclusão THEN o sistema SHALL remover a transação definitivamente.
9. IF o usuário cancela a confirmação de exclusão THEN o sistema SHALL manter a transação.
10. The sistema SHALL armazenar o valor como número positivo e determinar entrada ou saída apenas pelo tipo (Income ou Expense).
11. The sistema SHALL identificar cada transação por `uuid`.

**Independent Test**: Criar, editar valor e excluir uma transação; tabela reflete cada passo.

---

### P1: Edição rápida de categoria ⭐ MVP

**User Story**: Como usuário, quero alterar a categoria direto na tabela para categorizar rápido após importar.

**Why P1**: O fechamento mensal tem meta de 10 minutos.

**Acceptance Criteria**:

1. WHEN o usuário escolhe uma categoria no seletor de uma linha THEN o sistema SHALL salvar imediatamente a nova categoria sem abrir formulário.
2. WHEN a categoria é salva THEN o sistema SHALL atualizar os painéis de dashboard na próxima leitura.
3. IF o salvamento falha THEN o sistema SHALL restaurar a categoria anterior na linha e exibir mensagem de erro.
4. WHEN o usuário seleciona várias linhas e escolhe uma categoria THEN o sistema SHALL atribuir essa categoria a todas as linhas selecionadas em uma única operação.
5. IF a operação em lote falha THEN o sistema SHALL manter todas as linhas selecionadas com a categoria anterior.

**Independent Test**: Selecionar 5 linhas "Sem categoria", aplicar *Alimentação* e ver as 5 atualizadas.

---

### P1: Transferência neutra manual ⭐ MVP

**User Story**: Como usuário, quero marcar uma transação como neutra para que ela não afete receitas, despesas nem acompanhamentos.

**Why P1**: Evita distorção de totais por transferências entre contas próprias.

**Acceptance Criteria**:

1. WHEN o usuário alterna o indicador de neutra de uma transação THEN o sistema SHALL persistir o novo valor.
2. WHEN o usuário filtra por neutra THEN o sistema SHALL listar apenas transações com `neutral` igual ao valor escolhido.
3. WHILE uma transação está marcada neutra o sistema SHALL excluí-la de receitas, despesas, tendência, categorias e patrimônio (regras na spec `dashboards`).
4. The sistema SHALL exibir transações neutras na tabela com indicação visual.

**Independent Test**: Marcar uma despesa como neutra e ver o total de despesas dos últimos 30 dias diminuir.

---

## Edge Cases

- WHEN o usuário altera tipo ou valor de uma transação THEN o sistema SHALL aplicar o novo valor aos dashboards na próxima leitura.
- IF a categoria da transação é excluída com reatribuição THEN o sistema SHALL exibir a categoria destino na tabela.
- WHEN a data de uma transação cai próxima à meia-noite THEN o sistema SHALL exibi-la no dia local do usuário correspondente ao instante armazenado em UTC.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| TXN-01 | P1: Tabela (listagem, ordenação, paginação) | - | Implementing |
| TXN-02 | P1: Tabela (filtros e busca) | - | Implementing |
| TXN-03 | P1: Tabela (formatação BRL e fuso) | - | Pending |
| TXN-04 | P1: CRUD (criar e validar) | - | Implementing |
| TXN-05 | P1: CRUD (editar e excluir) | - | Implementing |
| TXN-06 | P1: Edição rápida de categoria | - | Implementing |
| TXN-07 | P1: Edição em lote | - | Implementing |
| TXN-08 | P1: Neutra manual | - | Implementing |

**Coverage:** 8 total, 0 mapped to tasks, 8 unmapped ⚠️

---

## Success Criteria

- [ ] Categorizar 20 transações leva menos de 2 minutos com edição inline e em lote.
- [ ] Nenhum valor monetário é armazenado como ponto flutuante.
