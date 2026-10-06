# Extrato: ajustes finos v2 (transactions-ux-v2) Specification

Origem: seção "F5 · transactions-ux-v2" de `docs/v1/plano-melhoria-transacoes.md` e os itens "Ajustes finos a fazer - v2" de `docs/v1/melhoria-transacoes.md`. Escopo: `api/` (campo `identifier` somente leitura e `openapi.json`) e `web/` (modal de edição, toasts, filtros do extrato e dia da semana). Sem migration: a coluna `transactions.identifier` já existe desde a `0003`.

## Problem Statement

O modal de edição não mostra como a transação é identificada (o id do banco e o identificador externo que o import grava), os toasts de sucesso e de erro têm a mesma aparência, o único jeito de tirar um filtro do extrato é limpar todos, e a data da transação não diz o dia da semana, o que atrapalha reconhecer o lançamento. São quatro ajustes pequenos que pedem pouca regra nova e muito cuidado com fuso e contraste.

## Goals

- [x] A API devolve `identifier` em toda `Transaction` e nunca o aceita para escrita; o modal de edição mostra "ID" e "Identificador externo" como texto com botão de copiar.
- [x] Os toasts de sucesso (verde), de erro (vermelho) e de informação (neutro) se distinguem nos temas claro e escuro, com contraste de texto de pelo menos 4,5:1 calculado a partir dos valores do tema.
- [x] Cada filtro ativo do extrato (busca, tipo, conta, categoria, neutra, De, Até e mês rápido) tem um "x" que limpa só aquele filtro, mantém os demais e a ordenação e volta à página 1.
- [x] A tabela e o cartão móvel mostram o dia da semana abreviado abaixo da data, calculado da data local da transação, correto às 23:30 locais, nas viradas de mês e de ano e em ano bissexto.

## Out of Scope

Explicitamente excluído para evitar crescimento de escopo.

