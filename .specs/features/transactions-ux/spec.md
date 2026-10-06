# Extrato: UX e descrição (transactions-ux) Specification

Origem: `docs/v1/plano-implementacao.md` (F1) e `docs/v1/bugs-e-melhorias.md` (seção Transações e respostas do Q&A). Escopo: `web/` (extrato, formulário, componentes compartilhados), `api/` (campo `description`) e a migration `0007`.

## Problem Statement

O extrato não dá retorno visual das ações (categoria, edição, exclusão e criação acontecem em silêncio ou com um alerta fixo na página), usa o seletor de data nativo do navegador (que exibe o formato `dd/mm/aaaa` e parece preenchido), mostra a coluna Tipo que o sinal do valor já indica, não tem filtro rápido por mês e não guarda o título original da transação. O título original (`description`) é necessário para o import futuro e para o usuário reconhecer o lançamento.

## Goals

- [ ] Toda ação de escrita do extrato (categoria em massa, categoria numa linha, edição, exclusão, criação) mostra um toast em português, de sucesso ou de erro.
- [ ] Os filtros De/Até e o campo Data do formulário usam o `DatePicker`, que entrega `YYYY-MM-DD` sem passar por fuso.
- [ ] O extrato carrega com De/Até vazios, sem a coluna Tipo e com filtro rápido de mês e ano.
- [ ] `description` existe no banco e na API (leitura e criação), aparece no extrato e no modal de edição e nunca é alterada por PATCH.

## Out of Scope

Explicitamente excluído para evitar crescimento de escopo.

