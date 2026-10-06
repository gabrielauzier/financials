# Import: melhorias do preview e arquivos importados (import-improvements) Specification

Origem: `docs/v1/plano-implementacao.md` (F3, itens I1 a I5) e `docs/v1/bugs-e-melhorias.md` (seção Importação e respostas do Q&A: "Reimportar: adicionar os botões de reimportação ... e download"). Escopo: `api/src/modules/import/`, `api/openapi.json`, `web/src/features/import/`, `web/src/lib/api/` (tipos, cliente, mocks e mensagens). As tabelas `import_batches` e `attachments` e o bucket privado `imports` (migration `0004`) já existem e são consumidos aqui, sem alteração.

## Problem Statement

Hoje o usuário só vê o preview do import como uma tabela rígida: a categoria de cada linha vem da regra do parser e não pode ser trocada antes de confirmar, não há "selecionar todas" (inclusive para reaproveitar um arquivo cujas linhas viram todas duplicadas), a coluna "Tipo" ocupa espaço e o Valor aparece sem cor, e confirmar com duplicadas selecionadas importa sem aviso. Além disso o arquivo enviado fica guardado no Storage, mas o usuário não tem como ver os arquivos já importados, baixá-los ou usá-los para reimportar, e a API não oferece rota para isso.

## Goals

- [ ] O confirm aceita `categoryId` opcional por linha, validado como categoria do usuário, e o preview devolve a categoria efetiva de cada linha; o preview da tela tem um select de categoria por linha.
- [ ] O preview tem "selecionar todas" com estado indeterminado, mostra Valor verde (receita) e vermelho (despesa) sem a coluna "Tipo", e pede confirmação quando há duplicadas selecionadas.
- [ ] `GET /imports` e `GET /imports/:id/file` existem, são isoladas por usuário (RLS) e nunca expõem o caminho do Storage.
- [ ] A tela de importação lista "Arquivos importados" com os botões "Reimportar" (leva o arquivo ao preview normal, na conta certa) e "Baixar".
- [ ] `api/openapi.json` regenerado e mocks e tipos do `web/` acompanham as rotas e os campos novos.

## Out of Scope

Explicitamente excluído para evitar crescimento de escopo.

