# Extrato: filtros salvos (saved-filters) Specification

Origem: seção "F7 · saved-filters" e as decisões confirmadas do topo de `docs/v1/plano-melhoria-transacoes.md` (resposta 4 do Q&A), e os três primeiros itens de `docs/v1/melhoria-transacoes.md` (salvar os filtros aplicados com o botão "Salvar Filtro" e um modal de confirmação com o nome; gerenciar os filtros salvos, com renomear e excluir; listar em menu suspenso e aplicar com um clique). Escopo: só `web/` (módulos de estado e de armazenamento, hook, três componentes e a montagem no extrato). Sem API, sem banco, sem migration e sem mudança de contrato: os filtros salvos moram no `localStorage` do navegador.

## Problem Statement

O extrato tem oito controles de filtro (busca, tipo, conta, categoria, neutra, De, Até, mês rápido) e a ordenação, e quem consulta sempre as mesmas combinações (por exemplo "Despesas do cartão em junho, por valor") precisa remontá-las a cada visita. O usuário quer guardar o que está aplicado com um nome, ver a lista num menu, aplicar com um clique, renomear e excluir. Os filtros ficam só neste navegador (decisão do dono), então o armazenamento precisa ser tolerante: dados corrompidos, de outra versão, `localStorage` bloqueado ou cheio, e usuários diferentes no mesmo navegador não podem quebrar a tela nem se misturar.

## Goals

- [ ] "Salvar filtro" (desabilitado sem filtro aplicado) abre um diálogo com o nome e um resumo do que será salvo; confirmar guarda no `localStorage` com a chave do usuário logado e mostra o toast de sucesso; nome vazio, longo ou repetido mostra erro no campo.
- [ ] O menu "Filtros salvos" lista os filtros em ordem alfabética, com estado vazio, e um clique aplica o filtro: substitui TODOS os filtros atuais (busca, tipo, conta, categoria, neutra, De, Até, mês rápido, coluna e sentido da ordenação), volta à página 1, não mexe nos itens por página e preenche todos os controles; o filtro aplicado fica marcado enquanto o estado atual for igual ao salvo.
- [ ] "Gerenciar filtros" renomeia (mesmas regras de nome, erro no campo) e exclui (com confirmação), com toasts de sucesso e de erro.
- [ ] O armazenamento valida tudo o que lê (corrompido, forma errada, versão diferente, campos desconhecidos ou inválidos), nunca lança, respeita o limite de 20 filtros e a unicidade de nomes sem diferenciar caixa e acento, isola cada usuário, e uma falha de leitura ou gravação vira mensagem clara sem perder os dados que já estavam lá.
- [ ] Nenhuma requisição nova à API e `TransactionsPage.tsx` (740 linhas) cresce menos de 25 linhas: a lógica vive em `savedFilterState.ts`, `savedFilters.ts`, `useSavedFilters.ts`, `SaveFilterDialog.tsx`, `SavedFiltersMenu.tsx`, `ManageFiltersDialog.tsx` e `SavedFiltersControls.tsx`.

## Out of Scope

Explicitamente excluído para evitar crescimento de escopo.