| Feature | Reason |
| ------- | ------ |
| Preencher `description` pelo import e aceitar `Other` na API e no front | Pertence à feature import-fixes (F2); aqui só a coluna `description` e o `Other` no check do banco |
| Editar `description` (PATCH, modal ou formulário de criação) | Decisão do Q&A: `description` é somente leitura; só o `name` é editável |
| `DatePicker` nos formulários de dashboard, despesa de cartão e retorno de investimento | Fora da pasta de transações; ficam com `type="date"` |
| Badges de categoria coloridos e ícones de banco | Pertencem à feature colors-and-icons (F4) |
| Mudar parâmetros de filtro da API de listagem | O filtro rápido usa os `from` e `to` que a API já aceita |
| Toast para o carregamento da lista e para a troca da neutra com sucesso | Não pedido; a falha da neutra usa o toast de erro |
| Persistir o filtro rápido ou os filtros na URL | Não pedido |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida ou registrada aqui.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Causa de De/Até "preenchidos" | O estado inicial de `TransactionsPage` já não tem `from` nem `to`; o que o usuário vê é o placeholder `dd/mm/aaaa` do `type="date"` nativo. O `DatePicker` mostra "Selecione a data" quando vazio e o teste garante que a primeira consulta não leva `from`/`to` | Reproduzir no navegador na T3 antes de alterar; se `from`/`to` realmente aparecerem, a T3 os remove do estado inicial | n |
| Helper de toast | `web/src/lib/notify.ts` com `notifySuccess(message)` e `notifyError(error, context)`; o erro sempre passa por `messageForError(error, context)`, nunca exibe o `message` da API | Pedido do plano: helper único sobre o `sonner` | n |
| `<Toaster />` | Montado uma única vez em `RootComponent` de `web/src/routes/__root.tsx` | Layout raiz cobre todas as rotas | n |
| Textos de sucesso | Categoria em massa: "Categoria aplicada a 1 transação" (singular) ou "Categoria aplicada a N transações"; categoria numa linha: "Categoria atualizada"; edição: "Transação atualizada"; criação: "Transação criada"; exclusão: "Transação excluída" | Mensagens curtas em pt-BR, com a contagem só no lote | n |
| Textos de erro | `messageForError(reason, "transaction")` em todos os cinco fluxos e na falha da neutra; o texto fixo "Não foi possível salvar a categoria" e o alerta `role="alert"` da página (`actionError`) deixam de existir | Um só caminho de erro; os testes da front-fixes que dependiam do texto antigo são atualizados | n |
| Falha no formulário | O diálogo continua aberto, o erro de campo continua inline e um toast de erro é emitido também | Cada fluxo precisa emitir toast de falha sem perder a marcação do campo | n |
| Falha ao excluir | O diálogo de confirmação continua aberto (o botão Excluir fica desabilitado enquanto a chamada está em andamento), a transação continua na lista e o toast de erro é emitido; o usuário tenta de novo ou cancela | Evita perder o contexto e permite repetir a ação, como no formulário | n |
| Toast de sucesso do formulário | Emitido depois que o diálogo fecha; o toast de edição é "Transação atualizada" mesmo quando só `name` muda | Um texto por fluxo | n |
| Troca da neutra | Sem toast de sucesso; falha mostra o toast de erro e o switch volta ao valor anterior | Fora dos cinco fluxos pedidos; manter o retorno visual de falha | n |
| Formato do `DatePicker` | Valor controlado como string `YYYY-MM-DD`, ou `""` quando vazio; `onChange(value: string)` recebe `""` ao limpar; nunca usa `toISOString`, `Date.parse` de string ISO nem `new Date("YYYY-MM-DD")`; o dia é montado com `new Date(ano, mês - 1, dia)` e lido com os getters locais | Evita o deslocamento de um dia por fuso | n |
| Exibição do `DatePicker` | Botão com `dd/MM/yyyy` (date-fns, locale `ptBR`) ou o placeholder "Selecione a data"; popover com `Calendar` em pt-BR, cabeçalho com seletores de mês e ano; botão "Limpar" dentro do popover quando há valor e `clearable` | Padrão do shadcn com o locale do projeto | n |
| Associação ao rótulo | O gatilho do `DatePicker` recebe o `id` do campo, então `Label htmlFor` e `getByLabelText("De")` continuam funcionando | Acessibilidade e testes existentes | n |
| Data padrão do formulário de criação | Hoje no fuso local, montada com os getters locais (corrige o `toISOString().slice(0, 10)`, que em UTC vira o dia seguinte depois das 21h em Brasília) | Evita criar lançamento no dia errado | n |
| Hora de `occurredAt` | Continua `new Date(`${date}T12:00:00`).toISOString()` (meio-dia local) | Comportamento atual testado; sem mudança | n |
| Filtro rápido: ativação | Mês (Janeiro a Dezembro) e ano (do ano atual menos 5 até o ano atual mais 1) são dois seletores; o filtro só fica ativo quando os dois têm valor; escolher só um mantém o outro vazio e não consulta a API | Evita adivinhar o mês ou ano faltante | n |
| Filtro rápido: efeito | Ativo, define `from` = primeiro dia do mês e `to` = último dia do mês (ex.: fevereiro de 2028 vai de `2028-02-01` a `2028-02-29`), volta à página 1 e mostra as datas nos pickers desabilitados | Sem mudança na API; cálculo por inteiros, sem `Date` com fuso | n |
| Saída do filtro rápido | Um botão "Limpar mês" ao lado dos seletores remove o filtro rápido e também `from`/`to`; "Limpar filtros" limpa o rápido e tudo mais. Como os pickers ficam desabilitados com o rápido ativo, a regra "escolher data em De/Até desativa o rápido" é garantida no tratador de mudança de data (função pura testada) e vale se o picker for habilitado | O pedido original tem as duas regras; o botão evita um beco sem saída | n |
| Coluna Tipo | Removida da tabela (cabeçalho e célula); o bloco "Tipo" do cartão móvel também sai; o filtro por Tipo e o parâmetro `type` ficam | Pedido: o sinal e a cor do valor já indicam | n |
| Banco: coluna `description` | `transactions.description text` nulo, sem `check` de tamanho | O limite é regra da API; o import (F2) trunca em 500 para nunca violar nada | n |
| Banco: `Other` | A mesma migration recria o check `transactions_payment_method_check` (nome gerado pelo Postgres a partir da 0003) com `'Other'`; são dois comandos separados e comentados; só a migration é da F1, a API e o front do `Other` são da F2 | A 0007 é compartilhada com a import-fixes | n |
| API: `description` na criação | Opcional, texto ou `null`; aparado nas pontas; vazio ou só espaços vira `null`; mais de 500 caracteres depois de aparar devolve 422 `validation_error` com `field: "description"` | Mesmo padrão de `notes` e dos erros de domínio do módulo (400 só para falha de esquema, como tipo errado) | n |
| API: `description` no PATCH | Ignorado: o corpo é aceito, o campo não altera a linha e a resposta 200 traz o valor guardado; não devolve 422 | O esquema do PATCH não declara o campo; propriedades desconhecidas já são ignoradas hoje (ex.: `counterpartyDocument`), então ignorar mantém o contrato e não quebra clientes antigos | n |
| API: `description` na leitura | Presente em todo `Transaction` (listagem, criação, edição) como `string \| null` | Pedido do plano | n |
| Extrato: exibição da `description` | Segunda linha dentro da célula do `name`, em `text-xs text-muted-foreground`, com truncamento de uma linha e `title` com o texto completo; nada renderizado quando `null`; o cartão móvel mostra a mesma linha abaixo do nome | Pedido do plano | n |
| Modal de edição: `description` | Texto somente leitura logo abaixo do título do diálogo, só na edição e só quando há valor; o formulário de criação não mostra nada | Decisão do Q&A | n |
| Outros `type="date"` | Só `TransactionsPage` e `TransactionForm` têm `type="date"` em `web/src/features/transactions`; os outros (dashboard, despesa de cartão, retorno de investimento) ficam como estão | Escopo do pedido | n |
| Mocks | `web/src/lib/api/mock/transactions.ts` guarda `description` na criação (aparada, vazio vira `null`), devolve na leitura e ignora no PATCH, como a API | Mocks não podem mascarar divergência | n |
| `api/openapi.json` | Regenerado com `pnpm -C api openapi:export`; o teste `swagger.int.test.ts` já exige que o arquivo versionado esteja atualizado | Contrato único (AD-001) | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Feedback por toast nas ações do extrato ⭐ MVP