| Feature | Reason |
| ------- | ------ |
| Badges coloridos de categoria e ícones de banco no preview | Pertencem à feature colors-and-icons (F4); aqui o select usa só o nome e o item fica isolado para troca |
| Aplicar uma categoria a várias linhas de uma vez no preview | Não pedido; a escolha é por linha |
| Criar ou editar categorias dentro do preview | A tela de categorias já cobre; o select só lista as existentes |
| Confirm "por id de lote" no servidor | A reimportação reaproveita o confirm multipart existente (um único caminho de confirm) |
| Escolher outra conta ao reimportar | A reimportação usa a conta do lote original |
| Excluir arquivo, lote ou transações importadas | Não pedido; apagar dados é decisão de outra feature |
| Paginação com cursor ou total na lista de arquivos | A lista é limitada (`limit`, padrão 50); volume por usuário é pequeno |
| Filtros e busca na lista de arquivos | Não pedido |
| Prévia do conteúdo do arquivo na lista | Não pedido; só nome, conta, data e contagens |
| Reimportar sem confirmar duplicadas ou pular a deduplicação | A deduplicação e o modal de duplicadas valem igual na reimportação |
| Backfill de `attachments` ou lotes antigos | Todo lote já nasce com anexo desde a feature import |
| Nova migration | Os campos necessários já existem (justificativa na Assumptions) |
| Rota `POST /imports/:id/preview` (preview de lote guardado) | Descartada: a reimportação baixa o arquivo e reaproveita o preview e o confirm normais, então nenhuma tela chamaria a rota |
| Mostrar `description` no preview | Continua fora do preview (decisão da import-fixes) |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida ou registrada aqui.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Forma do item do confirm | `selections` vira `[{ "index": number, "neutral": boolean, "categoryId"?: string }]`; `categoryId` ausente significa "usar a categoria do parser"; `categoryId` presente precisa ser uma string no formato UUID (maiúsculas ou minúsculas), senão 422 `validation_error` no campo `selections`; `null`, número, objeto e string vazia contam como inválidos | Contrato aditivo: clientes antigos (sem `categoryId`) seguem funcionando; sem ambiguidade entre "ausente" e "nulo" | n |
| Erro de categoria desconhecida | `categoryId` bem formado que não é uma categoria visível ao usuário (inexistente ou de outro usuário, o RLS esconde as dele) responde 422 `invalid_category`, campo `selections`, mensagem `Row N has a category that does not exist` (N é o `index` da linha); nada é gravado (sem lote, sem transações, sem objeto no Storage) | O 422 do import já usa o campo `selections` e `index` na mensagem (`invalid_selection`); L-006: status único 422 para dado de campo inválido | n |
| Quais categorias valem | Qualquer categoria do usuário, de sistema ou própria; o catálogo não tem estado inativo | `categories` não tem coluna `active`; a regra é só pertencer ao usuário | n |
| Quando a categoria é validada | Na mesma transação `withUser` que reanalisa o arquivo, antes de abrir o upload ao Storage; uma única consulta `id = any(...)` para todas as linhas | A falha não deixa objeto órfão e custa uma consulta | n |
| Repetição do confirm (idempotência) | Regra existente mantida: chave já confirmada devolve o resumo do primeiro confirm (HTTP 200) sem gravar nem reavaliar propriedade de categoria; o formato das `selections` ainda é validado antes, como hoje | Fluxo atual do `routes.ts`; não muda o comportamento de retry | n |
| Categoria do preview | Cada linha do preview ganha `categoryId` (UUID da categoria do usuário que corresponde à chave do parser) além de `categoryName`; vale também para linhas `ignored` e `invalid` | A tela precisa do id para pré-selecionar o select e enviar de volta; o nome continua para linhas não selecionáveis | n |
| Neutras e categoria | `neutral` e `categoryId` são independentes: a linha neutra é gravada com a categoria escolhida (ou a do parser) e `neutral` como enviado; as agregações já excluem neutras | "Manter como hoje": nenhuma regra de neutra muda | n |
| Quando o front envia categoria | O front envia `categoryId` em todo item (a categoria efetiva da linha: a escolhida ou a do preview) | A escolha do usuário e o padrão seguem o mesmo caminho; a API continua aceitando ausência | n |
| Select por linha | Reutiliza `CategorySelect` (shadcn Select) com as categorias de `useCategories`, uma só consulta compartilhada pela tabela; rótulo de acessibilidade `Categoria de <nome da linha>`; o conteúdo do item vive em um componente único `CategoryOptionLabel` que hoje renderiza só o nome | Pedido: "select simples com os nomes, fácil de trocar" pelo badge colorido da F4 | n |
| Linhas sem select | Linhas `ignored` e `invalid` mostram o `categoryName` como texto; o select só existe nas linhas selecionáveis (`new`, `duplicate`, `unrecognized`) | Essas linhas nunca são importadas | n |
| Falha ao carregar categorias | WHILE carregando o select fica desabilitado com o texto "Carregando categorias…"; se a consulta falhar, a coluna mostra o `categoryName` em texto e o confirm segue com os `categoryId` do preview | A importação não pode depender da lista de categorias | n |
| Selecionar todas | Checkbox no cabeçalho da coluna "Selecionar": marcado quando todas as linhas selecionáveis estão selecionadas, indeterminado quando só parte, desmarcado quando nenhuma; clique em marcado desmarca todas as selecionáveis; clique em desmarcado ou indeterminado seleciona todas as selecionáveis; sem linhas selecionáveis fica desabilitado; rótulo `Selecionar todas as linhas` | "Desmarcar limpa" e estado indeterminado, como no plano; indeterminado leva a "todas" (padrão de checkbox tri-estado) | n |
| Efeito do selecionar todas | Só muda `selected`; `neutral` e categoria de cada linha ficam como estão; a seleção inicial do preview não muda (novas e não reconhecidas marcadas, duplicadas desmarcadas) | "Manter as regras de seleção padrão" | n |
| Valor no preview | Remove a coluna "Tipo" e a célula correspondente; o Valor segue o extrato: receita `formatBRL(valor)` com `text-emerald-700 dark:text-emerald-400`, despesa `-formatBRL(valor)` com `text-destructive`, ambos `font-semibold whitespace-nowrap`; o preview não tem cartão mobile (a tabela rola), então nada a mudar nesse ponto | Reaproveita as classes de `TransactionsPage.tsx`; o sinal "-" garante o tipo sem depender só da cor | n |
| Helper de valor compartilhado | `amountClassName(type)` e `formatSignedAmount(type, amount)` em `web/src/features/transactions/utils.ts`; o extrato (tabela e cartão) e o preview os usam; o `amount` do preview pode vir com ou sem sinal e o helper normaliza (despesa sempre com um único "-") | Evita copiar as classes; AD-004: o valor segue string decimal, sem `number` | n |
| Quais duplicadas contam no aviso | O modal conta as linhas com status `duplicate` que estão selecionadas no momento do clique; linhas `new` e `unrecognized` não contam | "Pelo menos uma linha duplicada selecionada" | n |
| Texto e ações do modal | `AlertDialog` com título "Importar linhas duplicadas?", descrição "{N} linha(s) selecionada(s) já {foi/foram} importada(s) antes. Importar mesmo assim cria transações repetidas.", ações "Importar mesmo assim" e "Voltar"; fechar com Esc ou "Voltar" mantém a seleção e não envia nada | Pedido do plano (I4) com o texto em português definido | n |
| Dupla ação no modal | O botão "Confirmar importação" fica desabilitado enquanto a confirmação roda; "Importar mesmo assim" dispara o confirm uma vez, fecha o modal e o botão principal já está desabilitado; a chave de idempotência é a mesma de hoje (renovada só quando uma nova prévia é gerada) | Duplo clique não importa duas vezes e o retry segue idempotente | n |
| "Tentar novamente" após falha | O retry do alerta de falha chama o confirm direto, sem reabrir o modal, porque a falha veio depois do consentimento; se o usuário mudar a seleção e clicar em "Confirmar importação", o modal é avaliado de novo | Não pede a mesma confirmação duas vezes para a mesma tentativa | n |
| Sem migration | Nenhuma migration: `import_batches` (arquivo da lista: `row_count`, `imported_count`, `skipped_count`, `bank`, `created_at`, `account_id`) e `attachments` (`filename`, `mime_type`, `size_bytes`, `storage_path`) já têm tudo; o apelido da conta vem do join com `accounts`; a lista ordena por `created_at` sem índice novo (poucas linhas por usuário, `limit` 100 no máximo) | Os campos pedidos existem; um índice não se paga com esse volume | n |
| Formato da lista | `GET /imports` devolve um array JSON (como `GET /accounts`) de `{ id, filename, mimeType, sizeBytes, bank, account: { id, nickname }, createdAt, rowCount, importedCount, skippedCount }`, do mais novo para o mais antigo (`created_at desc`, desempate `id desc`) | Mesma forma de lista das contas; campos do plano | n |
| Limite da lista | Query `limit` inteiro de 1 a 100, padrão 50; valor fora da faixa ou não inteiro responde 400 `validation_error` (validação do schema, como as outras rotas de listagem); sem cursor | Decisão do plano: "paginação ou limite"; 50 cobre meses de uso | n |
| Lote sem anexo | O join com `attachments` é interno: um lote sem anexo não aparece na lista (não é reimportável); o confirm grava lote e anexo na mesma transação, então não ocorre; com mais de um anexo vale o mais antigo | Evita item sem arquivo para baixar | n |
| Nome do arquivo na lista | `attachments.filename` como enviado no upload (não o nome saneado do caminho do Storage); `account.nickname` da conta atual do lote, mesmo se a conta foi inativada | O nome original é o que o usuário reconhece; conta inativa continua nomeada | n |
| Download | `GET /imports/:id/file` lê o objeto do bucket `imports` com o token do próprio usuário (as policies de Storage valem) e responde 200 com os bytes em memória (no máximo 5 MB), `Content-Type` igual ao `mime_type` guardado (se não for do formato `tipo/subtipo`, `application/octet-stream`), `Content-Disposition: attachment; filename="<ASCII>"; filename*=UTF-8''<percent-encoded>` com o nome original (aspas, barras, controle e CR/LF removidos do fallback), `Cache-Control: private, no-store` e `X-Content-Type-Options: nosniff` | Cabeçalho seguro contra injeção; sem streaming porque o arquivo é limitado a 5 MB | n |
| Id inválido ou de outro usuário | `:id` que não é UUID, lote inexistente ou de outro usuário respondem 404 `not_found` com a mesma resposta (o RLS esconde o lote de B); a rota não consulta o Storage nesses casos | Não vazar existência de lote alheio | n |
| Objeto ausente no Storage | O Storage responde 400 (corpo `statusCode: "404"`) ou 404 para objeto inexistente ou fora da policy; os dois viram 404 `not_found`; qualquer outra falha (5xx, 401, 403, rede, timeout de 30 s) vira 502 `storage_error` sem URL, token nem caminho na mensagem | O helper já trata o 400 do Storage como erro de política; a rota distingue "sumiu" de "indisponível" | n |
| Storage não configurado | Sem `publishableKey`, a rota `GET /imports/:id/file` responde 503 `storage_not_configured` (verificado depois da autenticação e antes da consulta ao lote); `GET /imports` não usa o Storage e funciona | Mesmo comportamento do confirm; a lista só lê o banco | n |
| Preview de lote | Não existe rota `POST /imports/:id/preview`: a reimportação usa o preview normal (`POST /imports/preview`) com o arquivo baixado; nenhuma rota de preview lê o Storage | O front reaproveita o caminho normal; uma rota sem consumidor seria código morto (decisão do orquestrador) | n |
| Duplicatas na reimportação | Pelas regras de sempre do `classify`: como o import anterior já gravou os identificadores na conta, as linhas importadas voltam `duplicate` no preview normal (por `identifier`; sem identificador, por nome, dia, valor e tipo); linhas ignoradas no import original continuam `new` ou `ignored` | Reuso integral do `classify`; sem regra nova | n |
| Conta inativa ou removida na reimportação | O preview normal responde 422 `invalid_account` (campo `accountId`); no front, o formulário mostra "Selecione uma conta ativa" | Uma regra só para conta | n |
| Como a reimportação confirma | O front baixa o arquivo por `GET /imports/:id/file` como `Blob`, monta um `File` com o nome e o tipo originais e usa o caminho normal: `POST /imports/preview` e depois `POST /imports/confirm` com a conta do lote | Um único caminho de confirm e de preview (o confirm relê o arquivo da própria requisição, nunca do Storage); a segunda origem de arquivo era o risco do plano | n |
| Cada reimportação gera um lote novo | O confirm cria novo lote, nova chave de idempotência (renovada ao gerar a prévia) e novo objeto no Storage; o arquivo guardado do lote antigo não é alterado | Reaproveita o confirm sem mudar a regra de idempotência; o custo é um objeto extra por reimportação | n |
| Atualização da lista | A lista é uma consulta `["imports"]` do react-query; o confirm com sucesso a invalida; a lista aparece só no passo "Conta e arquivo" | O novo lote aparece ao voltar ao início | n |
| Download no navegador | `fetch` autenticado (token da sessão, mesmo cliente de `apiRequest`) devolve `Blob`; o front cria uma URL de objeto, aciona um `<a download="<nome original>">` e revoga a URL; nunca navega para a URL do Storage | O token não pode ir em query string (Privacy); o caminho do Storage nunca chega ao front | n |
| Data na lista | `createdAt` exibido como `dd/mm/aaaa` no fuso do navegador com `formatDateLocal`; contagens como "N importadas · M ignoradas" com singular e plural | Mesmo formato de data do extrato | n |
| Estados da lista | Carregando: 3 linhas de `Skeleton`; vazia: "Nenhum arquivo importado ainda."; erro: alerta com `messageForError(error, "import")` e botão "Tentar novamente" | Pedido: estados vazio, erro e skeleton | n |
| Erros por ação | Falha de download ou de leitura do arquivo na reimportação aparece em um alerta da lista (`role="alert"`) com `messageForError(error, "import")`; falha do preview da reimportação aparece no formulário do passo inicial (a conta e o arquivo já ficam preenchidos) | Cada erro aparece perto da ação que o causou | n |
| Mensagens novas | `storage_error`: "Não foi possível acessar o arquivo guardado. Tente novamente."; `storage_not_configured`: "O armazenamento de arquivos não está disponível no momento."; `invalid_category` no `importErrorMessage`: "Há linhas com categoria inválida. Gere a prévia de novo." | Nenhum código novo pode cair na mensagem genérica (L-013) | n |
| Mocks do front | `web/src/lib/api/mock/import.ts` ganha handlers em memória para `GET /imports` (2 lotes semente), `GET /imports/:id/file` (um `Blob` CSV), `POST /imports/preview` e `POST /imports/confirm` (cria lote novo na lista); a chave `import` de `pathAreaMap` vira `imports` porque o caminho real é `/imports/...` | Hoje os handlers de import são vazios e a chave não casa com o caminho; os testes não podem mascarar divergência (risco do plano) | n |
| Observabilidade | Falhas do Storage nas novas rotas passam pelo `storageError` (só operação e status HTTP na mensagem); o log de erro não leva URL, token nem caminho; as rotas novas só leem, sem efeito colateral | Nenhum segredo ou caminho em log ou resposta | n |
| Concorrência | As rotas novas são só leitura; duplo clique em "Reimportar" ou "Baixar" é evitado desabilitando o botão da linha enquanto a requisição roda; reconfirmar segue idempotente pela chave | Sem estado compartilhado novo | n |
| Limites e rate limit | Tamanho do arquivo continua 5 MB (já limitado no upload); a API não tem rate limit hoje e esta feature não o introduz | Sem rate limit no projeto; fora do escopo | n |
| Cadeia de consentimento | O modal de duplicadas só aparece em "Confirmar importação" (e nunca no preview nem na lista); "Reimportar" não pede confirmação extra porque só gera a prévia | O gatilho é o clique que grava dados | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Categoria por linha na API ⭐ MVP

