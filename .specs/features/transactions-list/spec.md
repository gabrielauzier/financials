# Extrato: resumo e paginação (transactions-list) Specification

Origem: seção "F6 · transactions-list" e as decisões confirmadas do topo de `docs/v1/plano-melhoria-transacoes.md`, e os itens 1 a 7 de `docs/v1/melhoria-transacoes.md` (cartão de resumo, filtros rápidos nos valores e paginação). Escopo: `api/` (`GET /transactions/summary`, `pageSize` na listagem, fragmentos de investimento no módulo único de regras e `openapi.json`) e `web/` (tipos, mocks, `SummaryCard`, `Pagination`, `usePageSize` e a montagem no extrato). Sem migration: tudo se calcula sobre as tabelas existentes.

## Problem Statement

O extrato recebe 50 linhas por página, então somar o que está na tela daria o total só da página, e o usuário não vê quanto entrou, saiu e foi investido no filtro que escolheu. A paginação é só "Anterior" e "Próxima", sem como pular para uma página nem escolher quantas linhas ver. O resumo precisa vir do banco, com os mesmos filtros da lista e as mesmas regras do dashboard (AD-003), para não divergir de nenhum outro painel.

## Goals

- [ ] `GET /transactions/summary` aceita os mesmos filtros da listagem e devolve `count`, `income`, `expense`, `investments` e `balance` calculados no banco pelas regras do módulo único (`api/src/modules/dashboards/rules.ts`), em strings decimais com 2 casas, sem aritmética de dinheiro em ponto flutuante.
- [ ] Sem filtro, `income` e `expense` do resumo são iguais aos totais que as regras do dashboard dão para as mesmas linhas, verificado contra Postgres com um conjunto fixo que tem neutra, cartão, investimento, estorno, data futura e conta inativa.
- [ ] A listagem aceita `pageSize` opcional (25, 50 ou 100; outro valor é 422 com o campo `pageSize`) e devolve o `pageSize` usado; `api/openapi.json` descreve os dois contratos.
- [ ] O extrato mostra, entre os filtros e a lista, um cartão de resumo com a quantidade em destaque e receitas, despesas, investimentos e saldo vindos da API, com carregamento, erro com "Tentar novamente" e estado vazio (R$ 0,00), e que só consulta de novo quando um filtro muda (não quando só a página, a ordenação ou o tamanho da página mudam).
- [ ] Clicar em Receitas, Despesas ou Investimentos aplica o filtro rápido correspondente (clicar no valor ativo o remove) e Saldo é só texto.
- [ ] A paginação tem seletor de itens por página (25, 50 e 100, escolha guardada no navegador), "Anterior", "Próxima" e botões numerados com reticências, e substitui o rodapé atual sem engordar `TransactionsPage.tsx`.

## Out of Scope

Explicitamente excluído para evitar crescimento de escopo.