| Feature | Reason |
| ------- | ------ |
| Guardar a página e os itens por página no filtro salvo | Decisão do dono: o filtro salvo não tem a página nem o tamanho da página; o tamanho continua preferência de tela (`usePageSize`) |
| Sincronizar filtros salvos entre dispositivos, navegadores ou usuários, ou guardá-los na API ou no banco | Decisão do dono: valem só neste navegador (`localStorage`) |
| Aplicar um filtro salvo automaticamente ao abrir o extrato, filtro padrão ou favorito | Não pedido; a aplicação é por clique |
| Atualizar um filtro salvo com os filtros atuais ("sobrescrever") e duplicar | Não pedido; para trocar o conteúdo o usuário exclui e salva de novo, ou salva com outro nome |
| Reordenar manualmente, agrupar, pastas ou limite configurável | Não pedido; a lista é alfabética e o limite é fixo (20) |
| Importar, exportar e compartilhar filtros por link ou arquivo | Não pedido |
| Reagir em tempo real a mudanças feitas em outra aba (evento `storage`) | Cada gravação relê o armazenamento antes de gravar (sem perda de dados); a lista de outra aba aparece depois de qualquer ação ou recarga |
| Migração de versões futuras do formato | Só existe a versão 1; versão diferente é ignorada (suposição acima) |
| Apagar os filtros do navegador ao sair da conta | A chave é por usuário; quem sai deixa os dados na chave dele, invisíveis a outro usuário |
| Mudar API, `openapi.json`, hooks de transações, `FilterState`, `usePageSize` ou o comportamento dos controles atuais | A feature só consome o estado do extrato e o substitui por inteiro |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida ou registrada aqui. As linhas marcadas "y" são decisões do dono; as demais são o padrão escolhido por esta spec.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| O que o filtro salvo guarda | Todos os filtros do extrato: busca (`q`), tipo, conta, categoria, neutra, De, Até, mês rápido (ano e mês) e a ordenação (coluna e sentido) | Decisão do dono (resposta 4 do Q&A) | y |
| O que o filtro salvo não guarda | A página e os itens por página (`pageSize`) | Decisão do dono | y |
| Onde ficam | Só no `localStorage` deste navegador; sem sincronização e sem requisição à API | Decisão do dono | y |
| Chave do armazenamento | `financials:transactions:saved-filters:<id do usuário logado>`, com o `id` de `session.user.id` do Supabase; o prefixo segue o de `financials:transactions:page-size`. Nenhum dado de filtro é lido nem gravado sem id de usuário | Isolamento por usuário no mesmo navegador; a chave literal é afirmada em teste (L-043) | n |
| Formato guardado | Texto JSON `{"version":1,"filters":[{"id":"...","name":"...","state":{...}}]}`; `state` tem só `q`, `type`, `accountId`, `categoryId`, `neutral`, `from`, `to`, `quick` (`{year, month}`), `sort` e `order`, sem os campos vazios | Versionado (risco do plano); campos ausentes ficam vazios ao ler | n |
| Leitura: tudo é validado | O valor lido é `unknown` até passar pela validação; texto que não é JSON, JSON que não é objeto, `filters` que não é lista ou `version` diferente de 1 dão lista vazia sem erro e sem aviso; o dado ruim só é sobrescrito na próxima gravação bem-sucedida | A tela nunca quebra por dado velho ou corrompido | n |
| Leitura: entrada inválida | A entrada que não é objeto, sem `id` (texto não vazio, até 64 caracteres) ou com nome inválido pelas regras abaixo é descartada e as demais ficam; `id` repetido e nome repetido (pela comparação abaixo) mantêm só a primeira; passando de 20, ficam as 20 primeiras | Lista sempre satisfaz as invariantes da escrita | n |
| Leitura: campo do estado inválido | Campos desconhecidos são descartados (na entrada e no estado). `type` fora de `Income`/`Expense`, `neutral` que não é booleano, `accountId`/`categoryId`/`q` que não são texto não vazio (até 200 caracteres), `from`/`to` que não são dia real `AAAA-MM-DD`, `quick` sem `year` inteiro de 1900 a 2100 e `month` inteiro de 1 a 12 viram ausentes; `sort` ou `order` ausente ou inválido vale `date` e `desc`. A entrada continua válida | "Campos ausentes ficam vazios"; um campo ruim não derruba o filtro inteiro | n |
| Falha do `localStorage` | Todo acesso (`getItem`, `setItem`, e até tocar em `localStorage`) fica em `try/catch`. Falha de leitura: lista vazia e `available: false`; as ações (salvar, renomear, excluir) falham com a razão `storage` sem gravar nada, para nunca sobrescrever dados que não foi possível ler. Falha de gravação (cota cheia, bloqueado): a ação falha com `storage` e a lista continua como estava | Pedido (cota, bloqueio); não perder dados | n |
| Mensagem de falha do armazenamento | "Não foi possível acessar o armazenamento do navegador. Verifique se ele está liberado e tente de novo." (toast de erro) | Pedido: toasts de erro | n |
| Limite | 20 filtros por usuário. Salvar o 21º é recusado com "Limite de 20 filtros salvos atingido. Exclua um para salvar outro."; excluir um libera o espaço. Com o limite atingido o diálogo de salvar mostra essa mensagem como alerta e o botão "Salvar" fica desabilitado | Pedido: limite com mensagem clara | n |
| Regras do nome | O nome é aparado (`trim`) antes de tudo e guardado aparado; vazio após aparar: "Informe um nome para o filtro"; mais de 40 caracteres (pontos de código, depois de aparar): "O nome deve ter no máximo 40 caracteres"; 1 e 40 caracteres são válidos | Pedido: nomes de 1 a 40 caracteres | n |
| Unicidade do nome (L-004) | Dois nomes são iguais quando coincidem depois de remover acentos (decomposição NFD sem marcas), pôr em minúsculas (`pt-BR`), trocar qualquer sequência de espaços por um espaço e aparar: "Mês atual", "mes  ATUAL" e " MÊS atual" são o mesmo nome. Repetido: "Já existe um filtro salvo com esse nome". Renomear um filtro para um nome que só difere do dele em caixa, acento ou espaços é permitido (não conta contra si mesmo) | Pedido: único sem diferenciar caixa e acento; o web não tinha helper de normalização (a API compara no banco), então um pequeno helper fica em `savedFilters.ts` | n |
| Ordem das checagens do nome | Vazio, tamanho, repetido e, só ao adicionar, limite; a primeira que falha é a mensagem | Uma mensagem por vez, a mais acionável primeiro | n |
| "Filtro aplicado" para habilitar "Salvar filtro" | O estado difere do inicial: algum dos campos de filtro tem valor, ou a ordenação não é data decrescente. Mês rápido incompleto (só ano ou só mês) não é filtro (a consulta não muda) e não habilita o botão | Pedido: desabilitado sem filtro aplicado; a ordenação faz parte do filtro salvo | n |
| Período invertido (De depois de Até) | "Salvar filtro" fica desabilitado enquanto o período está invertido; o alerta existente explica | Não se guarda um estado que a tela rejeita | n |
| Mês rápido salvo | Só o mês rápido completo (ano e mês) é guardado, como `quick`; `from` e `to` do mês são derivados de `monthRange` ao aplicar e ao comparar, não vêm do texto guardado. Mês incompleto não é guardado; com `quick` presente, `from`/`to` guardados são ignorados | `from`/`to` do mês são consequência do mês; evita dois valores para a mesma coisa | n |
| Busca guardada | Guarda-se a busca aplicada (`filters.q`, já aparada), não o texto digitado ainda dentro dos 300 ms de espera | O que a lista está usando é o que se salva | n |
| Igualdade para o marcador | Igualdade profunda do estado salvo normalizado do extrato com o de cada filtro salvo, ignorando página, tamanho de página, mês incompleto, ordem das chaves e `q` vazio contra ausente; vários filtros salvos com o mesmo conteúdo ficam todos marcados | Pedido: marcado enquanto o estado for igual ao salvo | n |
| Aplicar | Substitui por inteiro: busca, tipo, conta, categoria, neutra, De, Até, mês rápido, coluna e sentido da ordenação passam a ser os do filtro salvo, e o que ele não tem fica vazio (ordenação ausente vale data decrescente); a página vira 1; o tamanho da página não muda; a seleção de linhas é esvaziada (como em qualquer troca de filtro); o campo de busca mostra o `q` aplicado na hora e a consulta não se repete 300 ms depois | Pedido do dono | y |
| Conta ou categoria que não existem mais | Com as listas de contas (todas, inclusive inativas) e de categorias carregadas, o `accountId` ou `categoryId` ausente da lista é descartado e o resto é aplicado, com o toast informativo `Filtro "<nome>" aplicado sem a conta que não existe mais`, `... sem a categoria que não existe mais` ou `... sem a conta e a categoria que não existem mais`; o filtro salvo não é alterado (nem marcado como desatualizado) e, por ficar diferente do estado, não aparece como aplicado. Com a lista não carregada ou com erro não há como saber: aplica tudo, sem aviso | Decisão do autor entre "aplicar o que resta e avisar" e "marcar desatualizado": a primeira usa a tela como está, sem estado novo no armazenamento | n |
| Ordem da lista | Alfabética pelo nome, sem diferenciar caixa e acento (`localeCompare` `pt-BR`, sensibilidade `base`), com desempate pela ordem guardada | Previsível com até 20 itens | n |
| Menu | "Filtros salvos" é um `DropdownMenu` do app (Radix): botão `outline` com ícone, itens por filtro, separador e o item "Gerenciar filtros"; Enter, Espaço e seta para baixo abrem; setas navegam; Enter escolhe; Esc fecha e devolve o foco ao botão | Já existe em `web/src/components/ui/dropdown-menu.tsx`; teclado e aria vêm do Radix | n |
| Estado vazio do menu | Texto "Nenhum filtro salvo ainda" no lugar dos itens e "Gerenciar filtros" desabilitado | Pedido: estado vazio da lista | n |
| Marcador do filtro aplicado | O item tem `aria-current="true"`, um ícone de visto e o texto oculto " (aplicado)" no nome acessível, além do destaque visual (`font-medium` e `bg-accent`); nunca só a cor | Acessível e legível sem cor | n |
| Diálogo "Salvar filtro" | `Dialog` do app com título "Salvar filtro", descrição, campo "Nome do filtro" focado ao abrir, lista "Filtros que serão salvos" (uma linha por campo aplicado e sempre a ordenação), botões "Cancelar" e "Salvar"; Enter no campo salva; o erro aparece abaixo do campo (`role="alert"`, `aria-invalid`, `aria-describedby`) e o foco volta ao campo; digitar apaga o erro; ao fechar, o foco volta ao botão "Salvar filtro" e reabrir mostra o campo vazio | Pedido; foco e teclado | n |
| Linhas do resumo | `Busca: <q>`, `Tipo: Receita` ou `Despesa`, `Conta: <apelido>` e `Categoria: <nome>` (da lista em cache; sem a lista, `Conta selecionada` e `Categoria selecionada`), `Neutra: Sim` ou `Não`, `De: dd/mm/aaaa`, `Até: dd/mm/aaaa`, `Mês: <Mês> de <ano>` (no lugar de De e Até quando há mês rápido), `Ordenação: <Data, Nome, Valor ou Categoria> (crescente ou decrescente)`. As datas são formatadas do texto `AAAA-MM-DD` sem `Date` | Pedido: resumo do que será salvo; sem fuso | n |
| Gerenciar | "Gerenciar filtros" é um `Dialog` com uma linha por filtro (nome e botões `Renomear <nome>` e `Excluir <nome>`); renomear abre o campo na própria linha, com o nome atual selecionado, e botões "Salvar nome" e "Cancelar"; Enter confirma e Esc cancela só a edição (o diálogo continua aberto); a lista vazia mostra "Nenhum filtro salvo ainda"; ao fechar, o foco volta ao botão "Filtros salvos" | Pedido | n |
| Excluir | `AlertDialog` do app: título `Excluir o filtro "<nome>"?`, "Essa ação não pode ser desfeita.", "Cancelar" e "Excluir"; falha mantém o diálogo aberto (como a exclusão de transação) | Pedido: exclusão com confirmação; padrão do extrato | n |
| Textos dos toasts | Sucesso: `Filtro "<nome>" salvo`, `Filtro renomeado para "<nome>"`, `Filtro "<nome>" excluído`. Erro: a mensagem do armazenamento acima, ou "Esse filtro não existe mais" quando o filtro sumiu (outra aba) e a lista é relida. Informativo: o de conta ou categoria ausente. Tudo por `lib/notify.ts`; como `notifyError` só mapeia erros da API, entra um `notifyErrorMessage(texto)` que usa o mesmo `toast.error` | Pedido: toasts de sucesso e de erro por `notify.ts` | n |
| Outras abas | Cada ação relê o armazenamento antes de decidir e gravar (nome repetido e limite valem contra o dado atual); a lista na tela se atualiza depois de cada ação | Sem perda de dados entre abas, sem ouvir `storage` | n |
| Sem usuário | Sem id de usuário (fora de um `SessionProvider` ou sem sessão), o botão e o menu não são renderizados; `useSessionUserId()` devolve `null` e não lança, ao contrário de `useSession` | O extrato fica atrás de `RequireAuth`; nada é guardado em chave sem dono; os testes atuais do extrato (sem provedor) seguem iguais | n |
| Identificador do filtro | `crypto.randomUUID()` quando existe, senão um texto aleatório; o `id` só identifica a entrada e nunca é mostrado nem afirmado por valor nos testes | Contexto não seguro (http) não tem `randomUUID` | n |
| Posição na tela | Na seção "Filtros do extrato", numa célula da grade logo depois do grupo do mês rápido (na mesma linha no layout largo, abaixo no estreito), com "Salvar filtro" e "Filtros salvos"; não dentro da célula de "Limpar filtros" (uma coluna de 1/7 não comporta três botões) | O plano diz "ao lado de Limpar filtros"; a vizinhança é a do grupo de filtros, com o mesmo alinhamento. Desvio de posição registrado | n |
| Sem API | Salvar, listar, aplicar, renomear e excluir não enviam requisição à API; aplicar causa a consulta da lista (e do resumo) que qualquer mudança de filtro causa | Decisão do dono | y |
| Lições aplicadas | L-004 (igualdade dos nomes), L-013 (falha de cada ação destrutiva com texto e opções visíveis), L-027 (testes leves: o kit `lightList`/`trimTransactions`, componentes isolados sempre que possível, nenhum timeout aumentado), L-041 (todo teste de aplicar e de salvar parte da página 2), L-043 (chave literal afirmada), L-040 (a cor pintada do menu, do marcador e dos diálogos conferida em Chromium real, sem login), L-020 (relógio e temporizadores falsos, sem espera fixa), L-039 (a caixa de conferência manual só se marca com o registro do dono) | Lições confirmadas e candidatas relevantes | n |
| Dimensões implícitas | Validação e limites: nome, limite e leitura acima. Falha parcial: leitura impossível não sobrescreve; gravação impossível não altera a lista. Idempotência e duplicidade: nomes únicos e `Enter` duas vezes só grava uma vez (o segundo vê o nome repetido). Autorização: chave por usuário (N/A limite de taxa, sem API). Concorrência: várias abas, releitura antes de gravar. Ciclo de vida: os dados ficam no navegador até serem excluídos (em computador compartilhado o usuário seguinte, com outro id, não os vê). Observabilidade: N/A porque nada vai ao servidor. Dependência externa: o `localStorage` (falhas acima). Transição de estado: o filtro alterna entre aplicado e não aplicado conforme o estado muda | Varredura de dimensões da Specify | n |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Estado do filtro salvo ⭐ MVP

