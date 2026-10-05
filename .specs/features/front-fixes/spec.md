# Correções do Front Specification

Origem: `.specs/INTEGRACAO-FRONT-BACK.md` (seções 5 e 8) e as pendências dos prompts 1 a 3. Escopo: apenas `web/`.

## Problem Statement

Com o front integrado à API real, aparecem falhas de uso: editar uma transação não consegue limpar observações e recibo, mensagens de erro em inglês chegam ao usuário, o cadastro com e-mail já usado e não confirmado diz "Verifique seu e-mail", ativar ou desativar conta falha em silêncio, e o extrato quase não tem teste de interface.

## Goals

- [ ] Nenhuma tela exibe texto de erro vindo da API; todas usam mensagens em português.
- [ ] Editar uma transação permite limpar observações e recibo.
- [ ] O extrato tem testes de interface para todos os fluxos principais.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Dashboard e Cartão de crédito | Dependem de backend que ainda não existe |
| Mudança de contrato da API | Escopo é só o front |
| Decisão 400 contra 422 na API | Decisão de backend; o front trata os dois como validação |
| Política do `web/.env` versionado | Decisão pendente do usuário |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Onde ficam as mensagens | `web/src/lib/api/errorMessages.ts` (função `messageForError(error, context)`); o módulo de importação reaproveita o genérico | Um único mapa evita divergência | n |
| Mensagem de `duplicate_name` | Depende do contexto: conta → "Já existe uma conta com esse apelido"; categoria → "Já existe uma categoria com esse nome" | Texto já usado nas telas | n |
| Código desconhecido ou falha de rede | "Não foi possível concluir a operação. Tente novamente." | Nunca expor texto técnico | n |
| Observações e recibo na edição | Campo esvaziado envia `null`; campo não alterado também é enviado como está | A API só limpa com `null` | n |
| Verde das receitas | Classe `text-emerald-700` no claro e `text-emerald-400` no escuro | Pedido original do prompt 3 | n |
| Período invertido (`from` > `to`) | Mensagem "A data inicial deve ser anterior à final" e nenhuma chamada à API | A API devolve lista vazia sem erro | n |
| Lockfile | `yarn.lock` é o lockfile oficial do `web/`; `bun.lock` fica como está | O projeto usa yarn | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Mensagens de erro em português ⭐ MVP

**User Story**: Como usuário, quero ver mensagens claras em português quando algo falha, para saber o que fazer.

**Why P1**: Textos em inglês chegam hoje ao usuário.

**Acceptance Criteria**:

1. The sistema SHALL mapear cada código de erro da API para uma mensagem em português em um único módulo, sem nunca exibir o campo `message` recebido da API.
2. WHEN o código é `duplicate_name` THEN o sistema SHALL exibir a mensagem do contexto (conta ou categoria).
3. WHEN o código é `holder_required`, `category_protected`, `reassign_required`, `invalid_amount`, `invalid_account`, `invalid_receipt_url`, `not_found`, `validation_error` ou `unauthorized` THEN o sistema SHALL exibir a mensagem definida para ele.
4. IF o código é desconhecido, ou a falha é de rede ou de outro tipo, THEN o sistema SHALL exibir "Não foi possível concluir a operação. Tente novamente.".
5. WHEN a API informa `field` THEN o sistema SHALL associar a mensagem ao campo correspondente quando o formulário tem esse campo.
6. The sistema SHALL usar o mapa nas telas de contas, categorias e extrato (formulário, edição inline, lote, exclusão e neutra).

**Independent Test**: Forçar cada código em um teste e conferir o texto em português na tela.

---

### P1: Editar transação limpa observações e recibo ⭐ MVP

**User Story**: Como usuário, quero apagar as observações ou o recibo de uma transação ao editar.

**Why P1**: Hoje o valor antigo permanece.

**Acceptance Criteria**:

1. WHEN o usuário esvazia as observações ao editar e salva THEN o sistema SHALL enviar `notes: null` e a transação SHALL aparecer sem observações.
2. WHEN o usuário esvazia o recibo ao editar e salva THEN o sistema SHALL enviar `receipt: null`.
3. WHEN o usuário cria uma transação com observações ou recibo vazios THEN o sistema SHALL omitir esses campos do corpo.
4. WHEN o usuário preenche observações ou recibo na edição THEN o sistema SHALL enviar o texto sem espaços nas pontas.

**Independent Test**: Editar uma transação com observação, apagar o texto, salvar e ver o campo vazio.

---

### P1: Cadastro com e-mail já usado ⭐ MVP

**User Story**: Como visitante, quero ser avisado quando o e-mail já está cadastrado.

**Why P1**: O caso não confirmado hoje parece sucesso.

**Acceptance Criteria**:

1. WHEN o resultado do cadastro traz o erro `user_already_exists` THEN o sistema SHALL tratar o e-mail como já cadastrado.
2. WHEN o usuário devolvido tem `identities` vazio THEN o sistema SHALL tratar o e-mail como já cadastrado.
3. WHEN o usuário devolvido tem `confirmation_sent_at` pelo menos 1000 ms depois de `created_at` THEN o sistema SHALL tratar o e-mail como já cadastrado.
4. WHEN o usuário devolvido tem `confirmation_sent_at` menos de 1000 ms depois de `created_at` THEN o sistema SHALL tratar o cadastro como novo.
5. WHEN o e-mail é tratado como já cadastrado THEN o sistema SHALL exibir "E-mail já cadastrado" no campo e-mail.

**Independent Test**: Cadastrar duas vezes o mesmo e-mail sem confirmar e ver "E-mail já cadastrado".

---

### P2: Contas, período e aparência

**User Story**: Como usuário, quero feedback quando ativar uma conta falha, um aviso de período inválido no extrato e receitas em verde.

**Why P2**: Melhora de qualidade, sem bloquear o uso.

**Acceptance Criteria**:

1. IF ativar ou desativar uma conta falha THEN o sistema SHALL manter o diálogo aberto e exibir a mensagem em português.
2. WHEN o usuário informa uma data inicial depois da final nos filtros do extrato THEN o sistema SHALL exibir "A data inicial deve ser anterior à final" e não consultar a API com esse período.
3. The sistema SHALL exibir o valor das receitas no extrato em verde e o das despesas em vermelho com sinal de menos.

**Independent Test**: Forçar a falha de ativação e ver a mensagem; informar período invertido e ver o aviso.

---

### P1: Testes de interface do extrato ⭐ MVP

**User Story**: Como mantenedor, quero testes de interface do extrato para proteger os fluxos principais.

**Why P1**: Pedidos desde o prompt 3, ainda não entregues.

**Acceptance Criteria**:

1. WHEN o usuário escolhe uma categoria em uma linha THEN o sistema SHALL salvá-la sem abrir formulário e, IF o salvamento falha, THEN o sistema SHALL restaurar a categoria anterior e exibir "Não foi possível salvar a categoria".
2. WHEN o usuário aplica uma categoria a linhas selecionadas THEN o sistema SHALL fazer uma única chamada com todos os ids e, IF falha, THEN o sistema SHALL manter a seleção e as categorias anteriores.
3. WHEN o usuário alterna o switch de neutra THEN o sistema SHALL persistir o novo valor e, IF falha, THEN o sistema SHALL voltar ao valor anterior.
4. WHEN o usuário digita na busca THEN o sistema SHALL consultar uma única vez após 300 ms e voltar à página 1.
5. WHEN o usuário altera um filtro THEN o sistema SHALL consultar com o parâmetro correspondente e voltar à página 1, e "Limpar filtros" SHALL restaurar o padrão.
6. WHEN o usuário clica no cabeçalho Valor duas vezes THEN o sistema SHALL consultar em ordem crescente e depois decrescente.
7. WHEN não há resultados THEN o sistema SHALL exibir "Nenhuma transação encontrada"; WHEN há mais de uma página THEN o sistema SHALL navegar com Próxima e Anterior.
8. WHEN o usuário confirma a exclusão THEN o sistema SHALL remover a transação e, WHEN cancela, THEN o sistema SHALL mantê-la.
9. WHEN o usuário cria ou edita pelo formulário THEN o sistema SHALL enviar os dados corretos, convertendo "1.234,56" para "1234.56".

**Independent Test**: Rodar a suíte e conferir cada fluxo acima nomeado em um teste.

---

### P2: Lockfile sincronizado

**User Story**: Como desenvolvedor, quero instalar as dependências do front de forma reproduzível.

**Why P2**: Qualidade.

**Acceptance Criteria**:

1. WHEN executo `yarn install --frozen-lockfile` em `web/` THEN o sistema SHALL concluir sem pedir alterações no `yarn.lock`.

**Independent Test**: Rodar o comando em uma cópia limpa.

---

## Edge Cases

- IF a API devolve um código que o mapa não conhece THEN o sistema SHALL exibir a mensagem genérica, nunca o texto da API.
- WHEN o usuário edita uma transação sem mexer em observações e recibo THEN o sistema SHALL preservar os valores existentes.
- IF a falha é de rede (sem resposta) THEN o sistema SHALL exibir a mensagem genérica.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| FIX-01 | P1: Mensagens de erro em português | - | Implementing |
| FIX-02 | P1: Editar transação limpa observações e recibo | - | Implementing |
| FIX-03 | P1: Cadastro com e-mail já usado | - | Implementing |
| FIX-04 | P2: Contas, período e aparência | - | Implementing |
| FIX-05 | P1: Testes de interface do extrato | - | Pending |
| FIX-06 | P2: Lockfile sincronizado | - | Pending |

**Coverage:** 6 total, 0 mapped to tasks, 6 unmapped ⚠️

---

## Success Criteria

- [ ] Nenhum texto em inglês aparece nas telas de contas, categorias e extrato ao forçar cada código de erro.
- [ ] `yarn --cwd web test`, `typecheck` e `lint` passam e o `yarn install --frozen-lockfile` conclui.