**User Story**: Como usuário, quero ver um aviso em português quando uma ação do extrato dá certo ou falha, para saber o resultado sem procurar na tela.

**Why P1**: Hoje as ações falham em silêncio ou com um alerta fixo.

**Acceptance Criteria**:

1. The sistema SHALL montar o `<Toaster />` uma única vez no layout raiz da aplicação.  <!-- TUX-03 -->
2. The sistema SHALL emitir toasts somente pelo helper `notify`, com sucesso em texto fixo em português e erro sempre vindo de `messageForError`.  <!-- TUX-03 -->
3. IF o erro não é um `ApiError` conhecido THEN o helper SHALL exibir "Não foi possível concluir a operação. Tente novamente.".  <!-- TUX-03 -->
4. WHEN o usuário aplica uma categoria a N linhas selecionadas e a chamada conclui THEN o sistema SHALL exibir o toast "Categoria aplicada a 1 transação" quando N é 1 e "Categoria aplicada a N transações" quando N é maior que 1.  <!-- TUX-04 -->
5. IF a aplicação em massa falha THEN o sistema SHALL exibir o toast de erro, manter a seleção e as categorias anteriores.  <!-- TUX-04 -->
6. WHEN o usuário troca a categoria de uma linha e o salvamento conclui THEN o sistema SHALL exibir o toast "Categoria atualizada".  <!-- TUX-04 -->
7. IF o salvamento da categoria de uma linha falha THEN o sistema SHALL restaurar a categoria anterior e exibir o toast de erro.  <!-- TUX-04 -->
8. IF a troca da neutra falha THEN o sistema SHALL voltar ao valor anterior e exibir o toast de erro.  <!-- TUX-04 -->
9. WHEN a edição pelo modal conclui THEN o sistema SHALL fechar o diálogo e exibir o toast "Transação atualizada".  <!-- TUX-04 -->
10. WHEN a criação pelo modal conclui THEN o sistema SHALL fechar o diálogo e exibir o toast "Transação criada".  <!-- TUX-04 -->
11. IF a edição ou a criação falha THEN o sistema SHALL manter o diálogo aberto, manter o erro de campo inline quando a API informa `field` e exibir o toast de erro.  <!-- TUX-04 -->
12. WHEN a exclusão conclui THEN o sistema SHALL exibir o toast "Transação excluída".  <!-- TUX-04 -->
13. IF a exclusão falha THEN o sistema SHALL manter a transação na lista, manter o diálogo de confirmação aberto e exibir o toast de erro.  <!-- TUX-04 -->
14. The sistema SHALL NOT exibir o alerta fixo `role="alert"` de erro de ação do extrato; os erros de ação aparecem somente em toast.  <!-- TUX-04 -->