**User Story**: Como usuário, quero que o filtro salvo guarde exatamente os filtros do extrato (e a ordenação), sem a página, para que aplicá-lo reproduza a consulta.

**Why P1**: É a unidade que todo o resto guarda, compara e aplica.

**Acceptance Criteria** (módulo `savedFilterState.ts`):

1. The conversão do estado do extrato em estado salvo SHALL produzir exatamente os campos `q`, `type`, `accountId`, `categoryId`, `neutral`, `from`, `to`, `quick`, `sort` e `order`, sem `page` e sem `pageSize`, e sem os campos vazios.  <!-- SFILT-01 -->
2. The conversão SHALL guardar `q` aparado, e SHALL tratar `q` vazio como ausente.  <!-- SFILT-01 -->
3. WHEN o mês rápido está completo (ano e mês) THEN a conversão SHALL guardar `quick` com `year` e `month`, e SHALL derivar `from` e `to` de `monthRange` do mês, e WHEN está incompleto SHALL não guardar `quick`.  <!-- SFILT-01 -->
4. The conversão de volta SHALL produzir um estado do extrato na página 1, com `sort` e `order` do estado salvo, e SHALL ser `date` e `desc` quando o estado salvo não os tem.  <!-- SFILT-01 -->
5. The conversão de volta SHALL produzir o mês rápido (`quick`) com o ano e o mês guardados e `from` e `to` do mês, e SHALL produzir `quick` vazio quando o estado salvo não tem mês rápido.  <!-- SFILT-01 -->
6. WHEN o estado do extrato é o inicial (sem campos de filtro, ordenação `date` e `desc`, ou só um mês rápido incompleto) THEN `isDefaultState` SHALL ser verdadeiro, e SHALL ser falso quando qualquer campo de filtro tem valor ou a ordenação difere de `date` e `desc`.  <!-- SFILT-01 -->
7. The comparação `sameSavedState` SHALL ser verdadeira para estados iguais ignorando a página, o tamanho de página, o mês rápido incompleto, a ordem das chaves e `q` vazio contra ausente, e SHALL ser falsa quando diferem em qualquer um dos dez campos (incluindo `neutral` falso contra ausente).  <!-- SFILT-01 -->
8. WHEN o estado salvo tem `accountId` ou `categoryId` que não consta da lista conhecida THEN `withoutMissingRefs` SHALL remover o campo e informar qual faltou, e SHALL manter o campo quando a lista conhecida não existe (não carregada).  <!-- SFILT-01 -->
9. The módulo SHALL descrever o estado salvo em linhas de resumo em português, uma por campo aplicado e sempre a ordenação, com as datas formatadas de `AAAA-MM-DD` sem `Date` e o mês rápido no lugar de De e Até.  <!-- SFILT-01 -->