| Feature | Reason |
| ------- | ------ |
| Filtros salvos e qualquer uso de `pageSize` nele | Pertencem à F7; aqui só fica registrado que o tamanho da página não faz parte do estado de filtros |
| Mudar qualquer regra do dashboard ou qualquer rota `/dashboards/*` | O resumo reutiliza as regras; as consultas do dashboard continuam como estão (os testes delas têm de seguir passando) |
| Resumo por período, por categoria, por conta ou comparação com o período anterior | Não pedido; o resumo é um único conjunto de totais do filtro |
| Total da seleção de linhas, total só da página e média | Não pedido; o resumo é do filtro inteiro |
| Guardar `pageSize` no servidor, na URL ou sincronizá-lo entre abas e dispositivos | Decisão do dono: escolha guardada só no navegador |
| Campo "ir para a página N", rolagem infinita e atalhos de teclado de paginação | Não pedido; os botões numerados cobrem a navegação |
| Mudar o limite de 100 linhas ou aceitar outros tamanhos | Decisão do dono: 25, 50 e 100 |
| Filtro rápido por clique em Saldo | Decisão do dono: Saldo é texto, não clicável |
| Cache otimista do resumo ao editar uma transação | O resumo é recalculado pela API depois de cada mudança; calcular no front contraria o pedido |
| Índices novos no banco | A consulta é uma varredura filtrada como a da listagem; sem medição que justifique migration (riscos no design) |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida ou registrada aqui. As linhas marcadas "y" são decisões do dono; as demais são o padrão escolhido por esta spec.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Regras do resumo | Seguem exatamente as do dashboard: os fragmentos SQL de `rules.ts` (neutra, CreditCard, Investments à parte, Estorno abate despesa, data futura fora), reutilizados, nunca reescritos na rota; o guarda `rules.guard.test.ts` continua valendo sem exceção | AD-003 e decisão 1 do dono | y |
| O que `count` conta | Todas as linhas do filtro, inclusive neutras, de cartão, de Investments e de data futura: é o mesmo número que `total` da listagem para o mesmo filtro | Decisão do dono: a quantidade em destaque é o total de linhas do filtro | y |
| Data futura nos valores | `income`, `expense` e `investments` ignoram linhas com `occurred_at` depois de `now()`, como o dashboard; `count` as inclui | Decisão do dono (a) desta entrega, que prevalece sobre o rascunho do plano que as somava | y |
| `income` | Soma de `INCOME_VALUE` das linhas contáveis: Income que não é Reversal, sem neutra, sem CreditCard, sem Investments, sem data futura | Regra do dashboard (DASH-01) | y |
| `expense` | Soma de `EXPENSE_VALUE` das linhas contáveis: Expense integral, menos o Income da categoria Reversal; Reversal do tipo Expense é despesa normal. Pode ficar negativa quando só há estornos | Regra do dashboard; sem truncar em zero para o resumo bater com o dashboard | y |
| `investments` | Valor líquido das linhas da categoria Investments que passam as mesmas exclusões do dashboard (sem neutra, sem CreditCard, sem data futura): Expense soma (aporte) e Income subtrai (resgate); pode ser negativo. Nunca entra em `income`, `expense` nem `balance` | O dashboard ignora Investments; o pedido é um total separado. O sinal segue o precedente de `CARD_VALUE` (compra positiva, estorno negativo) | n |
| Fragmentos novos de investimento | `rules.ts` ganha `COUNTABLE_BASE` (sem neutra, sem CreditCard, sem data futura), `INVESTMENT_ROW` (base e categoria Investments) e `INVESTMENT_VALUE`; `COUNTABLE` passa a ser `COUNTABLE_BASE` e categoria diferente de Investments, com o mesmo significado de hoje | A chave `'Investments'` só pode aparecer em `rules.ts` (guarda de AD-003) | n |
| `balance` | `income - expense` calculado no SQL (numeric), pode ser negativo; não inclui `investments` | Decisão do dono | y |
| Formato do dinheiro | Cada valor é string decimal com exatamente 2 casas (`^-?\d+\.\d{2}$`), vinda de `sum` de `numeric(14,2)` com `coalesce(..., 0.00)` e convertida para texto no banco; nenhum `number` entra na conta (AD-004) | AD-004 | y |
| Resumo vazio | Sem linhas no filtro: `{ count: 0, income: "0.00", expense: "0.00", investments: "0.00", balance: "0.00" }`, com 200 | Pedido: zeros quando vazio | y |
| Rota | `GET /transactions/summary`, registrada pelo módulo `transactions`, autenticada como as demais (401 sem token ou com token inválido), por usuário via `withUser` (RLS, AD-002) | Pedido e AD-002 | y |
| Filtros aceitos | Exatamente `from`, `to`, `accountId`, `categoryId`, `type`, `neutral` e `q`, validados pela mesma `whereClause` da listagem (mesmos erros 422 `validation_error` com o campo); `sort`, `order`, `page` e `pageSize` não pertencem ao resumo e, se vierem, são ignorados como qualquer parâmetro fora do esquema | Pedido: mesmos filtros; reutilizar a cláusula garante a paridade | y |
| Período invertido (De depois de Até) | A API responde 200 com os zeros, como a listagem responde 200 com lista vazia | Paridade com a listagem | n |
| Fuso | `from` e `to` são dias locais do cabeçalho `X-Timezone` (padrão `America/Sao_Paulo`), como na listagem (AD-005); "data futura" usa o `now()` do banco | AD-005 | n |
| Contas inativas | As linhas de contas inativas contam em todos os valores e em `count`: a consulta usa a mesma junção da listagem e as regras não olham `accounts.active` | O extrato as mostra e o dashboard as soma | n |
| `pageSize` na listagem | Parâmetro opcional que só aceita o texto exato `25`, `50` ou `100`; ausente vale 50; qualquer outro valor (inclusive `0`, `10`, `101`, `abc`, vazio, `050`, `50.0`, ` 50`) é 422 `validation_error` com o campo `pageSize`; `page` continua com a regra atual | Decisão do dono; 422 como o `page` inválido (L-006: um único status para valor semântico inválido) | y |
| `pageSize` repetido na consulta | Dá a mesma resposta de `page` repetido (falha de esquema do Fastify, 400 `validation_error`) | O parâmetro é `string` no esquema como os demais da listagem; nenhum caso novo de status | n |
| Resposta da listagem | `pageSize` devolve o tamanho usado (25, 50 ou 100); o esquema de resposta deixa de ser `Literal(50)` e vira um inteiro com enum 25, 50 e 100; página fora do intervalo devolve `items: []`, o `total` e o `pageSize` | Pedido | y |
| Estabilidade entre páginas | A ordenação existente (coluna escolhida e `id` como desempate) vale para todo tamanho: as páginas de 25 formam, em sequência, o mesmo conjunto e a mesma ordem das de 50 e 100 | Páginas não repetem nem pulam linhas | n |
| `openapi.json` | Regenerado por `pnpm -C api openapi:export`; descreve `GET /transactions/summary` (consulta com os sete filtros e resposta com os cinco campos) e `pageSize` na consulta e na resposta da listagem (enum 25, 50, 100) | Contrato único (AD-001) | y |
| Tipos do web | `PageSize = 25 \| 50 \| 100`; `TransactionFilters.pageSize?: PageSize`; `TransactionsPage.pageSize: PageSize`; `TransactionSummary { count: number; income; expense; investments; balance: Money }` | Tipos acompanham o contrato | n |
| Mocks | O mock da listagem aceita `pageSize` (mesmo 422 de `pageSize` inválido) e o devolve; o mock do resumo reaplica os mesmos filtros e as regras do dashboard com aritmética de centavos inteiros (nunca float), e devolve os cinco campos | Mocks não podem mascarar divergência (AD-001) | n |
| Valor de `pageSize` na requisição do web | O web só envia `pageSize` quando é 25 ou 100; com 50 (padrão da API) o parâmetro é omitido | A API trata a ausência como 50; evita mudar a consulta de todo o fluxo existente e os testes que conferem os parâmetros exatos | n |
| Número de páginas | `Math.max(1, Math.ceil(total / pageSize))` com o `pageSize` que a API devolveu, não o escolhido no seletor | A API é a fonte do tamanho realmente usado | n |
| Chave de cache do resumo | `["transaction-summary", filtros]`, fora do prefixo `["transactions"]`, onde `filtros` são os filtros sem `sort`, `order`, `page` e `pageSize` | Mudar só página, ordem ou tamanho não pode refazer a consulta; e a atualização otimista de `["transactions"]` assume o formato de página e quebraria com o resumo no mesmo prefixo | n |
| Quando o resumo é refeito | Ao mudar qualquer filtro (De, Até, Conta, Categoria, Tipo, Neutra, busca, mês rápido) e depois de criar, editar, excluir ou recategorizar em lote (o hook invalida `["transaction-summary"]` junto de `["transactions"]`); não ao mudar só a página, a ordenação ou o tamanho | Pedido; os valores mudam com as edições | n |
| Período inválido (De depois de Até) | O cartão de resumo não é renderizado e não consulta, como a listagem fica sem consulta; o alerta existente continua | Evita mostrar valores de um filtro que o extrato não aplica | n |
| Valores nunca somados no front | O cartão mostra as strings da API formatadas por `formatBRL`; só testa sinal e zero por texto (`começa com "-"`, `0.00`) para escolher a cor; nenhuma soma, subtração ou `Number` sobre dinheiro; a contagem é exibida como veio | AD-004 e pedido | y |
| Estados do cartão | Carregando: esqueleto com `role="status"` e nome "Carregando resumo". Erro: texto "Não foi possível carregar o resumo." e botão "Tentar novamente" que refaz só a consulta do resumo. Vazio: `count` 0 com os quatro valores "R$ 0,00" como a API devolveu. O erro do resumo não esconde a lista nem o contrário | Pedido | y |
| Estrutura do cartão | `<section aria-label="Resumo do extrato">` entre a seção de filtros e a lista, com a quantidade em destaque (fonte grande, número sozinho num elemento e o texto "transação" para 1 ou "transações" para qualquer outro número, o 0 inclusive, em outro) e os quatro valores em fonte menor, cada um com seu rótulo: "Receitas", "Despesas", "Investimentos" e "Saldo". A quantidade usa o separador de milhar de pt-BR | Pedido; o plural de 0 é "transações" | n |
| Cores | Receitas: `text-emerald-700 dark:text-emerald-400`. Despesas: `text-red-700 dark:text-red-400`. Investimentos: `text-blue-700 dark:text-blue-400`. Saldo: as classes de receitas quando positivo, de despesas quando negativo e `text-foreground` quando `0.00`. O fundo do cartão é `bg-card`; as classes ficam num módulo (`summaryStyles.ts`) e um teste calcula o contraste de cada uma contra `--card` do tema (claro e escuro) a partir de `tailwindcss/theme.css` e `styles.css`, com mínimo de 4,5:1 e matiz verde, vermelho e azul | Pedido (cores distintas por tipo e por sinal); aqui não há CSS de biblioteca sem camada (diferente do sonner, L-040), mas o teste pega a cor calculada | n |
| Destaque do valor ativo | Receitas, Despesas e Investimentos são `<button type="button" aria-pressed>`: `aria-pressed="true"` e anel (`ring-2 ring-ring`) enquanto o filtro correspondente está aplicado; o anel não troca a cor do texto nem o fundo, então o contraste não muda | Pedido: valor ativo destacado; botão nativo opera por Tab, Enter e Espaço | n |
| Clique em Receitas | Aplica `type=Income`; se `type` já é `Income`, remove o filtro; se for `Expense`, troca para `Income`; sempre volta à página 1 e preserva os demais filtros e a ordenação | Pedido | y |
| Clique em Despesas | Aplica `type=Expense` com as mesmas regras de Receitas | Pedido | y |
| Clique em Investimentos | Aplica `categoryId` da categoria de sistema com `key === "Investments"`, resolvida da lista de categorias em cache (`useCategories`), nunca pelo nome; se `categoryId` já é essa, remove; se for outra categoria, troca; volta à página 1 | Pedido; a chave não muda quando o usuário renomeia a categoria | y |
| Investimentos sem categoria resolvida | Enquanto a lista de categorias carrega, falha ou não tem a categoria de chave `Investments`, o valor de Investimentos aparece como texto, sem botão | Não há id para filtrar | n |
| Saldo | Texto sem botão, sem `aria-pressed` e sem handler | Decisão do dono | y |
| Controles de paginação | `<nav aria-label="Paginação do extrato">` com o texto `{total} transações · Página {página} de {páginas}` (o texto do rodapé atual, preservado), o seletor "Itens por página", o botão "Anterior", os botões numerados e o botão "Próxima" | Os testes atuais e o pedido | n |
| Lista de números (`pageNumbers(atual, total)`) | Função pura que devolve números e `"…"`: até 7 páginas, todas; com mais de 7, sempre 7 posições: atual ≤ 4 devolve `1 2 3 4 5 … total`; atual ≥ total − 3 devolve `1 … total−4 … total`; senão `1 … atual−1 atual atual+1 … total`; `total` menor que 1 vale 1 e `atual` fora de 1..total é limitada | Primeira, última, vizinhas da atual e reticências, com largura fixa que não pula de tamanho ao navegar | n |
| Botões numerados | Cada página é um botão com texto igual ao número e nome acessível `Página N`; a atual tem `aria-current="page"` e variante preenchida; as reticências são `<span>` sem papel de botão (`aria-hidden`); clicar na atual não dispara nada | Pedido: atual marcada | n |
| "Anterior" e "Próxima" | `disabled` na primeira e na última página, respectivamente; clicar muda a página em 1 | Pedido | y |
| Layout móvel | Abaixo de 640 px (`sm`) os botões numerados ficam escondidos (`hidden sm:flex`) e ficam visíveis o texto "Página X de Y", o seletor, "Anterior" e "Próxima"; a barra quebra linha (`flex-wrap`) e os botões têm no mínimo 36 px (`min-h-9 min-w-9`) | Pedido: amigável ao celular, sem rolagem horizontal | n |
| Quando a paginação aparece | Só quando `total > 0` (como o rodapé de hoje); com a lista carregando a nova página ela some e volta, como hoje | Mantém o comportamento existente | n |
| Seletor de itens por página | `Select` do app com rótulo visível "Itens por página" e as opções "25", "50" e "100", nessa ordem; o valor mostrado é o escolhido | Pedido; L-024: lista de opções exata | y |
| Guardar o tamanho | Chave `financials:transactions:page-size` do `localStorage` com o texto `25`, `50` ou `100`; leitura e escrita em `try/catch`; valor guardado inválido (qualquer outro texto, vazio, nulo) ou `localStorage` que lança ao ler vale 50; escrita que falha não impede a troca do tamanho na sessão | Decisão do dono; `localStorage` pode estar bloqueado | y |
| Trocar o tamanho | Volta à página 1, consulta com o novo tamanho e esvazia a seleção de linhas; não refaz o resumo; "Limpar filtros" não troca o tamanho | Pedido; o tamanho não é filtro | y |
| Tamanho fora do estado de filtros | `pageSize` não entra em `FilterState`, `filters` nem em `summaryFilters`; a página o junta à consulta da listagem no ponto de uso | Decisão do dono: não faz parte dos filtros salvos (F7) | y |
| Tamanho da página do arquivo | `TransactionsPage.tsx` só importa e usa `SummaryCard`, `Pagination` e `usePageSize` e perde o rodapé; nenhum componente novo cresce dentro dele | Pedido: não engordar o arquivo de 741 linhas | y |
| Lições aplicadas | L-004/L-006 (status e igualdade definidos acima), L-013 e L-024 (texto em português e opções exatas), L-014 e L-015 (linhas nas bordas e só futuras no resumo), L-021 e L-041 (todo reset de página parte da página 2), L-020 e L-027 (relógio e temporizadores falsos, nenhuma espera fixa, nenhum timeout aumentado, cada teste novo bem abaixo de 3 s sozinho), L-023 (conteúdo do OpenAPI afirmado), L-034 (nenhuma migration; nada a reaplicar), L-039 (caixa de conferência manual só marcada com o registro), L-040 (cor pintada conferida) | Lições confirmadas e candidatas relevantes | n |
| Dimensões implícitas | Validação e limites: pageSize e filtros acima. Falha: erro do resumo isolado da lista, tamanho guardado inválido. Idempotência e retentativa: o resumo é uma leitura, "Tentar novamente" repete. Autorização: 401 e RLS. Concorrência e ordem: lista e resumo são duas leituras; se uma edição ocorre entre elas os números diferem por um instante e a invalidação os realinha (aceito). Ciclo de vida e expiração: N/A porque nada novo é guardado no servidor e a chave do navegador não expira. Observabilidade: N/A porque a rota segue o log padrão do Fastify. Dependência externa: N/A porque só há o Postgres. Transição de estado: o filtro ativo alterna entre aplicado e removido (acima) | Varredura de dimensões da Specify | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Resumo do filtro na API ⭐ MVP

