# Servidor da API e CORS Specification

Origem: `.specs/INTEGRACAO-FRONT-BACK.md` (bloqueios B1 e B2).

## Problem Statement

A API só existe como fábrica `buildApp()` usada nos testes: não há ponto de entrada nem scripts para subi-la, e o navegador bloqueia qualquer chamada do front por falta de CORS (outra origem, cabeçalhos `Authorization` e `X-Timezone`, métodos `PATCH` e `DELETE`). Sem isso o front do Lovable não consegue falar com o backend.

## Goals

- [ ] Um comando sobe a API localmente lendo a configuração do ambiente.
- [ ] O front em uma origem permitida chama todas as rotas, inclusive o preflight sem token.
- [ ] Origens não permitidas nunca recebem cabeçalhos CORS.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Dockerfile e deploy | Etapa de deploy final |
| Limitação de taxa (rate limiting) | Não pedida |
| HTTPS / terminação TLS | Responsabilidade da hospedagem |
| Cookies e `credentials` em CORS | O front usa Bearer, não cookies |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Porta padrão | 3001 (`PORT`) | Evita 3000 (site_url local do Supabase) e 8080 (front no sandbox) | n |
| Host padrão | 127.0.0.1 (`HOST`) | Seguro por padrão; o deploy define 0.0.0.0 | n |
| Origens permitidas | Lista explícita em `CORS_ORIGINS` separada por vírgula; vazia = nenhuma origem | Sem curinga | n |
| Curinga `*` em `CORS_ORIGINS` | Rejeitado na carga da configuração | Evita liberar qualquer origem por engano | n |
| Cache do preflight | 600 s | Reduz preflights repetidos | n |
| Cabeçalhos permitidos | `authorization`, `content-type`, `x-timezone` | Os que o front envia | n |
| Métodos permitidos | `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS` | Os usados pelo contrato | n |
| Nível de log | `LOG_LEVEL` (padrão `info`; `silent` nos testes) | Fastify/pino | n |
| Carregamento de `.env` | `node --env-file-if-exists=.env` nos scripts `dev` e `start` | Node 22 já suporta; sem dependência nova | n |
| Build de produção | `tsc` para `dist/` e `node dist/server.js` | Evita rodar TypeScript em produção | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Subir a API ⭐ MVP

**User Story**: Como desenvolvedor, quero subir a API com um comando para que o front possa chamá-la.

**Why P1**: Sem servidor não há integração.

**Acceptance Criteria**:

1. WHEN o servidor é iniciado com a configuração válida THEN o sistema SHALL escutar na porta configurada e responder 200 `{ "status": "ok" }` em `GET /health` por HTTP real.
2. The sistema SHALL ler `PORT` (padrão 3001), `HOST` (padrão 127.0.0.1), `CORS_ORIGINS`, `LOG_LEVEL`, `SUPABASE_URL`, `DATABASE_URL` e `SUPABASE_JWT_SECRET` do ambiente.
3. IF `PORT` não é um inteiro entre 1 e 65535 THEN o sistema SHALL recusar a configuração com mensagem que cita `PORT`.
4. IF `SUPABASE_URL` ou `DATABASE_URL` está ausente THEN o sistema SHALL encerrar o processo com código diferente de zero e mensagem que cita a variável.
5. WHEN o processo recebe SIGTERM ou SIGINT THEN o sistema SHALL parar de aceitar conexões, fechar o pool do banco e encerrar com código 0.
6. The sistema SHALL registrar cada requisição em log JSON sem incluir o cabeçalho `Authorization` nem o token.

**Independent Test**: Subir o processo, chamar `GET /health`, enviar SIGTERM e ver saída 0.

---

### P1: CORS para o front ⭐ MVP

**User Story**: Como o front hospedado em outra origem, quero que o navegador aceite as respostas da API para usar todas as rotas.

**Why P1**: Sem CORS o navegador bloqueia toda chamada real.

**Acceptance Criteria**:

1. WHEN um preflight `OPTIONS` chega de uma origem permitida pedindo `PATCH` com os cabeçalhos `authorization`, `content-type` e `x-timezone` THEN o sistema SHALL responder 204 sem exigir token.
2. WHEN a resposta é um preflight de origem permitida THEN o sistema SHALL incluir `Access-Control-Allow-Origin` igual à origem, `Access-Control-Allow-Methods` com `GET, POST, PATCH, DELETE, OPTIONS`, `Access-Control-Allow-Headers` com `authorization`, `content-type` e `x-timezone`, e `Access-Control-Max-Age` igual a 600.
3. WHEN uma requisição real chega de uma origem permitida THEN o sistema SHALL incluir `Access-Control-Allow-Origin` igual à origem e `Vary: Origin`.
4. IF uma rota protegida é chamada sem token por uma origem permitida THEN o sistema SHALL responder 401 com o corpo de erro padrão e `Access-Control-Allow-Origin`, para o navegador conseguir ler o erro.
5. IF a origem não está na lista THEN o sistema SHALL responder sem nenhum cabeçalho `Access-Control-*`.
6. WHERE `CORS_ORIGINS` está vazia o sistema SHALL não permitir nenhuma origem.
7. IF `CORS_ORIGINS` contém `*` THEN o sistema SHALL recusar a configuração com mensagem que cita `CORS_ORIGINS`.
8. The sistema SHALL comparar origens de forma exata, ignorando barra final na configuração e sem aceitar subdomínios implícitos.
9. The sistema SHALL não enviar `Access-Control-Allow-Credentials`.

**Independent Test**: Preflight com `Origin: http://localhost:8080` e ver 204 com os cabeçalhos; repetir com origem não listada e ver nenhum cabeçalho CORS.

---

## Edge Cases

- WHEN `CORS_ORIGINS` tem espaços e barras finais (`" http://localhost:8080/ , http://127.0.0.1:5173"`) THEN o sistema SHALL normalizá-las antes de comparar.
- IF a requisição não traz `Origin` THEN o sistema SHALL responder normalmente sem cabeçalhos CORS.
- IF o preflight pede um método fora da lista (`PUT`) THEN o sistema SHALL não anunciá-lo em `Access-Control-Allow-Methods`.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SRV-01 | P1: Subir a API (escuta e health) | - | Pending |
| SRV-02 | P1: Subir a API (configuração do ambiente) | - | Implementing |
| SRV-03 | P1: Subir a API (encerramento limpo) | - | Pending |
| SRV-04 | P1: Subir a API (logs sem token) | - | Pending |
| CORS-01 | P1: CORS (preflight sem token) | - | Implementing |
| CORS-02 | P1: CORS (cabeçalhos permitidos e cache) | - | Implementing |
| CORS-03 | P1: CORS (respostas reais e 401 legível) | - | Implementing |
| CORS-04 | P1: CORS (origens negadas, vazia, sem curinga) | - | Implementing |

**Coverage:** 8 total, 0 mapped to tasks, 8 unmapped ⚠️

---

## Success Criteria

- [ ] O front em `http://localhost:8080` (origem configurada) lista contas pela API real sem erro de CORS.
- [ ] `pnpm -C api build && node api/dist/server.js` serve `/health`.