**Independent Test**: Converter um estado com todos os campos, página 3 e mês rápido de junho de 2026, e ver o estado salvo sem a página; convertê-lo de volta e ver a página 1.

---

### P1: Armazenamento tolerante ⭐ MVP

**User Story**: Como usuário, quero que meus filtros salvos sobrevivam a dados ruins e a falhas do navegador, e que nunca apareçam para outro usuário.

**Why P1**: Pedido do plano (validação do JSON, try/catch, isolamento); o dado é do navegador e pode estar velho, corrompido ou inacessível.

**Acceptance Criteria** (módulo `savedFilters.ts`):

1. The módulo SHALL guardar os filtros do usuário no `localStorage` na chave `financials:transactions:saved-filters:<id do usuário>`, como o texto JSON `{"version":1,"filters":[...]}` em que cada entrada tem `id`, `name` e `state` e nenhum campo a mais.  <!-- SFILT-02 -->
2. WHEN o valor guardado não é um JSON válido, não é um objeto, tem `filters` que não é lista ou tem `version` diferente de 1 THEN a leitura SHALL devolver lista vazia e `available` verdadeiro, sem lançar.  <!-- SFILT-02 -->
3. WHEN uma entrada guardada não é objeto, não tem `id` de texto não vazio de até 64 caracteres, ou tem nome inválido THEN a leitura SHALL descartar só essa entrada e manter as demais.  <!-- SFILT-02 -->
4. WHEN há `id` repetido ou nome repetido (pela comparação de nomes) THEN a leitura SHALL manter só a primeira, e WHEN há mais de 20 entradas SHALL manter as 20 primeiras.  <!-- SFILT-02 -->
5. WHEN uma entrada ou o seu estado tem campos desconhecidos THEN a leitura SHALL descartá-los, e WHEN um campo do estado tem valor inválido SHALL tratá-lo como ausente (`sort` e `order` como `date` e `desc`) e manter a entrada.  <!-- SFILT-02 -->
6. WHEN o estado guardado tem só alguns campos THEN a leitura SHALL devolver os ausentes como vazios, sem erro.  <!-- SFILT-02 -->
7. IF ler o `localStorage` lança erro (bloqueado, indisponível) THEN a leitura SHALL devolver lista vazia e `available` falso, sem lançar.  <!-- SFILT-02 -->
8. The módulo SHALL isolar os usuários: os filtros guardados com o id do usuário A SHALL não aparecer na leitura do usuário B no mesmo navegador, e salvar, renomear ou excluir de um SHALL não alterar os do outro.  <!-- SFILT-02 -->
9. IF o id do usuário é vazio THEN a leitura SHALL devolver lista vazia e `available` falso e as ações SHALL falhar com `storage`, sem tocar no `localStorage`.  <!-- SFILT-02 -->