**User Story**: Como usuário, quero que a API me dê os totais do conjunto filtrado, calculados pelas regras do dashboard, para o extrato mostrar quanto entrou, saiu e foi investido sem somar página a página.

**Why P1**: Base do cartão; sem a rota não há resumo confiável (somar no front daria só o total da página).

**Acceptance Criteria**:

1. WHEN um usuário autenticado chama `GET /transactions/summary` THEN a API SHALL responder 200 com exatamente os campos `count` (inteiro), `income`, `expense`, `investments` e `balance` (strings decimais com 2 casas).  <!-- TLIST-01 -->
2. IF a chamada não tem token ou tem token inválido THEN a API SHALL responder 401.  <!-- TLIST-01 -->
3. The API SHALL calcular o resumo só com as transações do usuário autenticado, sem somar as de outro usuário.  <!-- TLIST-01 -->
4. WHEN o resumo é pedido sem filtro THEN `count` SHALL ser igual ao `total` da listagem sem filtro.  <!-- TLIST-02 -->
5. WHEN o resumo é pedido com `from`, `to`, `accountId`, `categoryId`, `type`, `neutral` ou `q` THEN a API SHALL aplicar o filtro com a mesma semântica da listagem (dias locais de `X-Timezone`, busca sem diferenciar caixa e acento, todos combinados com E) e `count` SHALL ser igual ao `total` da listagem com o mesmo filtro.  <!-- TLIST-02 -->
6. IF um filtro do resumo tem valor inválido (`type`, `neutral`, `from`, `to`, `accountId` ou `categoryId` mal formados) THEN a API SHALL responder 422 `validation_error` com o campo do filtro, como a listagem.  <!-- TLIST-02 -->
7. IF a chamada traz `sort`, `order`, `page` ou `pageSize` THEN a API SHALL ignorá-los e devolver o mesmo resumo que sem eles.  <!-- TLIST-02 -->
8. WHEN o conjunto filtrado não tem linhas THEN a API SHALL responder 200 com `count` 0 e `income`, `expense`, `investments` e `balance` iguais a `"0.00"`.  <!-- TLIST-03 -->
9. The API SHALL calcular `income` somando as linhas contáveis que são Income e não são da categoria Reversal, e `expense` somando as Expense e subtraindo as Income da categoria Reversal, com as regras de `rules.ts`.  <!-- TLIST-03 -->
10. The API SHALL excluir de `income`, `expense` e `investments` as linhas neutras, as de pagamento CreditCard e as com data posterior a agora, e de `income` e `expense` também as da categoria Investments, sem excluí-las de `count`.  <!-- TLIST-03 -->
11. The API SHALL calcular `investments` como a soma das Expense menos a soma das Income das linhas contáveis da categoria Investments, e SHALL não incluí-lo em `balance`.  <!-- TLIST-03 -->
12. The API SHALL calcular `balance` no banco como `income` menos `expense`, com sinal quando negativo.  <!-- TLIST-03 -->
13. The API SHALL calcular e formatar os valores no banco, sem converter dinheiro para `number`, de modo que 0,10 mais 0,20 some exatamente `"0.30"`.  <!-- TLIST-03 -->
14. WHEN o resumo é pedido sem filtro sobre um conjunto fixo com neutra, CreditCard, Investments, Reversal Income, Reversal Expense, data futura e conta inativa THEN `income` e `expense` SHALL ser iguais aos totais das regras do dashboard (`INCOME_VALUE`, `EXPENSE_VALUE` sobre `COUNTABLE`) para as mesmas linhas.  <!-- TLIST-04 -->
15. WHEN o conjunto fixo é filtrado por tipo, por categoria, por conta (ativa e inativa), por neutra, por período e por busca THEN `count`, `income`, `expense`, `investments` e `balance` SHALL ser iguais aos valores esperados das regras da spec para as linhas que o filtro seleciona.  <!-- TLIST-04 -->
16. IF todas as linhas do usuário têm data futura THEN o resumo SHALL devolver `income`, `expense`, `investments` e `balance` zerados e `count` igual ao número de linhas.  <!-- TLIST-04 -->
17. The API SHALL não conter a chave `Investments`, `Reversal` ou `CreditCard` em SQL fora de `rules.ts`.  <!-- TLIST-04 -->

