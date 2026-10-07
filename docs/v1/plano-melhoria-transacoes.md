# Plano: melhoria nas transações

Fonte: `docs/v1/melhoria-transacoes.md` (7 itens + 4 ajustes finos "v2"). Cada item foi conferido contra o código atual do extrato (`web/src/features/transactions/TransactionsPage.tsx`, 717 linhas) e da API (`api/src/modules/transactions/routes.ts`). Branch de trabalho: `feat/transactions-filters`, criada a partir de `main` (que já contém a pilha anterior).

## O que o código mostra

| Item | Situação atual |
| ---- | -------------- |
| Filtros salvos | Não existem. Os filtros vivem num estado único (`filters` + `quick`) e viram query string da API. Só front. |
| Resumo dos filtrados | Não existe. O extrato recebe 50 linhas por página, então somar no front daria o total só da página. Precisa de uma consulta no banco com os mesmos filtros. |
| Paginação | A API fixa `PAGE_SIZE = 50` (`pageSize: Literal(50)`). Hoje há só "Anterior/Próxima" e o texto "Página X de Y". Falta o controle de itens por página e os botões numerados. Precisa de um parâmetro novo na API. |
| Identificadores no modal | A API devolve o `id`, mas **não devolve o `identifier`** externo. Precisa expor o campo (somente leitura). |
| Toasts coloridos | O `Toaster` é o do shadcn sem cores por tipo. Basta `richColors`/classes por tipo. Só front. |
| Limpar filtro individual | Hoje só existe "Limpar filtros" (todos). Só front. |
| Dia da semana | Só front, mas exige cuidado com fuso: o dia da semana tem que vir da data **local** da transação (mesma regra do extrato), nunca de `new Date("YYYY-MM-DD")`. |

## Decisões (confirmadas pelo dono em 2026-10-06)

1. Resumo: **mesmas regras do dashboard**, sem exceções (inclui a regra de data futura fora). A quantidade em destaque é o total de linhas do filtro.
2. **Saldo não é clicável**, só texto. Entradas, saídas e investimentos aplicam filtro rápido.
3. Itens por página: 25, 50 (inicial) e 100, escolha salva no navegador, limite de 100 também na API.
4. Filtro salvo: todos os filtros do extrato, sem página e sem itens por página, só no navegador.

Texto original das propostas:

1. **Quais linhas entram no resumo.** Padrão proposto: as mesmas regras do dashboard, aplicadas sobre as transações filtradas (módulo único de regras, AD-003): receitas = Income que não seja Investments nem Estorno; despesas = Expense (menos Estorno), Investments somados à parte; neutras e compras de cartão ficam fora dos valores (como no dashboard), mas **a quantidade total em destaque conta todas as linhas do filtro**. O resumo também ignora a regra "data futura fora" do dashboard, porque o extrato mostra lançamentos futuros. Confirma? A alternativa é somar tudo que aparece na lista, sem exceções, o que faria o resumo divergir do dashboard.
2. **Clique em "Saldo".** O texto diz que cada valor aplica um filtro rápido. Para Entradas → tipo Receita, Saídas → tipo Despesa, Investimentos → categoria Investments. Padrão proposto para Saldo: remover os filtros de tipo e categoria (volta a mostrar tudo, mantendo datas e demais filtros). Serve?
3. **Itens por página.** Padrão: 25, 50 (atual) e 100, com 50 como valor inicial; a escolha fica salva no navegador. O limite de 100 vale também na API.
4. **O que um filtro salvo guarda.** Padrão: todos os filtros do extrato (busca, tipo, conta, categoria, neutra, datas, filtro rápido de mês, ordenação), sem a página. Itens por página não entram no filtro salvo. Filtros salvos valem só neste navegador (local storage), como você pediu; não sincronizam entre dispositivos.

## Features, ordem e dependências

```
F5 transactions-ux-v2  (ajustes finos, só front + identifier na API)
F6 transactions-list   (paginação, resumo)   ──►  F7 saved-filters
```

F7 depende de F6 porque o filtro salvo e o resumo clicável usam o mesmo estado de filtros.

### F5 · transactions-ux-v2 (ajustes finos)

| # | Item | Mudança | Teste |
| - | ---- | ------- | ----- |
| 1 | Identificadores no modal | API passa a devolver `identifier` (já existe a coluna); modal de edição mostra "ID" e "Identificador externo" em texto somente leitura, com botão de copiar; transações manuais sem identificador mostram "—". | API: campo no GET/POST/PATCH sem aceitar escrita; web: exibição, ausência de campo editável, `openapi.json`. |
| 2 | Toasts coloridos | Sucesso verde, erro vermelho (e info neutro), legíveis no tema claro e escuro, mantendo o helper `notify`. | Teste de classe por tipo; contraste conferido. |
| 3 | Limpar filtro individual | Cada filtro ativo ganha um "x" ao lado do rótulo; limpa só aquele filtro (busca, tipo, conta, categoria, neutra, De, Até, mês rápido). Limpar De ou Até desativa só aquela data; limpar mês rápido libera as datas. Volta para a página 1. | Um teste por filtro; os demais filtros e a ordenação permanecem. |
| 4 | Dia da semana | Abaixo da data, texto menor e mais claro: "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom", calculado da data local da transação (mesmo fuso do extrato). Na tabela e no cartão mobile. | Bordas: 23:30 local (fuso America/Sao_Paulo e UTC), virada de mês e de ano, ano bissexto. |