**Independent Test**: Gravar à mão cinco valores ruins na chave do usuário e ler lista vazia cinco vezes sem erro; gravar um bom e ver o usuário B com lista vazia.

---

### P1: Salvar, renomear e excluir no armazenamento ⭐ MVP

**User Story**: Como usuário, quero salvar, renomear e excluir filtros com nomes válidos e únicos, até um limite, sem perder dados quando algo falha.

**Why P1**: Regras do plano (limite, nomes únicos sem caixa e acento, falhas).

**Acceptance Criteria** (módulo `savedFilters.ts`):

1. The nome SHALL ser aparado antes de validar e guardado aparado.  <!-- SFILT-03 -->
2. IF o nome é vazio depois de aparado THEN a ação SHALL falhar com a razão `invalid-name` e a mensagem "Informe um nome para o filtro".  <!-- SFILT-03 -->
3. IF o nome tem mais de 40 caracteres THEN a ação SHALL falhar com `invalid-name` e a mensagem "O nome deve ter no máximo 40 caracteres", e SHALL aceitar nomes de 1 e de exatamente 40 caracteres.  <!-- SFILT-03 -->
4. IF o nome é igual ao de outro filtro do usuário sem diferenciar caixa, acento e espaços repetidos THEN a ação SHALL falhar com `duplicate-name` e a mensagem "Já existe um filtro salvo com esse nome".  <!-- SFILT-03 -->
5. WHEN um filtro é renomeado para um nome que só difere do dele em caixa, acento ou espaços THEN a ação SHALL ter sucesso.  <!-- SFILT-03 -->
6. IF o usuário já tem 20 filtros THEN salvar um novo SHALL falhar com `limit` e a mensagem "Limite de 20 filtros salvos atingido. Exclua um para salvar outro.", e WHEN um é excluído SHALL salvar com sucesso.  <!-- SFILT-03 -->
7. WHEN o nome e o estado são válidos THEN salvar SHALL gravar uma entrada nova com o nome aparado e o estado salvo sem a página, e as entradas anteriores SHALL ficar intactas.  <!-- SFILT-04 -->
8. WHEN um filtro é renomeado THEN só o `name` da entrada daquele `id` SHALL mudar, com o `state` e as demais entradas intactos.  <!-- SFILT-04 -->
9. WHEN um filtro é excluído THEN só a entrada daquele `id` SHALL sair.  <!-- SFILT-04 -->
10. IF o `id` de renomear ou excluir não existe THEN a ação SHALL falhar com `not-found` e nada SHALL ser gravado.  <!-- SFILT-04 -->
11. The ação SHALL reler o armazenamento antes de decidir e gravar, de modo que uma entrada criada por outra aba conte para o nome repetido e para o limite e não seja perdida.  <!-- SFILT-04 -->
12. IF gravar no `localStorage` lança erro (cota cheia ou bloqueado) THEN a ação SHALL falhar com `storage` e a mensagem do armazenamento, sem lançar, e a leitura seguinte SHALL devolver os filtros de antes.  <!-- SFILT-04 -->
13. IF ler o `localStorage` lança erro THEN a ação SHALL falhar com `storage` e SHALL não gravar nada.  <!-- SFILT-04 -->

**Independent Test**: Salvar "Mês atual" e depois "mes ATUAL" e ver a segunda falhar; com `setItem` lançando, ver a falha `storage` e a lista de antes.

---

### P1: Hook e usuário da sessão ⭐ MVP

**User Story**: Como desenvolvedor, quero um hook que entregue a lista do usuário logado e as ações, e um jeito de ler o id do usuário sem quebrar fora do provedor.

**Why P1**: Liga o armazenamento à tela sem engordar `TransactionsPage.tsx`.

**Acceptance Criteria**:

1. The hook `useSessionUserId` SHALL devolver `session.user.id` quando há sessão e `null` quando não há sessão ou não há `SessionProvider`, sem lançar.  <!-- SFILT-05 -->
2. The hook `useSavedFilters(userId)` SHALL devolver os filtros do usuário em ordem alfabética pelo nome (sem diferenciar caixa e acento), `available`, `atLimit` (verdadeiro com 20) e as ações `add`, `rename` e `remove` que devolvem o resultado do armazenamento.  <!-- SFILT-05 -->
3. WHEN uma ação muda o armazenamento (ou falha por `not-found`) THEN o hook SHALL reler e devolver a lista atual na renderização seguinte.  <!-- SFILT-05 -->
4. WHEN o `userId` muda THEN o hook SHALL devolver a lista do novo usuário, e WHEN é `null` SHALL devolver lista vazia, `available` falso e ações que falham com `storage`.  <!-- SFILT-05 -->

**Independent Test**: Renderizar o hook com o usuário A, salvar e ver a lista; trocar para B e ver vazio.

---

### P1: Salvar filtro ⭐ MVP

**User Story**: Como usuário, quero guardar os filtros aplicados com um nome, vendo o que será guardado, e ser avisado se o nome não serve.

**Why P1**: Primeiro pedido da melhoria.

**Acceptance Criteria** (`SaveFilterDialog` e `SavedFiltersControls`):

