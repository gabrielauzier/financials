# Autenticação Design

**Spec**: `.specs/features/auth/spec.md`
**Status**: Draft

Contém também a **fundação compartilhada** de `api/` e do acesso a dados (AD-002), da qual todas as outras features dependem.

---

## Architecture Overview

O `web/` autentica direto no Supabase Auth (`supabase-js`: `signUp`, `signInWithPassword`) e envia o `access_token` como Bearer ao Fastify. A API valida o JWT, abre uma transação por requisição sob o papel `authenticated` com os claims do usuário e executa as queries; o RLS é a barreira final.

```mermaid
graph TD
    W[web: supabase-js Auth] -->|signUp / signIn| S[Supabase Auth]
    W -->|Bearer JWT + X-Timezone| A[Fastify API]
    A -->|plugin auth: verifica JWT| J[JWKS ou segredo HS256]
    A -->|withUser: BEGIN + set_config claims + SET LOCAL ROLE authenticated| P[(Postgres + RLS)]
    S -->|trigger after insert on auth.users| P
```

---

## Code Reuse Analysis

Projeto novo: não há código existente. Padrões definidos aqui são reutilizados pelas demais features.

### Integration Points

| System | Integration Method |
| ------ | ------------------ |
| Supabase Auth | `supabase-js` no `web/` (cadastro/login); a API só valida o JWT |
| Postgres | `postgres.js` com transação por requisição (AD-002) |
| Migrations | `supabase/migrations/*.sql` na raiz, aplicadas com Supabase CLI |

---

## Components

### `api/src/plugins/auth.ts`

- **Purpose**: Exigir e validar o Bearer JWT em toda rota exceto as marcadas como públicas (`/health`, `/docs`).
- **Interfaces**:
  - `verifyToken(token: string): Promise<JwtClaims>` - valida assinatura, expiração e extrai `sub`.
  - hook `onRequest` que preenche `request.user = { id, claims }` ou responde 401.
- **Dependencies**: `jose` (`createRemoteJWKSet` para chaves assimétricas; fallback HS256 com `SUPABASE_JWT_SECRET`), config `SUPABASE_URL`.
- **Reuses**: nada.

### `api/src/plugins/db.ts`

- **Purpose**: Entregar `request.withUser(fn)` que roda `fn(sql)` dentro de uma transação com RLS ativo.
- **Interfaces**:
  - `withUser<T>(claims: JwtClaims, fn: (tx: Sql) => Promise<T>): Promise<T>` - `BEGIN; select set_config('request.jwt.claims', $1, true); set local role authenticated; fn; COMMIT`.
- **Dependencies**: `postgres.js`, `DATABASE_URL` com papel autorizado a `SET ROLE authenticated`.
- **Reuses**: nada.

### `api/src/plugins/timezone.ts`

- **Purpose**: Ler `X-Timezone`, validar como zona IANA e expor `request.tz`.
- **Interfaces**: `request.tz: string` (padrão `America/Sao_Paulo`; zona inválida → 400).
- **Dependencies**: Luxon (`IANAZone.isValidZone`).

### `api/src/plugins/errors.ts`

- **Purpose**: Formato único de erro `{ error: { code, message, field? } }` e mapeamento de erros de validação, 401, 403, 404, 409, 422.
- **Interfaces**: `AppError(code, status, message, field?)`.

### `web/src/features/auth/`

- **Purpose**: Telas de cadastro e login, sessão e rota protegida.
- **Interfaces**:
  - `useSession(): { session, signIn, signUp, signOut }`.
  - `<RequireAuth>` redireciona para `/login` quando não há sessão (AUTH-05).
  - `signUp` detecta e-mail já cadastrado e exibe "E-mail já cadastrado".
- **Dependencies**: `supabase-js`, React Router.
- **Reuses**: cliente `api` com interceptador que anexa Bearer e `X-Timezone` (`Intl.DateTimeFormat().resolvedOptions().timeZone`).

---

## Data Models

