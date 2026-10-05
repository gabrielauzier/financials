# STATE

## Decisions

### AD-001
- **Decision**: O projeto é composto por duas aplicações independentes na mesma pasta raiz, `api/` (Fastify) e `web/` (React + Vite), sem pacote compartilhado; o contrato é o OpenAPI gerado pela API (`@fastify/swagger`) e os tipos do `web/` são gerados dele (`openapi-typescript`).
- **Reason**: Escolha do usuário por apps independentes; o OpenAPI mantém um único contrato sem acoplamento de build.
- **Trade-off**: Regras puras (formatação, normalização) existem só onde são usadas; nada é compartilhado em código.
- **Scope**: `api/`, `web/`, todas as features.
- **Date**: 2026-10-04
- **Status**: active

### AD-002
- **Decision**: A API acessa o Postgres do Supabase diretamente (`postgres.js`), abrindo uma transação por requisição que executa `set_config('request.jwt.claims', <claims>, true)` e `set local role authenticated`, para que o RLS valha; a API nunca usa a chave de serviço para dados do usuário.
- **Reason**: RLS aplicado em todo acesso e transações multi-tabela nativas (a importação precisa ser atômica).
- **Trade-off**: Mais código de infraestrutura do que `supabase-js`; migrations e policies próprias.
- **Scope**: `api/`, `supabase/migrations/`, todas as features com dados.
- **Date**: 2026-10-04
- **Status**: active

### AD-003
- **Decision**: As regras de cálculo (neutras, estorno, investimentos, compras de cartão, data futura) vivem em um único módulo SQL da API (`api/src/modules/dashboards/rules.ts`) cujos fragmentos são reutilizados por toda consulta de agregação.
- **Reason**: Regra única para evitar divergência entre painéis; agregação no banco escala melhor que em memória.
- **Trade-off**: Testes de regra exigem Postgres real.
- **Scope**: `dashboards` e qualquer consulta que some valores.
- **Date**: 2026-10-04
- **Status**: active

### AD-004
- **Decision**: Valores monetários são `numeric(14,2)` no banco e strings decimais (`"1234.56"`) na API; nenhuma aritmética de dinheiro usa `number`/float em TypeScript.
- **Reason**: Evitar erro de ponto flutuante em somas e comparações de deduplicação.
- **Trade-off**: Formatação e entrada exigem conversão explícita.
- **Scope**: `api/`, `web/`.
- **Date**: 2026-10-04
- **Status**: active

### AD-005
- **Decision**: Instantes são `timestamptz` (UTC); o fuso do usuário vem em cada requisição (cabeçalho `X-Timezone`, IANA, padrão `America/Sao_Paulo`) e define janelas, meses, dia local e a meia-noite local de datas importadas.
- **Reason**: PRD exige exibir no fuso local do usuário; o servidor precisa do fuso para agregações e importação.
- **Trade-off**: Toda rota sensível a data depende do cabeçalho.
- **Scope**: `transactions`, `import`, `dashboards`, `credit-expenses`.
- **Date**: 2026-10-04
- **Status**: active

## Handoff

(none)