**User Story**: Como usuário, quero que o confirm aceite a categoria que escolhi para cada linha, e que o preview diga qual é a categoria padrão de cada uma, para importar já categorizado.

**Why P1**: Sem o contrato na API o select do preview não tem o que enviar; a validação de propriedade impede gravar com a categoria de outro usuário.

**Acceptance Criteria** (each line is one EARS pattern):

1. The preview SHALL incluir em cada linha o `categoryId` da categoria do usuário que corresponde à chave do parser, junto do `categoryName`.  <!-- IMPIMP-02 -->
2. WHEN um item de `selections` traz `categoryId` de uma categoria do usuário THEN o confirm SHALL gravar a transação dessa linha com essa categoria no lugar da categoria do parser.  <!-- IMPIMP-01 -->
3. WHEN um item de `selections` não traz `categoryId` THEN o confirm SHALL gravar a transação com a categoria do parser, como hoje.  <!-- IMPIMP-01 -->
4. IF o `categoryId` de um item é um UUID que não é uma categoria visível ao usuário (inexistente ou de outro usuário) THEN o confirm SHALL responder 422 `invalid_category` no campo `selections`, com o `index` da linha na mensagem, sem gravar lote, transações nem objeto no Storage.  <!-- IMPIMP-01 -->
5. IF o `categoryId` de um item não é uma string no formato UUID (inclui `null`, número, objeto e string vazia) THEN o confirm SHALL responder 422 `validation_error` no campo `selections`, sem gravar nada.  <!-- IMPIMP-01 -->
6. WHEN o confirm grava uma linha com `neutral: true` e uma categoria escolhida THEN o sistema SHALL gravar `neutral = true` e essa categoria.  <!-- IMPIMP-01 -->
7. WHEN duas linhas da mesma requisição trazem categorias diferentes THEN o confirm SHALL gravar cada transação com a categoria da própria linha.  <!-- IMPIMP-01 -->