| Feature | Reason |
| ------- | ------ |
| Aceitar ou editar `identifier` em POST ou PATCH, ou mostrar o campo no formulário de criação | Pedido: só exibição. O import continua sendo o único que grava a coluna |
| Coluna de `identifier` na tabela, busca por `identifier` e filtro por `identifier` | Não pedido |
| Botão de copiar em outros campos do modal | Só os dois identificadores foram pedidos |
| Cor própria para toast de aviso (`warning`) e de carregamento (`loading`) | Nenhum fluxo os emite; ficam no estilo neutro para não destoar |
| Posição, duração, ícones ou animação dos toasts | Só a cor por tipo foi pedida |
| Dia da semana por extenso, tooltip do dia da semana e dia da semana em outras telas (dashboard, import, despesas de cartão) | O pedido é a abreviação abaixo da data nas linhas do extrato |
| Mudar de fuso o dia exibido (o extrato continua no fuso do navegador) | O dia da semana segue a data que já aparece |
| Resumo, paginação e filtros salvos | Pertencem às features F6 e F7 |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida ou registrada aqui.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Formato de `identifier` na API | `string \| null` em todo `Transaction` (listagem, criação, edição), texto guardado sem alteração (sem aparar, sem normalizar) | Coluna `text` existente; o import grava o identificador do banco e a deduplicação depende do valor exato | n |
| `identifier` em POST | Ignorado: o corpo é aceito, a transação é criada com `identifier` nulo e a resposta 201 traz `identifier: null`; não devolve 400 nem 422, qualquer que seja o tipo do valor enviado | Mesmo padrão da `description` no PATCH e das propriedades desconhecidas do módulo; o esquema do POST não declara o campo | n |
| `identifier` em PATCH | Ignorado: 200 e a resposta traz o `identifier` guardado, inclusive quando outros campos mudam no mesmo corpo | Mesmo padrão; clientes que reenviam o objeto lido continuam funcionando | n |
| Linhas que já têm `identifier` | Devolvem o texto guardado em GET e PATCH; o teste insere a linha direto no banco (como o import faz) | A API não tem outro jeito de criar uma linha com `identifier` | n |
| Isolamento | Herda o RLS da tabela `transactions`; o teste confere que outro usuário não vê o `identifier` na listagem nem no PATCH | AD-002 | n |
| `api/openapi.json` | Regenerado com `pnpm -C api openapi:export`; `identifier` entra em `Transaction` como `string` anulável e não entra nos corpos do POST e do PATCH; o `swagger.int.test.ts` já exige o arquivo atualizado | Contrato único (AD-001) | n |
| Tipos e mock do web | `Transaction.identifier: string \| null`; `TransactionInput` e `TransactionUpdate` não ganham o campo; o mock semeia `identifier` em parte das linhas, cria com `null` e ignora o campo no POST e no PATCH como a API | Mocks não podem mascarar divergência | n |
| Onde aparecem os identificadores | Só no modal de edição, num bloco `dl` com o nome acessível "Identificadores da transação", entre o cabeçalho e os campos; o formulário de criação não mostra o bloco | Pedido: exibir no modal da transação existente | n |
| Rótulos e valores | Rótulos "ID" (o `id` uuid do banco) e "Identificador externo" (`identifier`); valores como texto (`dd`) em fonte monoespaçada com quebra de linha, nunca em `input`, `textarea` ou controle editável | Somente leitura | n |
| Identificador ausente | O valor mostra "—" e o botão de copiar desse campo não é renderizado | Não há o que copiar | n |
| Copiar | Botões com nome acessível "Copiar ID" e "Copiar identificador externo" chamam `navigator.clipboard.writeText` com o valor exato; sucesso emite `notifySuccess("ID copiado")` ou `notifySuccess("Identificador externo copiado")` | Retorno visual pelo canal único de toast | n |
| Falha ao copiar | Sem `navigator.clipboard` (contexto sem HTTPS) ou com a promessa rejeitada, `notifyError(reason)` mostra a mensagem genérica do mapa ("Não foi possível concluir a operação. Tente novamente.") e o modal continua aberto | Nenhum texto novo no mapa de erros da API; a falha de cópia não tem código de API | n |
| Corpo do PATCH do modal | Continua sem `id` nem `identifier` (o `TransactionUpdate` não os tem) | Somente leitura | n |
| Estratégia de cor dos toasts | `classNames` por tipo no `Toaster` (`success`, `error`, `info`, `default`, `warning`, `loading`), sem `richColors`; as classes ficam num módulo próprio (`toast-styles.ts`) lido pelo `sonner.tsx` e pelo teste de contraste | `richColors` usa cores fixas do `sonner` fora do tema Tailwind; assim o contraste é calculado dos valores do tema, como pedido | n |
| Paleta | Sucesso: `emerald` (fundo 50, texto 900, borda 300; escuro: fundo 950, texto 100, borda 800). Erro: `red` com os mesmos degraus. Informação, padrão, aviso e carregamento: `background`, `foreground` e `border` do tema do app | Verde e vermelho do Tailwind, já usados no app (`emerald` no valor da receita); neutro herda o tema | n |
| Tema escuro | Variante `dark:` do projeto (`@custom-variant dark (&:is(.dark *))`), junto do prefixo `group-[.toaster]:` que o wrapper já usa para vencer o CSS padrão do `sonner` | Padrão existente do wrapper | n |
| Cálculo do contraste | Teste lê `--color-emerald-*` e `--color-red-*` de `tailwindcss/theme.css` e `--background`, `--foreground` de `web/src/styles.css`, converte OKLCH para sRGB e calcula a razão de luminância WCAG 2.x; limite 4,5:1 para o texto; matiz verde (110° a 180°) no sucesso, vermelho (0° a 40°) no erro e, na informação, fundo e texto iguais a `--background` e `--foreground` do tema (o escuro do app tem croma 0,042, por isso o neutro é definido pelos tokens do tema e não por um limite de croma) | Verificável sem navegador e sem fixar nomes de classes na asserção | n |
| Info neutro | `notify` ganha `notifyInfo(message)` (`toast.info`); nenhum fluxo o usa ainda | Sem o helper, o tipo neutro não seria emitido pelo canal único nem testável | n |
| "Filtro ativo" | Busca: o campo tem texto; Tipo, Conta, Categoria, Neutra, De e Até: o filtro tem valor; mês rápido: mês e ano escolhidos. Só o mês ou só o ano escolhido não é filtro ativo (nada vai para a consulta) e continua sendo limpo pelo botão "Limpar mês" | O "x" aparece onde o filtro altera a consulta | n |
| Nome e posição do "x" | Botão com ícone ao lado do rótulo visível, nome acessível "Limpar filtro <rótulo>": "Limpar filtro De", "Limpar filtro Até", "Limpar filtro Conta", "Limpar filtro Categoria", "Limpar filtro Tipo", "Limpar filtro Neutra", "Limpar filtro Mês rápido" (ao lado do rótulo "Mês"); a busca não tem rótulo visível, então o "x" fica dentro do campo, à direita, com o nome "Limpar filtro Busca" | O nome distingue o botão de "Limpar filtros" e de "Limpar mês" (que continuam) | n |
| Efeito de limpar | Remove só a chave daquele filtro de `filters`, volta `page` para 1 e mantém os demais filtros e `sort`/`order`; a seleção de linhas já é zerada quando os filtros mudam | Pedido | n |
| Limpar a busca | Esvazia o campo e remove `q` na hora, sem esperar os 300 ms da busca | O "x" é uma ação explícita; esperar o debounce deixaria a lista desatualizada por um instante | n |
| De e Até com o mês rápido ativo | Os pickers ficam desabilitados e não mostram "x"; o "x" é o do mês rápido | As datas pertencem ao mês; limpar uma só quebraria a regra do filtro rápido | n |
| "Libera as datas" ao limpar o mês rápido | Equivale ao botão "Limpar mês": desativa o filtro rápido, remove `from` e `to` e habilita os pickers vazios | Mantém a regra já aceita (TUX-07) e evita datas "órfãs" do mês | n |
| Período inválido | O alerta "A data inicial deve ser anterior à final" some quando o "x" de De ou de Até corrige o período | Consequência direta de remover uma das datas | n |
| Dia da semana: fonte | `occurredAt` convertido com `new Date(iso)` e lido com `getDay()` no fuso local do navegador, o mesmo da data exibida por `formatDateLocal`; nunca por `new Date("YYYY-MM-DD")` | A data exibida e o dia da semana não podem divergir | n |
| Dia da semana: texto | `["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]` indexado por `getDay()`; instante inválido devolve `""` e nada é renderizado | Abreviações do pedido, com acento em "Sáb" | n |
| Dia da semana: estilo | Linha própria abaixo da data com `text-xs` e `text-muted-foreground`; a data usa `text-foreground` (na tabela é a cor que a célula já tem; no cartão móvel, onde a linha toda era `text-muted-foreground`, a data passa a `text-foreground` para o dia da semana ficar mais claro que ela). No cartão móvel, a data e o dia da semana formam um bloco e a conta continua ao lado, depois do "·" | "Menor e mais clara" que a data | n |
| Testes de fuso | Fixam o fuso com `process.env.TZ` (America/Sao_Paulo e UTC) e o relógio só com `Date` falso quando o relógio importa; o instante da transação vem da API, então os casos de borda usam `occurredAt` explícito | Lições de determinismo (L-027 e `transactions-ux`) | n |
| Tamanho de `TransactionsPage.tsx` | Os componentes novos entram em arquivos próprios (`FilterField.tsx`, `TransactionDate.tsx`, `TransactionIdentifiers.tsx`); a página só os usa | Pedido: não engordar o arquivo de 717 linhas | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Identificadores da transação na API e nos mocks ⭐ MVP