1. WHILE nenhum filtro está aplicado (estado inicial), o botão "Salvar filtro" SHALL estar desabilitado, e WHILE algum filtro ou a ordenação está diferente do inicial e o período não está invertido SHALL estar habilitado.  <!-- SFILT-06 -->
2. WHILE o período está invertido (De depois de Até), o botão "Salvar filtro" SHALL estar desabilitado.  <!-- SFILT-06 -->
3. WHEN o usuário aciona "Salvar filtro" THEN o sistema SHALL abrir o diálogo "Salvar filtro" com o campo "Nome do filtro" vazio e focado, a lista "Filtros que serão salvos" e os botões "Cancelar" e "Salvar".  <!-- SFILT-06 -->
4. The lista do diálogo SHALL ter uma linha por filtro aplicado e a ordenação, nas formas `Busca: ...`, `Tipo: ...`, `Conta: ...`, `Categoria: ...`, `Neutra: ...`, `De: ...`, `Até: ...` (ou `Mês: ...`) e `Ordenação: ...`, e SHALL não ter linha de página nem de itens por página.  <!-- SFILT-06 -->
5. WHEN o usuário confirma com um nome válido (botão "Salvar" ou Enter no campo) THEN o sistema SHALL guardar o filtro, fechar o diálogo, mostrar o toast de sucesso `Filtro "<nome>" salvo` e devolver o foco ao botão "Salvar filtro".  <!-- SFILT-06 -->
6. WHEN o filtro acaba de ser salvo THEN o sistema SHALL mostrá-lo como aplicado no menu, e SHALL não alterar os filtros, a ordenação nem a página do extrato.  <!-- SFILT-06 -->
7. IF o nome é vazio, longo demais ou repetido THEN o diálogo SHALL continuar aberto, mostrar a mensagem do armazenamento abaixo do campo (`role="alert"`, campo com `aria-invalid="true"`), devolver o foco ao campo, e nada SHALL ser guardado.  <!-- SFILT-06 -->
8. WHEN o usuário digita depois de um erro THEN o sistema SHALL apagar a mensagem de erro.  <!-- SFILT-06 -->
9. WHEN o usuário aciona "Cancelar" ou Esc THEN o sistema SHALL fechar sem guardar, devolver o foco ao botão "Salvar filtro", e ao reabrir o campo SHALL estar vazio.  <!-- SFILT-06 -->
10. WHILE o usuário já tem 20 filtros salvos, o diálogo SHALL mostrar a mensagem de limite como alerta e o botão "Salvar" SHALL estar desabilitado.  <!-- SFILT-06 -->
11. IF guardar falha por erro do armazenamento THEN o sistema SHALL mostrar o toast de erro com a mensagem do armazenamento, manter o diálogo aberto com o nome digitado e nada SHALL ser guardado.  <!-- SFILT-06 -->

**Independent Test**: Filtrar por Receita em junho, acionar "Salvar filtro", dar o nome "Receitas de junho" e ver o toast e o item marcado no menu.

---

### P1: Menu "Filtros salvos" e marcador ⭐ MVP

**User Story**: Como usuário, quero ver meus filtros num menu e saber qual está aplicado.

**Why P1**: Terceiro item da melhoria.

**Acceptance Criteria** (`SavedFiltersMenu`):

1. The extrato SHALL ter o botão "Filtros salvos" que abre um menu (por clique, Enter, Espaço ou seta para baixo) com um item por filtro salvo, na ordem alfabética, e o item final "Gerenciar filtros".  <!-- SFILT-07 -->
2. WHILE não há filtros salvos, o menu SHALL mostrar o texto "Nenhum filtro salvo ainda" no lugar dos itens e "Gerenciar filtros" SHALL estar desabilitado.  <!-- SFILT-07 -->
3. WHILE o estado do extrato é igual ao de um filtro salvo, o item desse filtro SHALL ter `aria-current="true"` e o nome acessível terminado em "(aplicado)", e os demais itens SHALL não ter o atributo.  <!-- SFILT-07 -->
4. WHEN qualquer controle muda o estado (tipo, conta, categoria, neutra, De, Até, mês, busca, ordenação) THEN o marcador SHALL sair do item, e WHEN o estado volta a ser igual SHALL voltar; mudar só a página ou o tamanho da página SHALL não mexer no marcador.  <!-- SFILT-07 -->
5. WHEN o usuário escolhe um item (clique ou Enter) THEN o menu SHALL fechar e o filtro SHALL ser aplicado, e WHEN aciona Esc SHALL fechar sem aplicar e devolver o foco ao botão "Filtros salvos".  <!-- SFILT-07 -->
6. WHEN o usuário aciona "Gerenciar filtros" THEN o sistema SHALL abrir o diálogo "Gerenciar filtros".  <!-- SFILT-07 -->

**Independent Test**: Salvar dois filtros, abrir o menu e ver os dois em ordem; mudar o Tipo e ver o marcador sair.

---

### P1: Aplicar um filtro salvo ⭐ MVP

**User Story**: Como usuário, quero aplicar um filtro salvo com um clique e ter todos os controles refletindo-o.

**Why P1**: Quarto item da melhoria e decisão do dono (substitui tudo).

**Acceptance Criteria** (`SavedFiltersControls` no extrato):