**Independent Test**: Preview de um arquivo, confirm de duas linhas com categorias próprias diferentes, e `GET /transactions` mostrando cada categoria; confirm com o id de categoria de outro usuário responde 422 e não grava nada.

---

### P1: Categoria por linha no preview ⭐ MVP

**User Story**: Como usuário, quero escolher a categoria de cada linha na própria tabela do preview, para não corrigir uma por uma no extrato depois.

**Why P1**: É o pedido principal de melhoria da tela de preview.

**Acceptance Criteria**:

1. WHEN o preview é exibido THEN a coluna "Categoria" de cada linha `new`, `duplicate` ou `unrecognized` SHALL mostrar um select com os nomes das categorias do usuário, pré-selecionado na categoria `categoryId` da linha.  <!-- IMPIMP-03 -->
2. WHEN a linha é `ignored` ou `invalid` THEN a coluna "Categoria" SHALL mostrar o `categoryName` como texto, sem select.  <!-- IMPIMP-03 -->
3. WHEN o usuário escolhe outra categoria em uma linha THEN a tela SHALL guardar a escolha só para essa linha, sem alterar a seleção, a chave "Neutra" nem as outras linhas.  <!-- IMPIMP-03 -->
4. WHEN o usuário confirma THEN o front SHALL enviar, para cada linha selecionada, `{ index, neutral, categoryId }` com a categoria efetiva da linha (a escolhida ou a do preview).  <!-- IMPIMP-03 -->
5. WHILE as categorias estão carregando THEN o select SHALL ficar desabilitado com o texto "Carregando categorias…".  <!-- IMPIMP-03 -->
6. IF a consulta das categorias falha THEN a coluna SHALL mostrar o `categoryName` em texto e o confirm SHALL enviar os `categoryId` do preview.  <!-- IMPIMP-03 -->
7. The conteúdo de cada item do select SHALL ser renderizado por um único componente `CategoryOptionLabel`, de modo que a F4 troque o texto pelo badge sem alterar a tabela do preview.  <!-- IMPIMP-03 -->