**User Story**: Como usuário, quero que a API me diga o identificador externo de cada transação, sem poder alterá-lo, para o modal mostrar como ela é identificada.

**Why P1**: Base do modal; sem o campo na API nada aparece.

**Acceptance Criteria**:

1. The API SHALL devolver `identifier` (`string` ou `null`) em todo `Transaction` da listagem, da criação e da edição.  <!-- TUXV2-01 -->
2. WHERE a linha tem `identifier` guardado, a API SHALL devolver o texto guardado, sem alteração, no GET e no PATCH.  <!-- TUXV2-01 -->
3. WHEN `POST /transactions` recebe `identifier` THEN a API SHALL ignorá-lo, criar a transação com `identifier` nulo e responder 201 com `identifier` igual a `null`.  <!-- TUXV2-02 -->
4. WHEN `PATCH /transactions/:id` recebe `identifier` THEN a API SHALL ignorá-lo, responder 200 e devolver o `identifier` guardado sem alteração, inclusive quando outros campos mudam no mesmo corpo.  <!-- TUXV2-02 -->
5. The API SHALL isolar `identifier` por usuário com o mesmo RLS das transações.  <!-- TUXV2-02 -->
6. The `api/openapi.json` SHALL descrever `identifier` em `Transaction` e SHALL não descrevê-lo nos corpos do POST e do PATCH.  <!-- TUXV2-03 -->
7. The `Transaction` do web SHALL ter `identifier: string | null` e `TransactionInput` e `TransactionUpdate` SHALL não ter o campo.  <!-- TUXV2-04 -->
8. The mock de transações SHALL devolver `identifier` na leitura (com parte das linhas preenchida), criar com `null` e ignorar `identifier` no POST e no PATCH, como a API.  <!-- TUXV2-04 -->