**Independent Test**: Executar cada um dos cinco fluxos com sucesso e com falha forçada e conferir o texto exato emitido pelo helper.

---

### P1: DatePicker nos filtros e no formulário ⭐ MVP

**User Story**: Como usuário, quero escolher datas em um calendário em português e ver os filtros vazios ao abrir o extrato.

**Why P1**: Corrige o bug de De/Até "preenchidos" e padroniza a entrada de data.

**Acceptance Criteria**:

1. The sistema SHALL oferecer o componente `DatePicker` com valor `YYYY-MM-DD` ou `""`, popover com `Calendar` em pt-BR e botão "Limpar" quando o valor existe.  <!-- TUX-05 -->
2. WHEN o usuário escolhe um dia no calendário THEN o `DatePicker` SHALL chamar `onChange` com a string `YYYY-MM-DD` exata desse dia, sem deslocamento por fuso.  <!-- TUX-05 -->
3. WHEN o usuário escolhe o último dia de um mês ou o primeiro dia de um ano THEN o `DatePicker` SHALL entregar a mesma data local (ex.: `2026-12-31`, `2027-01-01`).  <!-- TUX-05 -->
4. WHEN o usuário aciona "Limpar" THEN o `DatePicker` SHALL chamar `onChange` com `""`.  <!-- TUX-05 -->
5. WHILE o `DatePicker` está desabilitado, ele SHALL não abrir o calendário e SHALL mostrar o valor recebido.  <!-- TUX-05 -->
6. WHEN o valor recebido está vazio THEN o `DatePicker` SHALL mostrar "Selecione a data".  <!-- TUX-05 -->
7. WHEN o extrato é aberto pela primeira vez THEN o sistema SHALL consultar sem `from` nem `to` e mostrar De e Até com "Selecione a data".  <!-- TUX-01 -->
8. WHEN o usuário aciona "Limpar filtros" THEN o sistema SHALL consultar sem `from` nem `to` e mostrar De e Até vazios.  <!-- TUX-01 -->
9. WHEN o usuário escolhe uma data em De ou em Até THEN o sistema SHALL consultar com `from` ou `to` igual à string escolhida e voltar à página 1.  <!-- TUX-06 -->
10. The formulário de transação SHALL usar o `DatePicker` no campo Data e enviar `occurredAt` ao meio-dia local do dia escolhido.  <!-- TUX-06 -->
11. WHEN o formulário de criação abre THEN o campo Data SHALL mostrar hoje no fuso local.  <!-- TUX-06 -->
12. IF o usuário envia o formulário sem data THEN o sistema SHALL exibir "Informe a data" no campo.  <!-- TUX-06 -->