**Independent Test**: Gerar a prévia, trocar a categoria de uma linha, confirmar e ver essa categoria na transação importada no extrato.

---

### P2: Selecionar todas as linhas

**User Story**: Como usuário, quero um checkbox no cabeçalho do preview que seleciona todas as linhas selecionáveis, para importar ou reimportar um arquivo inteiro sem marcar linha por linha.

**Why P2**: Melhora a usabilidade; o preview funciona sem ele.

**Acceptance Criteria**:

1. The cabeçalho da coluna "Selecionar" SHALL conter um checkbox com o rótulo "Selecionar todas as linhas".  <!-- IMPIMP-04 -->
2. WHEN o usuário o marca THEN a tela SHALL selecionar todas as linhas `new`, `duplicate` e `unrecognized`, e SHALL NOT selecionar linhas `ignored` nem `invalid`.  <!-- IMPIMP-04 -->
3. WHILE todas as linhas selecionáveis estão selecionadas THEN o checkbox SHALL aparecer marcado; WHILE apenas parte delas está selecionada THEN SHALL aparecer indeterminado; WHILE nenhuma está THEN SHALL aparecer desmarcado.  <!-- IMPIMP-04 -->
4. WHEN o usuário clica no checkbox marcado THEN a tela SHALL desmarcar todas as linhas selecionáveis.  <!-- IMPIMP-04 -->
5. WHEN o usuário clica no checkbox indeterminado THEN a tela SHALL selecionar todas as linhas selecionáveis.  <!-- IMPIMP-04 -->
6. WHEN o usuário usa o checkbox do cabeçalho THEN a tela SHALL manter inalterados a chave "Neutra" e a categoria de cada linha, e o contador "N linhas selecionadas" SHALL refletir a nova seleção.  <!-- IMPIMP-04 -->
7. WHEN o preview é gerado THEN a seleção inicial SHALL ser a de hoje (linhas `new` e `unrecognized` marcadas, `duplicate` desmarcadas).  <!-- IMPIMP-04 -->
8. IF o preview não tem linhas selecionáveis THEN o checkbox do cabeçalho SHALL ficar desabilitado e desmarcado.  <!-- IMPIMP-04 -->

**Independent Test**: Gerar a prévia de um arquivo com linhas novas, duplicadas e ignoradas, marcar o cabeçalho e ver o contador igual às selecionáveis; desmarcar e ver zero.

---

### P2: Preview com Valor colorido e sem a coluna Tipo

**User Story**: Como usuário, quero ver o Valor verde para receita e vermelho para despesa no preview, como no extrato, sem a coluna "Tipo".

**Why P2**: Consistência visual com o extrato e mais espaço na tabela.

**Acceptance Criteria**:

1. The tabela do preview SHALL NOT ter a coluna "Tipo" (cabeçalho e células).  <!-- IMPIMP-05 -->
2. WHEN a linha é uma receita THEN a tabela SHALL exibir o Valor em verde, sem sinal, com as classes do extrato para receita.  <!-- IMPIMP-05 -->
3. WHEN a linha é uma despesa THEN a tabela SHALL exibir o Valor em vermelho com um único sinal "-", com as classes do extrato para despesa, esteja o `amount` do preview com ou sem sinal.  <!-- IMPIMP-05 -->
4. The extrato (tabela e cartão) e o preview SHALL obter a classe e o texto do valor da mesma função, sem mudança visual no extrato.  <!-- IMPIMP-05 -->

**Independent Test**: Gerar a prévia de um arquivo com receita e despesa e comparar as cores com o extrato.

---

### P2: Confirmação de duplicadas

**User Story**: Como usuário, quero um aviso antes de importar linhas que já foram importadas, para não duplicar transações sem querer.

**Why P2**: Evita erro caro de desfazer; o import funciona sem o aviso.

**Acceptance Criteria**:

1. WHEN o usuário clica em "Confirmar importação" com ao menos uma linha `duplicate` selecionada THEN a tela SHALL abrir um diálogo com a quantidade de duplicadas selecionadas e as ações "Importar mesmo assim" e "Voltar", sem enviar o confirm.  <!-- IMPIMP-06 -->
2. WHEN o usuário clica em "Confirmar importação" sem nenhuma linha `duplicate` selecionada THEN a tela SHALL enviar o confirm direto, sem diálogo.  <!-- IMPIMP-06 -->
3. WHEN o usuário clica em "Importar mesmo assim" THEN a tela SHALL enviar o confirm uma vez, com as mesmas seleções e a mesma chave de idempotência da sessão.  <!-- IMPIMP-06 -->
4. WHEN o usuário clica em "Voltar" ou fecha o diálogo com Esc THEN a tela SHALL fechar o diálogo, manter a seleção, as categorias e as chaves "Neutra" e não enviar nada.  <!-- IMPIMP-06 -->
5. WHILE a confirmação está em andamento THEN o botão "Confirmar importação" SHALL ficar desabilitado e SHALL NOT abrir o diálogo de novo.  <!-- IMPIMP-06 -->
6. The diálogo SHALL mostrar a contagem no singular ("1 linha selecionada já foi importada antes") e no plural ("N linhas selecionadas já foram importadas antes").  <!-- IMPIMP-06 -->
7. WHEN o usuário usa "Tentar novamente" depois de uma falha do confirm THEN a tela SHALL reenviar o confirm com a mesma chave sem reabrir o diálogo.  <!-- IMPIMP-06 -->