**Independent Test**: Inserir uma linha com `identifier` direto no banco, listar e ver o texto; enviar PATCH com outro valor e ver o original.

---

### P1: Identificadores no modal de edição ⭐ MVP

**User Story**: Como usuário, quero ver o ID do banco e o identificador externo da transação no modal de edição e copiá-los, sem poder editá-los.

**Why P1**: Pedido direto do v2; ajuda a conferir o lançamento contra o extrato do banco.

**Acceptance Criteria**:

1. WHEN o modal de edição abre THEN o sistema SHALL mostrar o rótulo "ID" com o `id` da transação como texto.  <!-- TUXV2-05 -->
2. WHEN o modal de edição abre para uma transação com `identifier` THEN o sistema SHALL mostrar o rótulo "Identificador externo" com o texto exato do `identifier`.  <!-- TUXV2-05 -->
3. WHERE a transação não tem `identifier`, o modal SHALL mostrar "—" no lugar do valor e SHALL não renderizar o botão de copiar do identificador externo.  <!-- TUXV2-05 -->
4. The modal SHALL mostrar os dois valores como texto somente leitura, sem campo editável, e SHALL não enviar `id` nem `identifier` no corpo do PATCH.  <!-- TUXV2-05 -->
5. WHEN o formulário de criação abre THEN o sistema SHALL não mostrar o bloco de identificadores.  <!-- TUXV2-05 -->
6. WHEN o usuário aciona "Copiar ID" THEN o sistema SHALL escrever o `id` exato na área de transferência e exibir o toast "ID copiado".  <!-- TUXV2-06 -->
7. WHEN o usuário aciona "Copiar identificador externo" THEN o sistema SHALL escrever o `identifier` exato na área de transferência e exibir o toast "Identificador externo copiado".  <!-- TUXV2-06 -->
8. IF a área de transferência não está disponível ou rejeita a escrita THEN o sistema SHALL exibir o toast de erro "Não foi possível concluir a operação. Tente novamente." e manter o modal aberto.  <!-- TUXV2-06 -->

**Independent Test**: Abrir a edição de uma transação importada e ver os dois identificadores; abrir a de uma manual e ver "—" no externo.

---

### P1: Limpar cada filtro do extrato ⭐ MVP

**User Story**: Como usuário, quero tirar um filtro ativo do extrato sem perder os outros.

**Why P1**: Hoje só "Limpar filtros" existe, e refazer cinco filtros para mudar um é o atrito do pedido.

**Acceptance Criteria**:

1. WHILE a busca, o Tipo, a Conta, a Categoria ou a Neutra tem valor, o sistema SHALL mostrar o botão "Limpar filtro <rótulo>" desse filtro, e WHILE não tem valor SHALL não mostrá-lo.  <!-- TUXV2-09 -->
2. WHEN o usuário aciona "Limpar filtro Busca" THEN o sistema SHALL esvaziar o campo, consultar sem `q` e voltar à página 1, mantendo os demais filtros e a ordenação.  <!-- TUXV2-09 -->
3. WHEN o usuário aciona "Limpar filtro Tipo" THEN o sistema SHALL consultar sem `type` e voltar à página 1, mantendo os demais filtros e a ordenação.  <!-- TUXV2-09 -->
4. WHEN o usuário aciona "Limpar filtro Conta" THEN o sistema SHALL consultar sem `accountId` e voltar à página 1, mantendo os demais filtros e a ordenação.  <!-- TUXV2-09 -->
5. WHEN o usuário aciona "Limpar filtro Categoria" THEN o sistema SHALL consultar sem `categoryId` e voltar à página 1, mantendo os demais filtros e a ordenação.  <!-- TUXV2-09 -->
6. WHEN o usuário aciona "Limpar filtro Neutra" THEN o sistema SHALL consultar sem `neutral` e voltar à página 1, mantendo os demais filtros e a ordenação.  <!-- TUXV2-09 -->
7. WHILE De tem valor e o mês rápido não está ativo, o sistema SHALL mostrar "Limpar filtro De", e WHEN o usuário o aciona THEN o sistema SHALL consultar sem `from`, manter `to`, os demais filtros e a ordenação e voltar à página 1.  <!-- TUXV2-10 -->
8. WHILE Até tem valor e o mês rápido não está ativo, o sistema SHALL mostrar "Limpar filtro Até", e WHEN o usuário o aciona THEN o sistema SHALL consultar sem `to`, manter `from`, os demais filtros e a ordenação e voltar à página 1.  <!-- TUXV2-10 -->
9. WHILE o mês rápido está ativo, o sistema SHALL não mostrar "Limpar filtro De" nem "Limpar filtro Até".  <!-- TUXV2-10 -->
10. WHILE o mês e o ano do filtro rápido estão escolhidos, o sistema SHALL mostrar "Limpar filtro Mês rápido", e WHILE só um deles está escolhido SHALL não mostrá-lo.  <!-- TUXV2-11 -->
11. WHEN o usuário aciona "Limpar filtro Mês rápido" THEN o sistema SHALL desativar o filtro rápido, consultar sem `from` e sem `to`, habilitar De e Até vazios, manter os demais filtros e a ordenação e voltar à página 1.  <!-- TUXV2-11 -->