**Independent Test**: Semear o conjunto fixo, chamar `GET /transactions/summary` sem filtro e comparar com os totais das regras; repetir com `type=Expense`.

---

### P1: Tamanho da página na API ⭐ MVP

**User Story**: Como usuário, quero escolher quantas linhas a listagem devolve por página.

**Why P1**: A paginação do front depende do parâmetro e de saber o tamanho realmente usado.

**Acceptance Criteria**:

1. WHEN `GET /transactions` não traz `pageSize` THEN a API SHALL devolver até 50 itens e `pageSize` igual a 50.  <!-- TLIST-05 -->
2. WHEN `GET /transactions` traz `pageSize` igual a `25`, `50` ou `100` THEN a API SHALL devolver até esse número de itens por página, a página pedida, o mesmo `total` e `pageSize` igual ao valor usado.  <!-- TLIST-05 -->
3. IF `pageSize` é qualquer outro valor (`0`, `10`, `101`, `abc`, vazio, `050`, `50.0`, ` 50`) THEN a API SHALL responder 422 `validation_error` com o campo `pageSize` e não consultar a lista.  <!-- TLIST-05 -->
4. WHEN a página pedida passa do fim com qualquer tamanho THEN a API SHALL devolver `items` vazio, o `total` e o `pageSize` usado.  <!-- TLIST-05 -->
5. WHILE a ordenação é a mesma, as páginas de 25, de 50 e de 100 linhas SHALL formar o mesmo conjunto na mesma ordem, sem repetir nem pular linhas, mesmo com instantes iguais.  <!-- TLIST-05 -->
6. WHEN `pageSize` e os filtros vêm juntos THEN a API SHALL aplicar o tamanho sobre o conjunto filtrado e ordenado.  <!-- TLIST-05 -->
7. The `api/openapi.json` SHALL descrever `GET /transactions/summary` com os sete filtros na consulta e os cinco campos na resposta, e `pageSize` na consulta e na resposta de `GET /transactions` com o enum 25, 50 e 100.  <!-- TLIST-06 -->