**Independent Test**: Preview de um arquivo já importado, marcar uma duplicada, clicar em "Confirmar importação" e ver o diálogo com a contagem; "Voltar" mantém a seleção.

---

### P1: Lista de arquivos importados (API) ⭐ MVP

**User Story**: Como usuário, quero a lista dos meus arquivos importados, para saber o que já entrou e de qual conta.

**Why P1**: Base de toda a reimportação e do download.

**Acceptance Criteria**:

1. WHEN o usuário autenticado chama `GET /imports` THEN a API SHALL responder 200 com um array dos seus lotes do mais novo para o mais antigo, cada item com `id`, `filename`, `mimeType`, `sizeBytes`, `bank`, `account: { id, nickname }`, `createdAt`, `rowCount`, `importedCount` e `skippedCount`.  <!-- IMPIMP-07 -->
2. WHEN o usuário não tem lotes THEN a API SHALL responder 200 com `[]`.  <!-- IMPIMP-07 -->
3. WHEN `limit` não é informado THEN a API SHALL devolver no máximo 50 itens; WHEN `limit` está entre 1 e 100 THEN SHALL devolver no máximo esse número.  <!-- IMPIMP-07 -->
4. IF `limit` é menor que 1, maior que 100 ou não inteiro THEN a API SHALL responder 400 `validation_error`.  <!-- IMPIMP-07 -->
5. The resposta SHALL NOT conter o caminho do objeto no Storage (`storage_path`), o `user_id` nem o `idempotency_key`.  <!-- IMPIMP-07 -->
6. WHEN dois lotes têm o mesmo `created_at` THEN a API SHALL ordená-los por `id` decrescente, de forma estável entre chamadas.  <!-- IMPIMP-07 -->

**Independent Test**: Confirmar dois imports e ver os dois lotes na ordem, com as contagens do resumo do confirm.

---

### P1: Download do arquivo importado (API) ⭐ MVP

**User Story**: Como usuário, quero baixar o arquivo exatamente como enviei.

**Why P1**: Pedido explícito do Q&A.

**Acceptance Criteria**:

1. WHEN o usuário autenticado chama `GET /imports/:id/file` de um lote seu THEN a API SHALL ler o objeto do Storage com o token do usuário e responder 200 com os bytes idênticos aos enviados, `Content-Type` igual ao `mime_type` guardado e `Content-Disposition: attachment` com o nome original do arquivo.  <!-- IMPIMP-08 -->
2. WHEN o nome original tem acentos, aspas ou quebras de linha THEN o `Content-Disposition` SHALL ter o `filename` ASCII sem aspas, barras nem controle e o `filename*` UTF-8 com percent-encoding, e a resposta SHALL ser válida.  <!-- IMPIMP-08 -->
3. IF `:id` não é UUID, o lote não existe ou é de outro usuário THEN a API SHALL responder 404 `not_found`, com a mesma resposta nos três casos, sem consultar o Storage.  <!-- IMPIMP-08 -->
4. IF o objeto não existe mais no Storage THEN a API SHALL responder 404 `not_found`.  <!-- IMPIMP-08 -->
5. IF o Storage está inacessível ou responde com erro que não seja objeto ausente THEN a API SHALL responder 502 `storage_error` sem URL, token nem caminho na mensagem.  <!-- IMPIMP-08 -->
6. IF a API está sem `publishableKey` THEN `GET /imports/:id/file` SHALL responder 503 `storage_not_configured`.  <!-- IMPIMP-08 -->
7. The resposta SHALL NOT conter o caminho do objeto, a URL do Storage nem a chave do projeto, em corpo ou cabeçalho.  <!-- IMPIMP-08 -->

**Independent Test**: Confirmar um import e baixar por `GET /imports/:id/file` obtendo o mesmo CSV; apagar o objeto e ver 404.

---

### P1: Preview único para upload e reimportação ⭐ MVP

**User Story**: Como usuário, quero que a reimportação gere o preview pelo mesmo caminho do upload, com as linhas já importadas marcadas como duplicadas.

**Why P1**: É a base da reimportação; uma só implementação de análise evita divergência entre as duas origens do arquivo.

**Acceptance Criteria**:

1. The preview do upload SHALL ser gerado por uma única implementação de análise e montagem (`analyze` e `toPreview` em módulo próprio), sem mudança na resposta nem no OpenAPI.  <!-- IMPIMP-09 -->
2. WHEN o arquivo baixado por `GET /imports/:id/file` é enviado a `POST /imports/preview` na conta do lote THEN o preview SHALL marcar como `duplicate` todas as linhas importadas antes e o contador de linhas SHALL ser o do arquivo.  <!-- IMPIMP-09 -->