1. WHEN o usuário aplica um filtro salvo THEN o extrato SHALL substituir busca, tipo, conta, categoria, neutra, De, Até, mês rápido, coluna e sentido da ordenação pelos do filtro salvo, e os campos que ele não tem SHALL ficar vazios (a ordenação ausente, `date` e `desc`).  <!-- SFILT-08 -->
2. WHEN o usuário está na página 2 ou mais e aplica um filtro salvo THEN a consulta SHALL ir para a página 1, SHALL manter o tamanho de página escolhido (sem `pageSize` quando é 50) e SHALL esvaziar a seleção de linhas.  <!-- SFILT-08 -->
3. WHEN um filtro salvo é aplicado THEN a consulta da lista SHALL ter exatamente os parâmetros do filtro salvo mais `page=1` (e `pageSize` só se não for 50), e nenhum parâmetro do estado anterior.  <!-- SFILT-08 -->
4. WHEN um filtro salvo é aplicado THEN o campo de busca, "Tipo", "Conta", "Categoria", "Neutra", "De", "Até", "Mês" e "Ano" SHALL mostrar os valores do filtro e o indicador de ordenação da coluna SHALL refletir a coluna e o sentido salvos.  <!-- SFILT-08 -->
5. WHEN o filtro salvo tem mês rápido THEN "Mês" e "Ano" SHALL mostrá-lo, "De" e "Até" SHALL ficar desabilitados com as datas do mês, e WHEN o filtro não tem mês rápido e o extrato tinha um THEN o mês rápido SHALL ser limpo e "De" e "Até" SHALL ficar habilitados.  <!-- SFILT-08 -->
6. WHEN o filtro salvo tem busca THEN o campo SHALL mostrá-la na hora e a consulta SHALL não se repetir 300 ms depois, e WHEN não tem busca e o campo tinha texto THEN o campo SHALL ficar vazio.  <!-- SFILT-08 -->
7. WHEN o filtro acaba de ser aplicado THEN ele SHALL aparecer como aplicado no menu.  <!-- SFILT-08 -->
8. IF o filtro salvo tem conta ou categoria que não está na lista (de contas, inclusive inativas, ou de categorias) já carregada THEN o extrato SHALL aplicar o resto sem esse campo e mostrar o toast informativo `Filtro "<nome>" aplicado sem a conta que não existe mais`, `... sem a categoria que não existe mais` ou `... sem a conta e a categoria que não existem mais`, e o filtro salvo SHALL ficar como estava.  <!-- SFILT-08 -->
9. IF a lista de contas ou de categorias não carregou ou falhou THEN o extrato SHALL aplicar o filtro inteiro, sem aviso.  <!-- SFILT-08 -->

**Independent Test**: Com Despesa, junho e ordenação por valor salvos, ir à página 2 com outros filtros, aplicar e ver a consulta exata `type=Expense&from=2026-06-01&to=2026-06-30&sort=amount&order=asc&page=1`.

---

### P1: Gerenciar filtros ⭐ MVP

**User Story**: Como usuário, quero renomear e excluir filtros salvos.

**Why P1**: Segundo item da melhoria.

**Acceptance Criteria** (`ManageFiltersDialog`):

1. WHEN o usuário aciona "Gerenciar filtros" THEN o sistema SHALL abrir o diálogo "Gerenciar filtros" com uma linha por filtro, na ordem alfabética, cada uma com o nome e os botões `Renomear <nome>` e `Excluir <nome>`.  <!-- SFILT-09 -->
2. WHEN o usuário aciona `Renomear <nome>` THEN a linha SHALL mostrar o campo com o nome atual selecionado e focado e os botões "Salvar nome" e "Cancelar".  <!-- SFILT-09 -->
3. WHEN o usuário confirma um nome válido (botão ou Enter) THEN o sistema SHALL renomear, mostrar o toast `Filtro renomeado para "<nome>"` e voltar a linha ao modo de leitura com o novo nome, e o menu SHALL mostrar o novo nome.  <!-- SFILT-09 -->
4. IF o novo nome é vazio, longo demais ou repetido THEN a linha SHALL mostrar a mensagem do armazenamento abaixo do campo (`role="alert"`, `aria-invalid="true"`), manter a edição e nada SHALL mudar; o nome só com caixa, acento ou espaços diferentes do próprio SHALL ser aceito.  <!-- SFILT-09 -->
5. WHEN o usuário aciona "Cancelar" ou Esc na edição THEN a edição SHALL terminar sem mudar o nome e o diálogo SHALL continuar aberto.  <!-- SFILT-09 -->
6. WHEN o usuário aciona `Excluir <nome>` THEN o sistema SHALL abrir a confirmação `Excluir o filtro "<nome>"?` com "Essa ação não pode ser desfeita.", "Cancelar" e "Excluir", sem excluir ainda.  <!-- SFILT-09 -->
7. WHEN o usuário confirma "Excluir" THEN o sistema SHALL excluir só esse filtro, fechar a confirmação, mostrar o toast `Filtro "<nome>" excluído` e tirar a linha da lista, e WHEN cancela SHALL manter o filtro.  <!-- SFILT-09 -->
8. IF renomear ou excluir falha por erro do armazenamento THEN o sistema SHALL mostrar o toast de erro com a mensagem do armazenamento, manter a edição ou a confirmação abertas e a lista SHALL ficar como estava.  <!-- SFILT-09 -->
9. IF o filtro não existe mais ao renomear ou excluir (apagado em outra aba) THEN o sistema SHALL mostrar o toast "Esse filtro não existe mais" e atualizar a lista.  <!-- SFILT-09 -->
10. WHILE não há filtros, o diálogo SHALL mostrar "Nenhum filtro salvo ainda".  <!-- SFILT-09 -->
11. WHEN o filtro aplicado é renomeado THEN o marcador SHALL continuar nele, e WHEN é excluído THEN os filtros e a página do extrato SHALL ficar como estavam e nenhum item SHALL ficar marcado.  <!-- SFILT-09 -->
12. WHEN o usuário fecha o diálogo THEN o foco SHALL voltar ao botão "Filtros salvos".  <!-- SFILT-09 -->

**Independent Test**: Salvar "A", abrir o gerenciador, renomear para "B" e ver o menu com "B"; excluir "B" e ver o estado vazio.

---

### P1: Montagem no extrato ⭐ MVP

**User Story**: Como usuário, quero os controles na seção de filtros, e que nada mais do extrato mude.

**Why P1**: Entrega a feature de ponta a ponta sem regressão.

**Acceptance Criteria**:

1. The seção "Filtros do extrato" SHALL ter os botões "Salvar filtro" e "Filtros salvos" depois do grupo do mês rápido, quando há usuário logado.  <!-- SFILT-10 -->
2. WHILE não há id de usuário, o extrato SHALL não renderizar "Salvar filtro" nem "Filtros salvos".  <!-- SFILT-10 -->
3. The salvar, listar, aplicar, renomear e excluir SHALL não enviar requisição à API além das consultas de lista e de resumo que qualquer mudança de filtro já causa.  <!-- SFILT-10 -->
4. WHEN o usuário aciona "Limpar filtros" THEN os filtros salvos SHALL continuar na lista.  <!-- SFILT-10 -->
5. WHEN o tamanho de página escolhido é 25 e um filtro é salvo e aplicado THEN o estado salvo SHALL não ter `pageSize` e a consulta aplicada SHALL manter `pageSize=25`.  <!-- SFILT-10 -->

**Independent Test**: Abrir o extrato com um usuário simulado e ver os dois botões depois do mês rápido; sem usuário, não vê.

---

### P2: Aparência e acessibilidade

**User Story**: Como usuário, quero menus e diálogos legíveis nos dois temas e operáveis por teclado.

**Why P2**: Os comportamentos acima já funcionam; esta é a garantia de acabamento (L-040).

**Acceptance Criteria**:

1. The diálogos "Salvar filtro" e "Gerenciar filtros" SHALL ter nome acessível (título) e descrição acessível, e o campo do nome SHALL ter rótulo "Nome do filtro".  <!-- SFILT-11 -->
2. The marcador do filtro aplicado SHALL não depender só da cor: SHALL ter ícone de visto e `font-medium` além do destaque de fundo.  <!-- SFILT-11 -->
3. The texto do menu, dos itens, do item aplicado e dos diálogos SHALL ter contraste de pelo menos 4,5:1 contra o seu fundo nos temas claro e escuro, medido na cor pintada em Chromium real.  <!-- SFILT-11 -->
4. The botões "Renomear <nome>" e "Excluir <nome>" SHALL ser `button` nativos com nome acessível que inclui o nome do filtro.  <!-- SFILT-11 -->

**Independent Test**: Abrir o menu e os diálogos numa página Vite descartável em Chromium e medir a cor pintada nos dois temas.

---

## Edge Cases

- IF o `localStorage` guarda `null`, um número ou texto vazio na chave THEN o menu SHALL mostrar o estado vazio sem erro.
- IF o filtro salvo tem `neutral: false` THEN aplicá-lo SHALL pôr "Neutra" em "Não" e enviar `neutral=false`, e o filtro com `neutral` ausente SHALL deixar "Neutra" em "Todas".
- IF dois filtros salvos têm o mesmo estado THEN os dois itens SHALL aparecer como aplicados enquanto o estado for igual.
- WHEN o nome tem espaços nas pontas (`"  Mês  "`) THEN o filtro SHALL ser guardado como `"Mês"`.
- WHEN o nome tem exatamente 40 caracteres THEN SHALL ser aceito, e com 41 SHALL falhar.
- IF o usuário salva com Enter duas vezes seguidas THEN o filtro SHALL ser guardado uma vez (a segunda tentativa já não encontra o diálogo ou vê o nome repetido).
- WHEN o filtro salvo tem busca e o usuário já digitou outro texto ainda dentro dos 300 ms THEN o campo SHALL mostrar a busca do filtro e a digitação anterior SHALL ser descartada.
- IF a conta salva existe mas está inativa THEN aplicá-la SHALL manter a conta (contas inativas contam como existentes).
- IF o usuário A sai e o usuário B entra no mesmo navegador THEN o menu SHALL mostrar só os filtros de B.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SFILT-01 | P1: Estado do filtro salvo | In Tasks | Implemented-not-verified |
| SFILT-02 | P1: Armazenamento tolerante | In Tasks | Implemented-not-verified |
| SFILT-03 | P1: Salvar, renomear e excluir no armazenamento | In Tasks | Implemented-not-verified |
| SFILT-04 | P1: Salvar, renomear e excluir no armazenamento | In Tasks | Implemented-not-verified |
| SFILT-05 | P1: Hook e usuário da sessão | In Tasks | Implemented-not-verified |
| SFILT-06 | P1: Salvar filtro | In Tasks | Pending |
| SFILT-07 | P1: Menu "Filtros salvos" e marcador | In Tasks | Pending |
| SFILT-08 | P1: Aplicar um filtro salvo | In Tasks | Pending |
| SFILT-09 | P1: Gerenciar filtros | In Tasks | Pending |
| SFILT-10 | P1: Montagem no extrato | In Tasks | Pending |
| SFILT-11 | P2: Aparência e acessibilidade | In Tasks | Pending |

**Coverage:** 11 total, 11 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] Salvar, aplicar, renomear e excluir funcionam de ponta a ponta no extrato com o mock e um usuário simulado, com o `localStorage` como único armazenamento e nenhuma requisição nova.
- [ ] A leitura sobrevive a JSON inválido, forma errada, versão diferente, campos desconhecidos ou inválidos, `localStorage` bloqueado e cota cheia, e dois usuários no mesmo navegador não veem os filtros um do outro, tudo por testes de unidade.
- [ ] Aplicar um filtro salvo substitui todos os controles e a consulta exata, volta à página 1 a partir da página 2 e mantém o tamanho de página.
- [ ] `TransactionsPage.tsx` termina com no máximo 765 linhas (hoje 740) e nenhum teste atual do extrato é enfraquecido.
- [ ] `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test` passam três vezes seguidas e uma vez com duas suítes em paralelo, sem arquivo novo falhando, e `pnpm -C api typecheck` segue passando sem tocar na API.
- [ ] Cada teste novo fica bem abaixo de 3 s sozinho (L-027) e cada guarda nova foi provada por uma mutação rápida num worktree temporário.
- [ ] No navegador, contra a API local: salvar um filtro, ver o menu, aplicar, renomear e excluir, nos temas claro e escuro e na largura de celular (conferência do dono, sem sessão dos agentes).