**Independent Test**: Listar com `pageSize=25` e ver 25 itens e `pageSize: 25`; com `pageSize=30` ver 422 no campo `pageSize`.

---

### P1: Tipos e mocks do web ⭐ MVP

**User Story**: Como desenvolvedor, quero que tipos e mocks do web sigam o contrato novo, para as telas e os testes não esconderem divergência.

**Why P1**: O cartão e a paginação são construídos e testados sobre os mocks.

**Acceptance Criteria**:

1. The `TransactionsPage` e `TransactionFilters` do web SHALL ter `pageSize` com o tipo `25 | 50 | 100` e `TransactionSummary` SHALL ter `count` numérico e os quatro valores como string decimal.  <!-- TLIST-07 -->
2. WHEN o mock da listagem recebe `pageSize` 25 ou 100 THEN ele SHALL devolver até esse número de itens e `pageSize` igual ao valor, e WHEN não recebe SHALL devolver até 50 e `pageSize` 50.  <!-- TLIST-07 -->
3. IF o mock da listagem recebe `pageSize` fora de 25, 50 e 100 THEN ele SHALL falhar com 422 `validation_error` no campo `pageSize`.  <!-- TLIST-07 -->
4. WHEN o mock do resumo recebe filtros THEN ele SHALL aplicar os mesmos filtros da listagem e as regras do dashboard (neutra, CreditCard, Investments à parte, Reversal, data futura) e devolver os cinco campos com 2 casas calculados com centavos inteiros, sem ponto flutuante.  <!-- TLIST-07 -->
5. WHEN `sort`, `order`, `page` ou `pageSize` vêm no resumo do mock THEN ele SHALL ignorá-los.  <!-- TLIST-07 -->