**Independent Test**: Aplicar Tipo, Conta e busca, ordenar por valor, limpar só o Tipo e ver a consulta com os outros dois e a mesma ordenação na página 1.

---

### P2: Toasts coloridos por tipo

**User Story**: Como usuário, quero distinguir de relance um toast de sucesso, de erro e de informação.

**Why P2**: Melhora de leitura; os toasts já funcionam.

**Acceptance Criteria**:

1. The `notify` SHALL expor `notifyInfo(message)`, que emite `toast.info`, além de `notifySuccess` e `notifyError`, e SHALL continuar sendo o único chamador de `toast`.  <!-- TUXV2-07 -->
2. WHEN um toast de sucesso é exibido THEN o sistema SHALL aplicar fundo e texto de matiz verde no tema claro e no escuro.  <!-- TUXV2-07 -->
3. WHEN um toast de erro é exibido THEN o sistema SHALL aplicar fundo e texto de matiz vermelho no tema claro e no escuro.  <!-- TUXV2-07 -->
4. WHEN um toast de informação é exibido THEN o sistema SHALL aplicar o fundo e o texto neutros do tema (`--background` e `--foreground`) no tema claro e no escuro.  <!-- TUXV2-07 -->
5. The sistema SHALL manter contraste de pelo menos 4,5:1 entre o texto e o fundo de cada tipo de toast (sucesso, erro e informação) nos temas claro e escuro, calculado a partir dos valores do tema.  <!-- TUXV2-08 -->
6. The `Toaster` SHALL continuar montado uma única vez no layout raiz.  <!-- TUXV2-08 -->

**Independent Test**: Renderizar o `Toaster`, emitir um toast de cada tipo pelo `notify` e conferir o tipo e as classes do elemento; rodar o teste de contraste.

---

### P2: Dia da semana abaixo da data

**User Story**: Como usuário, quero ver o dia da semana abaixo da data da transação para situá-la no tempo.

**Why P2**: Contexto temporal pedido no v2; sem ele o resto do extrato continua igual.

**Acceptance Criteria**:

1. WHEN uma transação tem `occurredAt` válido THEN o sistema SHALL calcular o dia da semana da data local do navegador e abreviá-lo como "Dom", "Seg", "Ter", "Qua", "Qui", "Sex" ou "Sáb".  <!-- TUXV2-12 -->
2. WHEN `occurredAt` cai às 23:30 locais em America/Sao_Paulo (já no dia seguinte em UTC) THEN o dia da semana SHALL ser o do dia local, o mesmo da data exibida, e não o do dia UTC.  <!-- TUXV2-12 -->
3. WHEN o fuso do navegador é UTC THEN o dia da semana SHALL ser o do dia UTC do instante.  <!-- TUXV2-12 -->
4. WHEN a data local é o último dia de um mês e o primeiro do mês seguinte, ou 31 de dezembro e 1º de janeiro, THEN o dia da semana SHALL avançar um dia em cada virada.  <!-- TUXV2-12 -->
5. WHEN a data local é 29 de fevereiro de um ano bissexto THEN o dia da semana SHALL ser o desse dia e o 1º de março seguinte SHALL ser o dia seguinte.  <!-- TUXV2-12 -->
6. WHEN `occurredAt` é meia-noite UTC e o fuso é America/Sao_Paulo THEN o dia da semana SHALL ser o do dia local anterior, o mesmo da data exibida.  <!-- TUXV2-12 -->
7. IF `occurredAt` não é um instante válido THEN o sistema SHALL devolver texto vazio e não renderizar o dia da semana.  <!-- TUXV2-12 -->
8. WHEN o extrato mostra uma transação na tabela THEN a célula da data SHALL mostrar o dia da semana abreviado em uma segunda linha, abaixo da data.  <!-- TUXV2-13 -->
9. WHEN o extrato mostra uma transação no cartão móvel THEN o cartão SHALL mostrar o dia da semana abreviado abaixo da data.  <!-- TUXV2-13 -->
10. The dia da semana SHALL ter fonte menor (`text-xs`) e cor mais clara (`text-muted-foreground`) que a data, e a data SHALL não ter essas duas classes.  <!-- TUXV2-13 -->