**Independent Test**: Confirmar um import, baixar o arquivo por `GET /imports/:id/file` e enviá-lo a `POST /imports/preview` na mesma conta: todas as linhas importadas voltam `duplicate`.

---

### P1: Isolamento e autenticação das rotas de arquivos ⭐ MVP

**User Story**: Como usuário, quero que ninguém veja, baixe ou reimporte os meus arquivos.

**Why P1**: São dados financeiros e arquivos privados; o RLS precisa valer nas duas rotas novas.

**Acceptance Criteria**:

1. IF a requisição a `GET /imports` ou `GET /imports/:id/file` não tem token válido THEN a API SHALL responder 401 `unauthorized`.  <!-- IMPIMP-10 -->
2. WHEN o usuário B chama `GET /imports` THEN a resposta SHALL NOT conter lotes do usuário A.  <!-- IMPIMP-10 -->
3. WHEN o usuário B chama `GET /imports/:id/file` com o id de um lote do usuário A THEN a API SHALL responder 404 `not_found`, igual à resposta de um id inexistente, sem devolver o conteúdo do arquivo.  <!-- IMPIMP-10 -->
4. The rotas novas SHALL acessar o banco só por `withUser` (RLS) e o Storage só com o token do próprio usuário, nunca com a chave de serviço.  <!-- IMPIMP-10 -->
5. WHEN o usuário A baixa o próprio arquivo THEN o conteúdo SHALL ser o do seu upload, mesmo havendo lotes de outros usuários com o mesmo nome de arquivo.  <!-- IMPIMP-10 -->

**Independent Test**: Com dois usuários, B tentando listar e baixar o lote de A: lista sem itens de A e 404 no download.

---

### P1: Arquivos importados na tela de importação ⭐ MVP

**User Story**: Como usuário, quero ver na tela de importação os arquivos que já importei, com "Baixar" e "Reimportar".

**Why P1**: É o pedido do Q&A ("botões de reimportação ... e download").

**Acceptance Criteria**:

1. WHILE o passo "Conta e arquivo" está ativo THEN a tela SHALL exibir a seção "Arquivos importados" com, para cada lote, o nome do arquivo, o apelido da conta, a data `dd/mm/aaaa` e "N importadas · M ignoradas", mais os botões "Reimportar" e "Baixar".  <!-- IMPIMP-11 -->
2. WHILE a lista está carregando THEN a seção SHALL mostrar 3 linhas de skeleton.  <!-- IMPIMP-11 -->
3. WHEN o usuário não tem lotes THEN a seção SHALL mostrar "Nenhum arquivo importado ainda." sem botões.  <!-- IMPIMP-11 -->
4. IF a lista falha THEN a seção SHALL mostrar um alerta com a mensagem de `messageForError(error, "import")` e o botão "Tentar novamente", que refaz a consulta.  <!-- IMPIMP-11 -->
5. WHEN o usuário clica em "Baixar" THEN a tela SHALL baixar o arquivo por requisição autenticada e salvá-lo pelo navegador com o nome original, sem expor o token em URL e sem navegar para fora da página.  <!-- IMPIMP-12 -->
6. WHILE o download de uma linha está em andamento THEN os botões dessa linha SHALL ficar desabilitados.  <!-- IMPIMP-12 -->
7. IF o download falha THEN a seção SHALL mostrar um alerta com a mensagem de `messageForError(error, "import")`, em português, sem texto da API.  <!-- IMPIMP-12 -->
8. WHEN o usuário clica em "Reimportar" THEN a tela SHALL baixar o arquivo, montar o `File` com o nome e o tipo originais, selecionar a conta do lote e gerar o preview pelo caminho normal (`POST /imports/preview`), levando ao passo "Prévia".  <!-- IMPIMP-13 -->
9. WHEN o preview da reimportação é exibido THEN o preview SHALL ter as linhas já importadas como `duplicate` e a seleção inicial de sempre, e o confirm SHALL usar o mesmo `File` pelo caminho normal com uma chave de idempotência nova.  <!-- IMPIMP-13 -->
10. IF o download do arquivo da reimportação falha THEN a tela SHALL permanecer no passo inicial com o alerta da lista, sem gerar preview.  <!-- IMPIMP-13 -->
11. IF o preview da reimportação falha (por exemplo, conta inativa) THEN a tela SHALL permanecer no passo inicial com a conta e o arquivo preenchidos e a mensagem em português no formulário.  <!-- IMPIMP-13 -->
12. WHEN o usuário confirma um import com sucesso THEN a lista de arquivos SHALL ser invalidada e mostrar o novo lote ao voltar ao passo inicial.  <!-- IMPIMP-11 -->

**Independent Test**: Importar um arquivo, voltar ao início, ver o arquivo na lista, "Baixar" salva o CSV, "Reimportar" abre o preview com tudo duplicado na conta certa.

---

### P1: Contrato: OpenAPI, tipos, mocks e mensagens ⭐ MVP

**User Story**: Como desenvolvedor, quero o contrato novo documentado e refletido no front, para os testes não mascararem divergência.

**Why P1**: O OpenAPI é o contrato entre as apps (AD-001) e os mocks do import estão vazios.

**Acceptance Criteria**:

1. The `api/openapi.json` SHALL documentar `categoryId` nos itens de `selections` e nas linhas do preview, e as rotas `GET /imports` e `GET /imports/{id}/file` com os respectivos erros, regenerado por `pnpm -C api openapi:export` e conferido pelo teste de swagger.  <!-- IMPIMP-14 -->
2. The tipos do `web/` SHALL incluir `PreviewRow.categoryId`, `ImportSelection.categoryId` e o tipo do item da lista de arquivos, com a forma da resposta da API.  <!-- IMPIMP-14 -->
3. The mocks do `web/` SHALL atender `GET /imports`, `GET /imports/:id/file`, `POST /imports/preview` e `POST /imports/confirm` em memória, e a chave de área do import SHALL casar com o caminho `/imports/...`.  <!-- IMPIMP-14 -->
4. WHEN a API responde 502 `storage_error` ou 503 `storage_not_configured` THEN o front SHALL mostrar a mensagem em português definida para o código, em todos os pontos da tela de importação.  <!-- IMPIMP-15 -->
5. WHEN o confirm responde 422 `invalid_category` THEN o front SHALL mostrar "Há linhas com categoria inválida. Gere a prévia de novo.".  <!-- IMPIMP-15 -->

**Independent Test**: Regenerar o OpenAPI sem diferença e rodar a tela com `VITE_MOCK_AREAS=*`: lista, download, reimportação e confirm funcionam sem API.

---

## Edge Cases

- IF o arquivo da reimportação foi guardado com um nome que não termina em `.csv` THEN o front SHALL aceitá-lo mesmo assim, porque o arquivo veio do próprio Storage e não passa por `validateImportFile`.
- WHEN o mesmo arquivo é reimportado duas vezes seguidas sem confirmar THEN cada prévia SHALL renovar a chave de idempotência e nenhuma delas SHALL gravar nada.
- WHEN o usuário confirma uma reimportação com todas as duplicadas marcadas THEN o diálogo SHALL aparecer com a contagem e, ao confirmar, o sistema SHALL criar um novo lote com as transações repetidas, como o usuário aceitou.
- WHEN uma categoria é excluída entre a prévia e o confirm THEN o confirm SHALL responder 422 `invalid_category` e a tela SHALL mostrar a mensagem de gerar a prévia de novo.
- WHEN o usuário já escolheu categorias e clica em "Selecionar todas" THEN as categorias SHALL ser mantidas.
- WHEN `categoryId` vem em letras maiúsculas e é de uma categoria do usuário THEN o confirm SHALL aceitá-lo.
- IF `GET /imports` é chamada com `limit=1` e há dois lotes THEN a API SHALL devolver só o mais novo.
- WHEN o lote foi importado em uma conta depois inativada THEN a lista SHALL mostrar o item com o apelido da conta, e "Reimportar" SHALL falhar com a mensagem "Selecione uma conta ativa".
- WHEN o arquivo guardado tem mais de um anexo no lote THEN a API SHALL usar o mais antigo.
- WHEN o `mime_type` guardado não tem o formato `tipo/subtipo` THEN o download SHALL usar `application/octet-stream`.
- WHEN uma linha do preview tem `amount` com sinal "-" e é despesa THEN o Valor SHALL mostrar um único "-".

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| IMPIMP-01 | P1: Categoria por linha na API | In Tasks | Pending |
| IMPIMP-02 | P1: Categoria por linha na API | In Tasks | Pending |
| IMPIMP-03 | P1: Categoria por linha no preview | In Tasks | Pending |
| IMPIMP-04 | P2: Selecionar todas as linhas | In Tasks | Pending |
| IMPIMP-05 | P2: Preview com Valor colorido e sem a coluna Tipo | In Tasks | Pending |
| IMPIMP-06 | P2: Confirmação de duplicadas | In Tasks | Pending |
| IMPIMP-07 | P1: Lista de arquivos importados (API) | In Tasks | Pending |
| IMPIMP-08 | P1: Download do arquivo importado (API) | In Tasks | Pending |
| IMPIMP-09 | P1: Preview único para upload e reimportação | In Tasks | Pending |
| IMPIMP-10 | P1: Isolamento e autenticação das rotas de arquivos | In Tasks | Pending |
| IMPIMP-11 | P1: Arquivos importados na tela de importação | In Tasks | Pending |
| IMPIMP-12 | P1: Arquivos importados na tela de importação | In Tasks | Pending |
| IMPIMP-13 | P1: Arquivos importados na tela de importação | In Tasks | Pending |
| IMPIMP-14 | P1: Contrato: OpenAPI, tipos, mocks e mensagens | In Tasks | Pending |
| IMPIMP-15 | P1: Contrato: OpenAPI, tipos, mocks e mensagens | In Tasks | Pending |

**Coverage:** 15 total, 15 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm -C api test` (com `supabase start`) e `yarn --cwd web test`, mais typecheck e lint de cada app, passam; o teste de swagger confirma o `openapi.json` atualizado.
- [ ] Os testes de isolamento mostram que o usuário B não lista nem baixa o lote do usuário A, e que as duas rotas respondem 401 sem token.
- [ ] No navegador, contra a API local: o select de categoria muda a categoria gravada, "Selecionar todas" fica indeterminado em seleção parcial, o Valor aparece verde e vermelho sem a coluna "Tipo", o diálogo de duplicadas aparece com a contagem e "Voltar" mantém a seleção.
- [ ] No navegador: a lista "Arquivos importados" mostra o arquivo recém-importado, "Baixar" salva o CSV idêntico ao enviado e "Reimportar" abre o preview na conta certa com as linhas marcadas como duplicadas.
- [ ] Nenhuma resposta nem tela contém o caminho do objeto no Storage.