**Independent Test**: Pedir ao mock `GET /transactions?pageSize=25` e `GET /transactions/summary?type=Income` e conferir contra os valores semeados.

---

### P1: Cartão de resumo no extrato ⭐ MVP

**User Story**: Como usuário, quero ver, entre os filtros e a lista, quantas transações o filtro tem e quanto entrou, saiu e foi investido.

**Why P1**: É o pedido central da melhoria.

**Acceptance Criteria**:

1. WHEN o resumo carrega THEN o cartão SHALL mostrar a quantidade em destaque e os valores de Receitas, Despesas, Investimentos e Saldo exatamente como a API devolveu, formatados em reais (por exemplo `"1234.56"` vira "R$ 1.234,56" e `"-50.00"` vira "-R$ 50,00").  <!-- TLIST-08 -->
2. The cartão SHALL ficar entre a seção de filtros e a lista, com Receitas em verde, Despesas em vermelho, Investimentos em azul e Saldo em verde quando positivo, em vermelho quando negativo e na cor do texto quando `"0.00"`, os valores em fonte menor que a quantidade.  <!-- TLIST-08 -->
3. WHEN a quantidade é 1 THEN o cartão SHALL mostrar o texto "transação", e WHEN é 0 ou maior que 1 SHALL mostrar "transações", com o separador de milhar de pt-BR (1234 vira "1.234").  <!-- TLIST-08 -->
4. WHILE o resumo carrega, o cartão SHALL mostrar um esqueleto com o nome acessível "Carregando resumo" e SHALL não mostrar valores.  <!-- TLIST-08 -->
5. IF a consulta do resumo falha THEN o cartão SHALL mostrar "Não foi possível carregar o resumo." e o botão "Tentar novamente", e WHEN o usuário o aciona THEN o sistema SHALL repetir só a consulta do resumo, sem refazer a da lista.  <!-- TLIST-08 -->
6. WHEN o filtro não tem transações THEN o cartão SHALL mostrar a quantidade 0 e Receitas, Despesas, Investimentos e Saldo como "R$ 0,00".  <!-- TLIST-08 -->
7. IF a consulta do resumo falha THEN a lista SHALL continuar sendo exibida, e IF a da lista falha THEN o cartão SHALL continuar sendo exibido.  <!-- TLIST-08 -->
8. WHEN o extrato abre THEN o sistema SHALL consultar `GET /transactions/summary` com os filtros iniciais (nenhum), e WHEN o usuário muda De, Até, Conta, Categoria, Tipo, Neutra, a busca ou o mês rápido THEN o sistema SHALL consultar o resumo de novo com os parâmetros desse filtro.  <!-- TLIST-09 -->
9. WHEN muda só a página, só a ordenação ou só o tamanho da página THEN o sistema SHALL não consultar `GET /transactions/summary` de novo.  <!-- TLIST-09 -->
10. The consulta do resumo SHALL levar os filtros ativos e SHALL não levar `sort`, `order`, `page` nem `pageSize`.  <!-- TLIST-09 -->
11. WHEN uma transação é criada, editada, excluída ou recategorizada em lote THEN o sistema SHALL refazer a consulta do resumo.  <!-- TLIST-09 -->
12. The cartão SHALL mostrar os valores da API sem somá-los, e SHALL manter os valores da API mesmo quando a lista mostrada tem outra soma (a lista tem só uma página).  <!-- TLIST-09 -->
13. WHILE o período está invertido (De depois de Até), o extrato SHALL não renderizar o cartão e SHALL não consultar o resumo.  <!-- TLIST-09 -->
14. The cores de Receitas, Despesas e Investimentos e as do Saldo SHALL ter contraste de pelo menos 4,5:1 contra o fundo do cartão nos temas claro e escuro, calculado dos valores do tema, e matizes verde, vermelho e azul distintos.  <!-- TLIST-11 -->

**Independent Test**: Abrir o extrato com o mock, ver a quantidade e os quatro valores da API; mudar o Tipo e ver a nova consulta do resumo; ir para a página 2 e ver que nenhuma consulta de resumo saiu.

---

### P1: Filtro rápido pelos valores ⭐ MVP

**User Story**: Como usuário, quero clicar em Receitas, Despesas ou Investimentos para filtrar o extrato por aquilo, e clicar de novo para tirar o filtro.

**Why P1**: Pedido do item 4 do plano e da melhoria; reaproveita o estado de filtros.

**Acceptance Criteria**:

1. WHEN o usuário aciona Receitas THEN o sistema SHALL aplicar o filtro de tipo Receita (`type=Income`), voltar à página 1 e manter os demais filtros e a ordenação.  <!-- TLIST-10 -->
2. WHEN o usuário aciona Despesas THEN o sistema SHALL aplicar o filtro de tipo Despesa (`type=Expense`), voltar à página 1 e manter os demais filtros e a ordenação.  <!-- TLIST-10 -->
3. WHEN o usuário aciona Investimentos THEN o sistema SHALL aplicar o filtro de categoria com o `id` da categoria de sistema de chave `Investments`, resolvido da lista de categorias em cache, voltar à página 1 e manter os demais filtros e a ordenação.  <!-- TLIST-10 -->
4. WHILE o filtro de tipo é Receita, o botão Receitas SHALL ter `aria-pressed="true"`; WHILE é Despesa, o botão Despesas; WHILE o filtro de categoria é a de Investments, o botão Investimentos; e os demais SHALL ter `aria-pressed="false"`.  <!-- TLIST-10 -->
5. WHEN o usuário aciona um valor cujo filtro já está ativo THEN o sistema SHALL remover só aquele filtro (`type` ou `categoryId`), voltar à página 1 e manter os demais filtros e a ordenação.  <!-- TLIST-10 -->
6. WHEN o filtro de tipo é Despesa e o usuário aciona Receitas THEN o sistema SHALL trocar o tipo para Receita, e a categoria de outro filtro SHALL ser trocada pela de Investments ao acionar Investimentos.  <!-- TLIST-10 -->
7. The botões Receitas, Despesas e Investimentos SHALL ser `button` nativos, focáveis e acionáveis por Tab, Enter e Espaço, e Saldo SHALL ser texto sem botão.  <!-- TLIST-10 -->
8. WHEN o filtro de tipo ou de categoria é aplicado pelo clique THEN o controle "Tipo" ou "Categoria" da seção de filtros SHALL mostrar o mesmo valor e o "x" daquele filtro SHALL aparecer.  <!-- TLIST-10 -->
9. IF a lista de categorias não carregou ou não tem a categoria de chave `Investments` THEN o valor de Investimentos SHALL ser exibido como texto, sem botão.  <!-- TLIST-10 -->
10. WHEN a categoria de sistema Investments foi renomeada pelo usuário THEN Investimentos SHALL continuar aplicando o `id` dela, porque a resolução é pela chave.  <!-- TLIST-10 -->

**Independent Test**: Ir para a página 2, acionar Despesas e ver a consulta com `type=Expense&page=1`; acionar de novo e ver a consulta sem `type`.

---

### P1: Paginação com botões numerados ⭐ MVP

**User Story**: Como usuário, quero pular para uma página, andar para a anterior e a próxima e escolher quantas linhas ver por página.

**Why P1**: Pedido central; hoje só há "Anterior" e "Próxima".

**Acceptance Criteria**:

1. The função `pageNumbers(atual, total)` SHALL devolver, para `total` de 1 a 7, todas as páginas de 1 a `total`.  <!-- TLIST-12 -->
2. The função `pageNumbers` SHALL devolver, para `total` maior que 7 e `atual` de 1 a 4, `[1, 2, 3, 4, 5, "…", total]`.  <!-- TLIST-12 -->
3. The função `pageNumbers` SHALL devolver, para `total` maior que 7 e `atual` de `total - 3` ao fim, `[1, "…", total-4, total-3, total-2, total-1, total]`.  <!-- TLIST-12 -->
4. The função `pageNumbers` SHALL devolver, para `total` maior que 7 e `atual` entre 5 e `total - 4`, `[1, "…", atual-1, atual, atual+1, "…", total]`.  <!-- TLIST-12 -->
5. IF `total` é menor que 1 ou `atual` está fora de 1 a `total` THEN a função `pageNumbers` SHALL tratar `total` como 1 e limitar `atual` ao intervalo.  <!-- TLIST-12 -->
6. WHEN o extrato mostra uma página com total maior que 0 THEN a paginação SHALL mostrar o texto "{total} transações · Página {página} de {páginas}", "Anterior", os botões numerados conforme `pageNumbers` e "Próxima".  <!-- TLIST-13 -->
7. The botão da página atual SHALL ter `aria-current="page"` e os demais SHALL não ter o atributo, e as reticências SHALL não ser botões.  <!-- TLIST-13 -->
8. WHILE a página atual é a primeira, "Anterior" SHALL estar desabilitado, e WHILE é a última, "Próxima" SHALL estar desabilitado.  <!-- TLIST-13 -->
9. WHEN o usuário aciona "Anterior", "Próxima" ou um botão numerado THEN o sistema SHALL consultar a página correspondente, mantendo os filtros, a ordenação e o tamanho.  <!-- TLIST-13 -->
10. WHEN o total tem uma única página THEN a paginação SHALL mostrar só o botão "1" e os dois botões de navegação desabilitados.  <!-- TLIST-13 -->
11. WHILE a largura é menor que 640 px, a paginação SHALL esconder os botões numerados e manter o texto "Página X de Y", o seletor, "Anterior" e "Próxima"; WHILE é maior, SHALL mostrar os numerados.  <!-- TLIST-13 -->
12. The paginação SHALL calcular o número de páginas com o `pageSize` devolvido pela API.  <!-- TLIST-15 -->
13. WHILE o total é 0, o extrato SHALL não mostrar a paginação.  <!-- TLIST-15 -->
14. WHEN o extrato abre sem tamanho guardado THEN o sistema SHALL consultar sem `pageSize` (50 por página) e o seletor "Itens por página" SHALL mostrar 50.  <!-- TLIST-14 -->
15. The seletor "Itens por página" SHALL ter exatamente as opções 25, 50 e 100, nessa ordem.  <!-- TLIST-14 -->
16. WHEN o usuário escolhe 25 ou 100 THEN o sistema SHALL consultar com `pageSize=25` ou `pageSize=100` na página 1, mantendo os filtros e a ordenação, guardar o valor no navegador e esvaziar a seleção de linhas; WHEN escolhe 50 SHALL consultar sem `pageSize`.  <!-- TLIST-14 -->
17. WHEN o usuário está na página 2 ou mais e troca o tamanho THEN a consulta SHALL ir para a página 1.  <!-- TLIST-14 -->
18. WHEN o extrato abre e o navegador tem 25 ou 100 guardado THEN o sistema SHALL consultar já com esse tamanho e o seletor SHALL mostrá-lo.  <!-- TLIST-14 -->
19. IF o valor guardado é inválido (texto fora de 25, 50 e 100, vazio ou nulo), ou ler o `localStorage` lança erro THEN o sistema SHALL usar 50.  <!-- TLIST-14 -->
20. IF gravar no `localStorage` lança erro THEN o sistema SHALL trocar o tamanho mesmo assim na sessão, sem erro na tela.  <!-- TLIST-14 -->
21. The tamanho da página SHALL não fazer parte do estado de filtros: "Limpar filtros" SHALL manter o tamanho escolhido e nenhum filtro guarda `pageSize`.  <!-- TLIST-14 -->

