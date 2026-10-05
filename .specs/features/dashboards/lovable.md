# Dashboards e Patrimônio — Prompt Lovable

**Specs**: `.specs/features/dashboards/spec.md` · **Design**: `.specs/features/dashboards/design.md`
**Substitui as tasks de interface**: T14–T20 de `tasks.md` (cartão 30 dias, tendência, categorias, patrimônio, visão de cartão, rendimentos, página).
**Pré-requisito**: todos os prompts anteriores aplicados (usa `formatBRL`, cliente da API, layout).

## Prompt (colar no Lovable)

~~~~text
Continue o app "Financials" (React + Vite + TS + Tailwind + shadcn/ui + TanStack Query, UI em pt-BR). Mantenha as regras de arquitetura: dados só pela API via `src/lib/api/client.ts`, mocks em `src/lib/api/mock/` para as áreas listadas em `VITE_MOCK_AREAS`, dinheiro SEMPRE string decimal (formate com `formatBRL`; nunca some valores no front). Use Recharts para gráficos. Implemente o Dashboard na rota `/` em `src/features/dashboard/`. TODOS os números vêm calculados pela API; o front só exibe. Não reimplemente regras de cálculo no front.

## Contrato da API
Erros: `{ "error": { "code", "message", "field"? } }`. `from`/`to` = datas locais `YYYY-MM-DD`; período inválido (from > to) → 422 `invalid_period`.
- `GET /dashboard/last-30-days` → `{ total: string, previousTotal: string, changePct: number|null }`
- `GET /dashboard/trend` → `{ points: { month: "YYYY-MM", income: string, expense: string, balance: string }[] }` (sempre 12 meses, o corrente + 11 anteriores, meses vazios com "0.00")
- `GET /dashboard/categories?from&to` → `{ items: { categoryId: uuid, name: string, total: string }[] }` (padrão: mês corrente; `total` pode ser NEGATIVO na categoria Estorno)
- `GET /dashboard/net-worth` → `{ current: string, series: { month: "YYYY-MM", value: string }[] }`
- `GET /dashboard/card?from&to` → `{ transactions: { categoryName: string, total: string }[], creditExpenses: { categoryName: string, remaining: string }[] }`
- `GET /investment-returns` → `{ items: InvestmentReturn[], lastDate: "YYYY-MM-DD"|null }` onde `InvestmentReturn = { id: uuid, accountId: uuid, accountNickname: string, occurredOn: "YYYY-MM-DD", amount: string (positivo ou negativo, nunca zero), notes: string|null }`
- `POST /investment-returns` body `{ occurredOn, amount, accountId, notes? }` · `PATCH /investment-returns/:id` · `DELETE /investment-returns/:id`
Códigos de erro: `invalid_amount` (422), `invalid_period` (422), 404.

## Mocks
Dados coerentes entre si: 12 meses de histórico, uma categoria Estorno negativa no mês corrente, patrimônio crescente com 3 lançamentos de rendimento (um negativo), visão de cartão com 3 categorias, e variação nula quando `previousTotal` é "0.00". Inclua um modo de mock "sem dados" (contas vazias) para testar estados vazios.

## Layout da página
Grade responsiva (mobile em coluna única): 1) Cartão "Despesas dos últimos 30 dias" e Patrimônio lado a lado no topo; 2) Tendência de 12 meses; 3) Gastos por categoria; 4) Visão do cartão; 5) Rendimentos de investimentos.

## Componentes
- `Last30DaysCard`: total em destaque (`formatBRL`), variação percentual com seta e cor (aumento de despesa em vermelho, redução em verde) em relação aos 30 dias anteriores. Se `changePct` for null mostre "sem base de comparação". Sem despesas mostra R$ 0,00.
- `TrendChart`: gráfico de barras (receitas verde, despesas vermelho) com linha de balanço; eixo com meses em pt-BR ("out/26"); tooltip com os três valores em BRL; os 12 meses sempre visíveis, inclusive os zerados.
- `CategoryBreakdown`: seletor de período (Mês atual, Mês anterior, Últimos 90 dias, Personalizado com de/até) que refaz a consulta; gráfico de rosca/barras + tabela com nome da categoria em português, valor e percentual. A categoria Estorno aparece com valor NEGATIVO e fora do cálculo de percentuais positivos (mostre-a destacada). Estado vazio: "Sem despesas no período".
- `NetWorthChart`: valor atual em destaque e gráfico de área da série mensal acumulada. Sem dados: "R$ 0,00" e estado vazio "Ainda não há movimentações".
- `CardView`: seletor de período; duas seções separadas: "Compras no cartão por categoria" (total por categoria) e "Parcelas e recorrências a pagar" (restante por categoria). Aviso: "Valores do cartão não somam nos totais de receitas, despesas e patrimônio." Estado vazio por seção.
- `InvestmentReturns`: lista (data, conta, valor com sinal e cor, observações) ordenada por data decrescente; formulário criar/editar (dialog) com Data*, Conta* (`AccountSelect`), Valor* (positivo ou negativo, diferente de zero, no máximo 2 casas → "Valor inválido"), Observações; excluir com confirmação. Mostre "Último lançamento em dd/mm/aaaa" e destaque em âmbar quando tiver mais de 30 dias ("Atualize seus rendimentos"). Texto de ajuda: "Aportes e resgates não alteram o patrimônio; lance aqui o ganho ou a perda dos seus investimentos." Valor em formato brasileiro ("-1.234,56") vira string decimal sem float.
- `DashboardPage`: compõe tudo; cada painel tem skeleton de carregamento e estado de erro com "Tentar novamente". Sem nenhum dado, todos os painéis mostram R$ 0,00 e seus estados vazios.

## Testes
Vitest + Testing Library: cartão 30 dias (total, variação, "sem base de comparação", zero), tendência com 12 meses incluindo zeros, mudança de período no CategoryBreakdown refaz a consulta, Estorno negativo, patrimônio e estado vazio, CardView com seções e aviso, rendimentos (validação de valor zero/3 casas, destaque > 30 dias, excluir), página completa com mock e com mock "sem dados".

## Fora do escopo
Saldo inicial, cotação automática de investimentos, orçamentos e metas, exportação de relatórios, qualquer cálculo de totais no front.
~~~~

## Checklist de aceite

- [ ] Nenhum total é calculado no front; só exibição (DASH-01).
- [ ] "sem base de comparação" quando `changePct` é null (DASH-02).
- [ ] Tendência sempre com 12 meses, zerados incluídos (DASH-03).
- [ ] Estorno aparece negativo; seletor de período refaz a consulta (DASH-04).
- [ ] Patrimônio e estado vazio com R$ 0,00 (DASH-05).
- [ ] Rendimentos: valor ≠ 0, destaque > 30 dias, CRUD (DASH-06).
- [ ] Visão de cartão com aviso de que não soma nos totais (DASH-07).