**Independent Test**: Abrir o extrato e ver De/Até vazios; escolher 31 de dezembro e ver `to=2026-12-31` na consulta.

---

### P1: Extrato sem coluna Tipo e com filtro rápido ⭐ MVP

**User Story**: Como usuário, quero um extrato mais limpo e um atalho para ver um mês inteiro.

**Why P1**: Pedidos diretos do Q&A, só de front.

**Acceptance Criteria**:

1. The tabela do extrato SHALL não ter o cabeçalho nem as células "Tipo", e o cartão móvel SHALL não ter o campo "Tipo".  <!-- TUX-02 -->
2. WHEN o usuário escolhe um valor no filtro Tipo THEN o sistema SHALL consultar com `type` correspondente e voltar à página 1.  <!-- TUX-02 -->
3. WHEN o usuário escolhe o mês e o ano no filtro rápido THEN o sistema SHALL consultar com `from` no primeiro dia e `to` no último dia daquele mês e voltar à página 1.  <!-- TUX-07 -->
4. WHEN o mês escolhido é fevereiro de um ano bissexto THEN o sistema SHALL usar `to` igual ao dia 29 (ex.: `2028-02-29`) e, em ano comum, o dia 28.  <!-- TUX-07 -->
5. WHILE o filtro rápido está ativo, os pickers De e Até SHALL ficar desabilitados e mostrar as datas do mês.  <!-- TUX-07 -->
6. WHEN apenas o mês ou apenas o ano está escolhido THEN o sistema SHALL não alterar `from` nem `to` e não consultar a API.  <!-- TUX-07 -->
7. WHEN o usuário aciona "Limpar mês" THEN o sistema SHALL desativar o filtro rápido, remover `from` e `to` e voltar à página 1.  <!-- TUX-07 -->
8. WHEN o usuário aciona "Limpar filtros" THEN o sistema SHALL limpar o filtro rápido e os demais filtros.  <!-- TUX-07 -->
9. WHEN uma data é definida em De ou Até com o filtro rápido ativo THEN o sistema SHALL desativar o filtro rápido e manter a data definida.  <!-- TUX-07 -->

**Independent Test**: Escolher "Fevereiro" e "2028" e ver `from=2028-02-01&to=2028-02-29` com os pickers desabilitados.

---

### P1: Campo `description` somente leitura ⭐ MVP

**User Story**: Como usuário, quero ver o título original de cada transação no extrato e no modal, sem poder editá-lo.

**Why P1**: Base do import da F2 e pedido explícito do Q&A.

**Acceptance Criteria**:

1. The migration `0007` SHALL adicionar `transactions.description text` nulo e, em comando separado, recriar o check de `payment_method` incluindo `'Other'`.  <!-- TUX-08 -->
2. WHEN uma linha é inserida com `payment_method` igual a `'Other'` THEN o banco SHALL aceitá-la e SHALL continuar rejeitando um valor fora da lista.  <!-- TUX-08 -->
3. The API SHALL devolver `description` (`string` ou `null`) em todo `Transaction` da listagem, da criação e da edição.  <!-- TUX-09 -->
4. WHEN `POST /transactions` recebe `description` THEN a API SHALL guardá-la aparada e devolvê-la, e WHEN ela é vazia, só espaços ou `null` THEN a API SHALL guardar `null`.  <!-- TUX-09 -->
5. WHEN `POST /transactions` omite `description` THEN a API SHALL guardar `null`.  <!-- TUX-09 -->
6. IF `description` tem mais de 500 caracteres depois de aparada THEN a API SHALL responder 422 `validation_error` com `field` igual a `description` e não criar a transação.  <!-- TUX-09 -->
7. IF `description` não é texto nem `null` THEN a API SHALL responder 400 `validation_error`.  <!-- TUX-09 -->
8. WHEN `PATCH /transactions/:id` recebe `description` THEN a API SHALL ignorar o campo, responder 200 e devolver a `description` guardada sem alteração, inclusive quando outros campos são alterados no mesmo corpo.  <!-- TUX-09 -->
9. The API SHALL isolar `description` por usuário com o mesmo RLS das transações.  <!-- TUX-09 -->
10. The `api/openapi.json` SHALL descrever `description` em `Transaction` e no corpo do POST e não descrevê-la no corpo do PATCH.  <!-- TUX-09 -->
11. WHERE a transação tem `description`, o extrato SHALL mostrá-la abaixo do `name` na mesma célula, em fonte menor e cor atenuada, e SHALL não renderizar nada quando é `null`.  <!-- TUX-10 -->
12. WHERE a transação tem `description`, o modal de edição SHALL mostrá-la como texto somente leitura abaixo do título e SHALL não oferecer campo para ela; o formulário de criação SHALL não mostrar nem enviar `description`.  <!-- TUX-10 -->
13. The `TransactionUpdate` e o corpo enviado pelo formulário SHALL não conter `description`.  <!-- TUX-10 -->
14. The mock de transações SHALL guardar `description` na criação, devolvê-la na leitura e ignorá-la no PATCH, como a API.  <!-- TUX-10 -->

**Independent Test**: Criar pela API com `description`, listar e ver o texto abaixo do nome; PATCH com outro texto e ver o original.

---

## Edge Cases

- WHEN o usuário escolhe um dia no `DatePicker` com o fuso do navegador a oeste ou a leste de UTC THEN o sistema SHALL entregar o mesmo dia escolhido.
- IF a string recebida pelo `DatePicker` não é uma data `YYYY-MM-DD` válida THEN o `DatePicker` SHALL tratá-la como vazia.
- WHEN o filtro rápido está ativo e o usuário muda a página THEN o sistema SHALL manter `from` e `to` do mês.
- IF a API devolve erro de rede ou código desconhecido em qualquer fluxo com toast THEN o sistema SHALL exibir a mensagem genérica.
- WHEN a `description` é longa THEN o extrato SHALL truncar em uma linha e expor o texto completo no atributo `title`.
- IF `description` chega com espaços nas pontas no POST THEN a API SHALL devolver o texto aparado.
- IF `description` tem exatamente 500 caracteres depois de aparada THEN a API SHALL aceitá-la.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| TUX-01 | P1: DatePicker nos filtros e no formulário | In Tasks | Pending |
| TUX-02 | P1: Extrato sem coluna Tipo e com filtro rápido | In Tasks | Pending |
| TUX-03 | P1: Feedback por toast nas ações do extrato | In Tasks | Pending |
| TUX-04 | P1: Feedback por toast nas ações do extrato | In Tasks | Pending |
| TUX-05 | P1: DatePicker nos filtros e no formulário | In Tasks | Pending |
| TUX-06 | P1: DatePicker nos filtros e no formulário | In Tasks | Pending |
| TUX-07 | P1: Extrato sem coluna Tipo e com filtro rápido | In Tasks | Pending |
| TUX-08 | P1: Campo `description` somente leitura | In Tasks | Pending |
| TUX-09 | P1: Campo `description` somente leitura | In Tasks | Pending |
| TUX-10 | P1: Campo `description` somente leitura | In Tasks | Pending |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] Os cinco fluxos de escrita do extrato emitem toast de sucesso e de erro com o texto definido, verificado por teste.
- [ ] A string enviada pelos pickers é exatamente a data escolhida, inclusive em 31/12 e 01/01.
- [ ] `pnpm -C api test` e `yarn --cwd web test`, mais typecheck e lint de cada app, passam.
- [ ] No navegador, contra a API local: De/Até vazios ao abrir, filtro rápido de fevereiro de 2028 consulta até o dia 29, e a `description` aparece no extrato e no modal.