**Independent Test**: Com 120 transações e tamanho 50, ver "Página 1 de 3" e botões 1 2 3; escolher 25 e ver "Página 1 de 5" e a consulta com `pageSize=25&page=1`; recarregar e ver 25 guardado.

---

## Edge Cases

- IF o filtro tem 1 transação THEN o cartão SHALL mostrar "transação" no singular e a paginação SHALL mostrar a página 1 de 1.
- IF Investimentos tem valor líquido negativo (mais resgates que aportes) THEN o cartão SHALL mostrá-lo com sinal ("-R$ ...") em azul, e o Saldo não o inclui.
- IF a Despesa é negativa (só estornos no filtro) THEN o cartão SHALL mostrá-la com sinal e em vermelho, e o Saldo SHALL ser positivo.
- WHEN a quantidade de linhas do filtro é maior que a soma contável THEN o cartão SHALL mostrar a quantidade total (inclui neutras, de cartão, de Investments e futuras) e os valores só das linhas contáveis.
- WHEN o usuário está na página 3 de 50 e muda o filtro para um que tem 1 página THEN o extrato SHALL consultar a página 1 (a regra de página 1 de cada filtro já existe) e a paginação SHALL mostrar a página 1 de 1.
- IF a página pedida é maior que o número de páginas (por exemplo, trocar o tamanho de 25 para 100 estando na página 5) THEN o extrato SHALL ter voltado à página 1 por causa da troca, e a API SHALL, para uma página fora do intervalo, devolver itens vazios com o `total`.
- WHEN o `total` muda de 120 para 0 por um filtro THEN o cartão SHALL mostrar o estado vazio e a paginação SHALL sumir.
- IF o `localStorage` guarda `"25"` com espaços ou `"25.0"` THEN o sistema SHALL usar 50 (só o texto exato vale).
- WHEN o `total` é exatamente múltiplo do tamanho (50 de 50, 100 de 100) THEN a paginação SHALL mostrar 1 página; com 51 de 50 SHALL mostrar 2.
- IF a rota de resumo recebe o mesmo parâmetro de filtro repetido THEN a API SHALL responder como a listagem (400 `validation_error`).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| TLIST-01 | P1: Resumo do filtro na API | In Tasks | Pending |
| TLIST-02 | P1: Resumo do filtro na API | In Tasks | Pending |
| TLIST-03 | P1: Resumo do filtro na API | In Tasks | Pending |
| TLIST-04 | P1: Resumo do filtro na API | In Tasks | Pending |
| TLIST-05 | P1: Tamanho da página na API | In Tasks | Pending |
| TLIST-06 | P1: Tamanho da página na API | In Tasks | Pending |
| TLIST-07 | P1: Tipos e mocks do web | In Tasks | Pending |
| TLIST-08 | P1: Cartão de resumo no extrato | In Tasks | Pending |
| TLIST-09 | P1: Cartão de resumo no extrato | In Tasks | Pending |
| TLIST-10 | P1: Filtro rápido pelos valores | In Tasks | Pending |
| TLIST-11 | P1: Cartão de resumo no extrato | In Tasks | Pending |
| TLIST-12 | P1: Paginação com botões numerados | In Tasks | Pending |
| TLIST-13 | P1: Paginação com botões numerados | In Tasks | Pending |
| TLIST-14 | P1: Paginação com botões numerados | In Tasks | Pending |
| TLIST-15 | P1: Paginação com botões numerados | In Tasks | Pending |

**Coverage:** 15 total, 15 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `GET /transactions/summary` devolve os cinco campos para o conjunto fixo, com `income` e `expense` iguais aos totais das regras do dashboard e o `count` igual ao `total` da listagem, verificado por teste de integração contra o Postgres local.
- [ ] A listagem aceita 25, 50 e 100, rejeita qualquer outro valor com 422 no campo `pageSize` e devolve o tamanho usado, e o `openapi.json` descreve os dois contratos.
- [ ] O cartão mostra os valores da API (nunca somados no front), refaz a consulta só quando um filtro muda, e as cores têm contraste de pelo menos 4,5:1 nos dois temas.
- [ ] Receitas, Despesas e Investimentos aplicam e removem o filtro certo e voltam à página 1; Saldo é texto.
- [ ] A paginação mostra números com reticências conforme a função pura, marca a atual com `aria-current`, desabilita as pontas e guarda o tamanho no navegador com queda para 50.
- [ ] `pnpm -C api typecheck && pnpm -C api lint && pnpm -C api test` e `yarn --cwd web typecheck && yarn --cwd web lint && yarn --cwd web test` passam três vezes seguidas, sem aviso novo de lint.
- [ ] No navegador, contra a API local: ver o cartão com os valores, clicar em cada valor, trocar o tamanho da página e navegar pelos botões, nos temas claro e escuro e na largura de celular (conferência do dono, sem sessão dos agentes).