### F6 · transactions-list (resumo e paginação)

| # | Item | Mudança | Teste |
| - | ---- | ------- | ----- |
| 1 | `GET /transactions/summary` | Aceita exatamente os mesmos filtros da listagem e devolve `count`, `income`, `expense`, `investments`, `balance` (strings decimais com 2 casas, sem somar float) calculados no banco pelas regras da decisão 1; `balance = income − expense`. Sem dados → zeros. Isolamento por usuário e 401. | Integração: conjunto fixo com neutra, cartão, investimento, estorno e todos os filtros; soma bate com a listagem sem filtro de página. |
| 2 | Paginação na API | `pageSize` opcional (25, 50, 100; inválido → 422), resposta devolve o `pageSize` usado; `openapi.json`. | Integração: cada tamanho, página fora do intervalo, ordenação estável entre páginas. |
| 3 | Card de resumo | Entre os filtros e a lista: quantidade em destaque; receitas, despesas, investimentos e saldo em fonte menor com cores (verde, vermelho, âmbar/azul e cor condicional ao sinal). Carregamento, erro com "Tentar novamente" e estado vazio (R$ 0,00). Atualiza ao mudar qualquer filtro, sem refazer a consulta ao mudar só de página. | Valores renderizados da API; sem cálculo de total no front. |
| 4 | Clique nos valores | Receitas → tipo Receita; Despesas → tipo Despesa; Investimentos → categoria Investments; Saldo não é clicável (decisão 2). O valor ativo fica destacado; clicar de novo remove o filtro. Funciona por teclado. | Cada clique envia o parâmetro certo e volta à página 1. |
| 5 | Controle de itens por página e botões de página | Seletor de itens por página; "Anterior", "Próxima" e botões numerados com reticências (primeira, última, vizinhas da atual); página atual marcada. Mudar o tamanho volta à página 1. | Muitos/poucos resultados, bordas, mobile. |

### F7 · saved-filters

| # | Item | Mudança | Teste |
| - | ---- | ------- | ----- |
| 1 | Camada de armazenamento | Módulo `savedFilters` sobre `localStorage` com chave por usuário (id do usuário logado), validação do JSON lido (dados corrompidos ou de versão antiga são ignorados sem quebrar a tela), limite de filtros e nomes únicos sem diferenciar caixa e acento. Tudo em try/catch (localStorage pode falhar ou estar bloqueado). | Unit: leitura inválida, cota cheia, bloqueado, nomes duplicados. |
| 2 | "Salvar filtro" | Botão ao lado de "Limpar filtros", desabilitado quando não há filtro aplicado; abre modal com o nome e um resumo do que será salvo; confirmar salva e dispara toast; nome vazio ou repetido mostra erro no campo. | Fluxo completo, validações, foco e teclado. |
| 3 | Lista e aplicação | Menu suspenso "Filtros salvos" com a lista; clicar aplica o filtro (volta à página 1 e preenche todos os controles, incluindo o mês rápido); o filtro aplicado fica marcado enquanto o estado atual for igual ao salvo. | Aplicar substitui os filtros atuais; estado vazio da lista. |
| 4 | Gerenciar | Modal "Gerenciar filtros": renomear (mesmas regras de nome) e excluir com confirmação; toasts de sucesso e de erro. | Renomear, excluir, cancelar, falha de armazenamento. |

## Banco e API

| Mudança | Onde |
| ------- | ---- |
| `identifier` exposto (somente leitura) | API `transactions` (sem migration) |
| `GET /transactions/summary` | API nova |
| `pageSize` opcional na listagem | API `transactions` |

Sem migrations nesta leva. Filtros salvos e preferências de tela ficam no navegador.

## Execução

1. Spec, design e tasks por feature; lotes de até 7 tasks; front e backend na mesma feature.
2. Verifier independente por feature, com sensor de mutação. Testes sem esperas fixas e sem aumentar timeouts (lições L-027 e as de determinismo do `transactions-ux`).
3. Gates: `pnpm -C api test`, typecheck e lint; `yarn --cwd web test`, typecheck e lint.
4. A conferência no navegador contra a API local depende de uma sessão logada que os agentes não têm; fica listada em cada relatório para você.
5. Um PR por feature, empilhado (F5 → F6 → F7), sobre `main`.

| Feature | Tasks (aprox.) | Lotes |
| ------- | -------------- | ----- |
| F5 transactions-ux-v2 | 7 | 1 |
| F6 transactions-list | 10 | 2 |
| F7 saved-filters | 8 | 1 |

## Riscos

- **Divergência do resumo:** somar no front diverge da paginação; por isso o cálculo é no banco com as regras únicas, e o teste compara com a soma da listagem inteira.
- **Fuso no dia da semana:** é o erro clássico (`new Date("2026-03-01")` cai no dia anterior no Brasil). Os testes fixam o relógio e o fuso.
- **Filtros salvos antigos:** se os filtros do extrato ganharem campos novos, filtros salvos antes continuam válidos (campos ausentes ficam vazios); o formato guarda uma versão.
- **Tamanho do componente:** `TransactionsPage.tsx` já tem 717 linhas; as features novas entram em componentes e hooks próprios (`SummaryCard`, `Pagination`, `SavedFilters`), sem engordar o arquivo.