```sql
-- supabase/migrations/0001_profiles_and_seed.sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  nickname text not null,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select using (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid());

-- função security definer chamada pelo trigger em auth.users
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, name, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'name',''), coalesce(new.raw_user_meta_data->>'nickname',''));
  -- a semeadura de categorias é adicionada por accounts-categories (migration 0002 redefine esta função)
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Padrão de tabela de dados (obrigatório em todas as features):** `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`, `alter table ... enable row level security` e policies `using/with check (user_id = auth.uid())`. Teste de isolamento percorre todas as tabelas listadas em um catálogo.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| -------------- | -------- | ----------- |
| Sem Bearer / JWT inválido ou expirado | 401 `unauthorized` | Frontend limpa a sessão e vai ao login |
| Registro de outro usuário por id | RLS devolve 0 linhas → 404 | "Não encontrado" |
| Campo obrigatório ausente ou formato inválido | 400/422 com `field` | Mensagem no campo |
| Supabase Auth indisponível no login | Erro de rede no `supabase-js` mapeado | "Serviço indisponível, tente novamente" |
| `signUp` com falha de envio de e-mail | Erro do Auth exibido de forma genérica | "Não foi possível enviar a confirmação" |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| ------- | -------------------- | ------ | ---------- |
| Tipo de assinatura do JWT. **Verificado no stack local (CLI 2.119): tokens de usuário são ES256, publicados em `/auth/v1/.well-known/jwks.json`; o `JWT_SECRET` HS256 assina só as chaves anon e service_role.** Projeto de produção futuro deve ser confirmado | `api/src/plugins/auth.ts` | Rejeitar tokens válidos ou aceitar inválidos | JWKS é o modo principal; HS256 fica como fallback por configuração; testes de integração usam token real obtido por login no GoTrue |
| Comportamento do `signUp` com e-mail existente. **Verificado no stack local (GoTrue v2.197.0, CLI 2.119) por `api/test/gotrue-behavior.int.test.ts`:** (1) e-mail **confirmado**: `POST /auth/v1/signup` responde 422 `{ code: 422, error_code: "user_already_exists", msg: "User already registered" }`; no supabase-js chega como `error.code === "user_already_exists"`, `data.user` nulo. (2) e-mail **não confirmado**: responde 200 com o **usuário existente** (mesmo `id` e `created_at`, `identities` com 1 item, `user_metadata` antigo, o novo nome é ignorado) e **reenvia** o e-mail de confirmação (`confirmation_sent_at` novo). Repetir dentro de `auth.email.max_frequency` (1s local, 60s padrão hospedado) dá 429 `over_email_send_rate_limit`. A suposição do front de que `user.identities` vem vazio **foi refutada** no stack local (nunca aparece; pode existir no projeto hospedado com proteção contra enumeração, então a checagem pode ficar). **Regra de detecção de "E-mail já cadastrado"**: `error.code === "user_already_exists"` OU `data.user.identities` é array vazio OU `Date.parse(data.user.confirmation_sent_at) - Date.parse(data.user.created_at) >= 1000` (cadastro novo tem diferença de milissegundos; um reenvio só ocorre depois de `max_frequency`). Login: e-mail não confirmado → 400 `email_not_confirmed`; senha errada **e** e-mail inexistente → o mesmo 400 `invalid_credentials` (mensagem genérica, AUTH-05.3). | `web/src/features/auth/emailExists.ts`, `SignupForm.tsx` | AUTH-01.5: hoje o front trata o caso confirmado (via `user_already_exists`), mas mostra "Verifique seu e-mail" no caso não confirmado | **Mudança no front:** `isEmailAlreadyRegistered` deve incluir o terceiro critério (diferença `confirmation_sent_at - created_at` >= 1s). Login: os códigos usados por `LoginForm.tsx` conferem. Confirmar o comportamento no projeto hospedado antes do lançamento |
| `SET ROLE authenticated` exige papel de conexão com esse privilégio | `api/src/plugins/db.ts` (a criar) | Falha de todas as queries | Teste de integração de smoke que lê `auth.uid()` dentro de `withUser` |
| Trigger em `auth.users` é `security definer` | migration 0001 | Escalada de privilégio se mal escrito | `set search_path = public`, sem SQL dinâmico, revisão na verificação |
| Conexão por pooler em modo transação | `api/src/plugins/db.ts` | `set_config` sem `local` vazaria entre requisições | Sempre `set_config(..., true)` dentro de `BEGIN`; teste de vazamento entre dois usuários |

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Cadastro e login | Direto do `web/` ao Supabase Auth | PRD: Supabase emite o JWT; menos código na API |
| Perfil | Tabela `profiles` preenchida por trigger | Guarda nome e apelido; semeia categorias na criação (AUTH-04) |
| Validação de schemas da API | TypeBox + `@fastify/type-provider-typebox` | Gera JSON Schema para OpenAPI (AD-001) |
| Biblioteca JWT | `jose` | Suporta JWKS remoto e HS256 |
| Testes | Vitest com Postgres do Supabase local (`supabase start`) | RLS e transações exigem Postgres real |
