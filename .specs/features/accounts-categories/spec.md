# Contas e Categorias Specification

Fonte: `docs/PRD.md` §5.2 (US-04), §5.4 (US-09).

## Problem Statement

Toda transação pertence a uma conta bancária e tem uma categoria. As contas carregam os nomes de titular usados na detecção de transferências neutras; as categorias começam com uma lista padrão em português e podem ser gerenciadas pelo usuário, exceto as categorias de sistema que têm regra especial nos cálculos.

## Goals

- [ ] Usuário cadastra, edita, desativa e reativa contas sem perder transações.
- [ ] Usuário novo recebe 17 categorias iniciais, exibidas sempre em português.
- [ ] As 3 categorias de sistema nunca são alteradas nem excluídas.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Exclusão de contas | Decisão do PRD: apenas desativar |
| Saldo inicial por conta | Fora do MVP |
| Ícones / cores de categoria | Não pedido |
| Subcategorias | Não pedido |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Categorias de sistema (não editáveis) | *Estorno* (Reversal), *Sem categoria* (Uncategorized), *Investimentos* (Investments) | PRD Q13 aberta; são as 3 com regra especial de cálculo | n |
| Categoria "Desconhecida" (Unknown) | Categoria comum, editável | PRD só bloqueia as com comportamento especial | n |
| Nome de categoria único por usuário | Sim, comparação sem diferenciar caixa | Evita ambiguidade na tabela | n |
| Bancos disponíveis | Nubank, Sofisa Direto, Neon, XP, Outro | PRD §5.2 | n |
| Nome de conta (apelido) único por usuário | Sim | Necessário para escolher contas sem ambiguidade | n |
| Nomes de titular: quantidade | 1 ou mais, sem limite fixo | PRD não limita | n |
| Excluir categoria em uso | Exige escolher categoria destino; destino não pode ser a própria categoria | PRD US-09 | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Gerenciar contas ⭐ MVP

**User Story**: Como usuário, quero cadastrar e desativar minhas contas para associar cada transação à conta certa.

**Why P1**: Importação e neutras dependem de contas e titulares.

**Acceptance Criteria**:

1. WHEN o usuário cria uma conta com banco, apelido e ao menos um nome de titular THEN o sistema SHALL persistir a conta como ativa.
2. IF o apelido já existe para o usuário THEN o sistema SHALL rejeitar a criação com mensagem de apelido duplicado.
3. IF a conta é criada sem nome de titular THEN o sistema SHALL rejeitar com mensagem de titular obrigatório.
4. WHEN o usuário edita apelido, banco ou nomes de titular THEN o sistema SHALL salvar as alterações sem modificar transações existentes.
5. WHEN o usuário desativa uma conta THEN o sistema SHALL marcá-la como inativa sem alterar, mover nem remover suas transações.
6. WHILE uma conta está inativa o sistema SHALL ocultá-la da seleção de conta em novas transações e importações.
7. WHILE uma conta está inativa o sistema SHALL continuar usando seus nomes de titular na detecção de neutras.
8. WHEN o usuário reativa uma conta inativa THEN o sistema SHALL torná-la selecionável novamente.
9. The sistema SHALL não oferecer nem expor operação de exclusão de conta.
10. WHILE uma conta está inativa o sistema SHALL incluir suas transações nos filtros, tabela e cálculos.

**Independent Test**: Criar conta, importar transações, desativar e ver que o extrato continua igual e a conta some da seleção.

---

### P1: Categorias iniciais e de sistema ⭐ MVP

**User Story**: Como usuário, quero categorias prontas em português para categorizar sem configurar nada.

**Why P1**: A categorização é parte do fluxo mensal.

**Acceptance Criteria**:

1. WHEN um usuário é criado THEN o sistema SHALL semear 17 categorias com os identificadores Entertainment, Food, Salaries, Healthcare, Utilities, Unknown, Transport, Help, PJ, Bills, Emergency, Uncategorized, Wishes, Reversal, Shopping, Pets e Investments.
2. The sistema SHALL exibir os nomes em português: Entretenimento, Alimentação, Salários, Saúde, Utilidades, Desconhecida, Transporte, Ajuda (a terceiros), PJ, Contas, Emergência, Sem categoria, Desejos, Estorno (de compras), Compras, Pets e Investimentos.
3. The sistema SHALL marcar Reversal, Uncategorized e Investments como categorias de sistema.
4. IF o usuário tenta renomear ou excluir uma categoria de sistema THEN o sistema SHALL rejeitar com erro 403 e mensagem de categoria protegida.
5. The sistema SHALL permitir atribuir categorias de sistema a transações.

**Independent Test**: Criar usuário, listar categorias (17, nomes em português) e tentar renomear Estorno (403).

---

### P1: Gerenciar categorias próprias ⭐ MVP

**User Story**: Como usuário, quero criar, renomear e excluir categorias para adaptar a classificação ao meu uso.

**Why P1**: Pedido explícito do PRD.

**Acceptance Criteria**:

1. WHEN o usuário cria uma categoria com nome não vazio THEN o sistema SHALL persisti-la como categoria comum.
2. IF o nome coincide, sem diferenciar caixa, com outra categoria do usuário THEN o sistema SHALL rejeitar com mensagem de nome duplicado.
3. WHEN o usuário renomeia uma categoria comum THEN o sistema SHALL manter todas as transações vinculadas a ela.
4. WHEN o usuário exclui uma categoria comum sem transações THEN o sistema SHALL removê-la.
5. WHEN o usuário exclui uma categoria comum em uso e informa uma categoria destino THEN o sistema SHALL reatribuir todas as suas transações ao destino e removê-la na mesma operação.
6. IF o usuário exclui uma categoria em uso sem informar destino THEN o sistema SHALL rejeitar a exclusão com mensagem pedindo a categoria destino.
7. IF a reatribuição falha THEN o sistema SHALL manter a categoria e suas transações inalteradas.

**Independent Test**: Criar categoria, usá-la em 2 transações, excluí-la com destino e ver as 2 transações no destino.

---

## Edge Cases

- IF o nome da categoria ou do apelido tem apenas espaços THEN o sistema SHALL rejeitá-lo como vazio.
- IF o usuário informa como destino a própria categoria excluída THEN o sistema SHALL rejeitar a operação.
- WHEN o nome de titular é salvo THEN o sistema SHALL removê-lo de espaços nas pontas e rejeitar duplicatas dentro da mesma conta.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| ACCT-01 | P1: Contas (criar, validar, editar) | - | Implementing |
| ACCT-02 | P1: Contas (desativar, reativar, sem exclusão) | - | Implementing |
| ACCT-03 | P1: Contas (efeitos da inatividade) | - | Pending |
| CAT-01 | P1: Categorias iniciais (semeadura e nomes pt-BR) | - | Implementing |
| CAT-02 | P1: Categorias de sistema (proteção) | - | Pending |
| CAT-03 | P1: Categorias próprias (criar, renomear) | - | Implementing |
| CAT-04 | P1: Categorias próprias (excluir com reatribuição) | - | Pending |

**Coverage:** 7 total, 0 mapped to tasks, 7 unmapped ⚠️

---

## Success Criteria

- [ ] Nenhuma transação é perdida ou alterada ao desativar uma conta.
- [ ] 100% das categorias aparecem em português na interface.