**Independent Test**: Com o fuso em America/Sao_Paulo, uma transação de 5 de outubro de 2026 às 23:30 mostra "05/10/2026" e "Seg" na tabela e no cartão.

---

## Edge Cases

- IF `identifier` chega no POST como número, objeto ou texto THEN a API SHALL ignorá-lo do mesmo modo e criar com `identifier` nulo.
- IF `identifier` tem espaços nas pontas na linha guardada THEN a API SHALL devolvê-lo sem aparar.
- WHEN o modal de edição é fechado e reaberto para outra transação THEN o bloco SHALL mostrar os identificadores da nova transação.
- WHEN o último filtro ativo é limpo THEN o sistema SHALL consultar com os filtros base (`sort`, `order`, `page=1`) e SHALL remover todos os botões "Limpar filtro".
- IF o período De/Até está invertido THEN limpar De ou Até SHALL remover o alerta "A data inicial deve ser anterior à final".
- WHEN a busca é limpa pelo "x" THEN o sistema SHALL não consultar uma segunda vez 300 ms depois.
- WHEN o usuário está na página 2 e limpa um filtro THEN a consulta SHALL ir para a página 1.
- WHEN o toast de sucesso aparece com o `.dark` ativo no documento THEN o sistema SHALL usar as classes do tema escuro.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| TUXV2-01 | P1: Identificadores da transação na API e nos mocks | In Tasks | Verified |
| TUXV2-02 | P1: Identificadores da transação na API e nos mocks | In Tasks | Verified |
| TUXV2-03 | P1: Identificadores da transação na API e nos mocks | In Tasks | Verified |
| TUXV2-04 | P1: Identificadores da transação na API e nos mocks | In Tasks | Verified |
| TUXV2-05 | P1: Identificadores no modal de edição | In Tasks | Verified |
| TUXV2-06 | P1: Identificadores no modal de edição | In Tasks | Verified |
| TUXV2-07 | P2: Toasts coloridos por tipo | In Tasks | Verified |
| TUXV2-08 | P2: Toasts coloridos por tipo | In Tasks | Verified |
| TUXV2-09 | P1: Limpar cada filtro do extrato | In Tasks | Verified |
| TUXV2-10 | P1: Limpar cada filtro do extrato | In Tasks | Verified |
| TUXV2-11 | P1: Limpar cada filtro do extrato | In Tasks | Verified |
| TUXV2-12 | P2: Dia da semana abaixo da data | In Tasks | Verified |
| TUXV2-13 | P2: Dia da semana abaixo da data | In Tasks | Verified |

**Coverage:** 13 total, 13 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] `GET /transactions` devolve `identifier` e nenhuma rota o aceita para escrita, verificado por teste de integração e pelo `openapi.json`.
- [x] O modal de edição mostra "ID" e "Identificador externo" (ou "—") com botão de copiar, e nenhum campo editável para eles.
- [x] Os três tipos de toast têm cores distintas nos dois temas, com contraste de texto de pelo menos 4,5:1 calculado dos valores do tema.
- [x] Cada um dos oito filtros ativos tem um "x" que limpa só ele, com um teste por filtro, e a ordenação e os demais filtros permanecem.
- [x] O dia da semana abaixo da data está certo às 23:30 locais em America/Sao_Paulo e em UTC, nas viradas de mês e de ano e em 29 de fevereiro.
- [x] `pnpm -C api test`, `yarn --cwd web test`, typecheck e lint de cada app passam, sem aviso novo de lint.
- [ ] No navegador, contra a API local: copiar os identificadores no modal, ver as cores dos toasts nos dois temas, limpar cada filtro e ver o dia da semana (conferência do dono, sem sessão dos agentes).
