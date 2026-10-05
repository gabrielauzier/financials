# Autenticação — Prompt Lovable (fundação do front)

**Specs**: `.specs/features/auth/spec.md` · **Design**: `.specs/features/auth/design.md`
**Substitui as tasks de interface**: T14–T20 de `tasks.md` (scaffold web, client da API, sessão, cadastro, login, guarda de rota, tipos).
**Pré-requisito**: projeto Supabase criado (URL e anon key em mãos) e conectado ao Lovable. **Este é o primeiro prompt: ele define a fundação que os próximos reutilizam.**

## Prompt (colar no Lovable)

~~~~text
Você vai construir a FUNDAÇÃO do front-end do "Financials", um app web de finanças pessoais em português do Brasil (pt-BR). Use React + Vite + TypeScript + Tailwind + shadcn/ui, React Router e TanStack Query. Este prompt cobre: estrutura do projeto, cliente da API, autenticação (cadastro e login) e o layout base. Não implemente nada além do que está descrito.

## Regras de arquitetura (valem para todo o projeto)
1. O front NUNCA acessa tabelas do Supabase. O Supabase é usado SOMENTE para autenticação (`supabase-js`: signUp, signInWithPassword, signOut, getSession, onAuthStateChange). Todos os dados virão de uma API REST própria (Fastify) em `VITE_API_URL`. Não crie tabelas, políticas RLS, edge functions nem migrations no Supabase.
2. Variáveis de ambiente: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` e `VITE_MOCK_AREAS` (lista separada por vírgula das áreas da API que usam mock; `*` = todas, vazio = nenhuma; padrão `*` enquanto a API não existe). Áreas: `accounts`, `categories`, `transactions`, `import`, `creditExpenses`, `dashboard`, `investmentReturns`.
3. Toda chamada à API passa por um único cliente `src/lib/api/client.ts` que: envia `Authorization: Bearer <access_token da sessão>`; envia `X-Timezone` com `Intl.DateTimeFormat().resolvedOptions().timeZone`; espera erros no formato `{ "error": { "code": string, "message": string, "field"?: string } }` e os converte em um `ApiError` tipado; em resposta 401 limpa a sessão e redireciona para `/login`.
4. Camada de mocks: para cada chamada, se a área do caminho (ex.: `/accounts` → `accounts`) estiver em `VITE_MOCK_AREAS` (ou for `*`), o cliente responde com dados em memória implementados em `src/lib/api/mock/` (um arquivo por área; `index.ts` com um roteador simples por método+caminho e um mapa caminho→área); caso contrário chama `VITE_API_URL` de verdade. Assim cada área pode sair do mock isoladamente, só pela variável, sem alterar código. Os próximos prompts adicionarão os mocks de cada área.
5. Valores monetários são SEMPRE strings decimais (ex.: "1234.56") entre front e API. Nunca faça aritmética de dinheiro com `number`. Crie `src/lib/format.ts` com `formatBRL(value: string): string` (→ "R$ 1.234,56", negativo "-R$ 12,00", trabalhando sobre a string) e `formatDateLocal(iso: string): string` (dd/mm/aaaa no fuso do navegador).
6. Interface 100% em pt-BR. Estrutura por feature: `src/features/<feature>/` com componentes, hooks e testes junto. Tipos da API em `src/lib/api/types.ts` (escreva à mão por enquanto; serão substituídos por tipos gerados do OpenAPI depois).
7. Acessibilidade: labels associados aos campos, foco visível, mensagens de erro ligadas aos campos (aria-describedby), contraste adequado. Responsivo (mobile e desktop). Visual sóbrio de app financeiro, tema claro com suporte a escuro.

## Layout base
- Rotas públicas: `/login`, `/cadastro`. Rotas protegidas (dentro de `<RequireAuth>` e de um layout com menu lateral): `/` (Dashboard), `/extrato`, `/importar`, `/cartao`, `/contas`, `/categorias`. Para as rotas protegidas crie páginas placeholder com apenas o título; elas serão implementadas nos próximos prompts.
- Menu lateral (colapsa em menu no mobile): Dashboard, Extrato, Importar, Cartão de crédito, Contas, Categorias, e no rodapé o apelido do usuário + botão "Sair".

## Autenticação
`useSession()` (em `src/features/auth/useSession.ts`) expõe `session`, `loading`, `signIn(email, senha)`, `signUp({ nome, apelido, email, senha })`, `signOut()`; restaura a sessão ao recarregar e reage a `onAuthStateChange`. `signUp` envia `name` e `nickname` em `options.data` (metadata do usuário).

`<RequireAuth>`: sem sessão válida redireciona para `/login`; se a sessão é perdida com a página aberta, também redireciona.

### Tela de cadastro (`/cadastro`)
Campos: Nome, Apelido, E-mail, Senha (mínimo 8 caracteres). Textos e comportamentos exatos:
- Campo vazio: bloqueia o envio e indica qual campo ("Informe o nome", "Informe o apelido", "Informe o e-mail", "Informe a senha").
- E-mail com formato inválido: "Informe um e-mail válido".
- Senha com menos de 8 caracteres: "A senha deve ter pelo menos 8 caracteres".
- E-mail já cadastrado: "E-mail já cadastrado". Isole a detecção em uma função `isEmailAlreadyRegistered(resultadoDoSignUp)` em `src/features/auth/emailExists.ts`. Regra provisória (será confirmada contra o Supabase real): o Supabase devolve um usuário com `identities` vazio quando o e-mail já existe.
- Falha no envio do e-mail de confirmação: "Não foi possível enviar o e-mail de confirmação. Tente novamente."
- Sucesso: troca o formulário por um estado "Verifique seu e-mail" explicando que é preciso confirmar o endereço antes de entrar, com link para o login.
- Link "Já tenho conta" para `/login`.

### Tela de login (`/login`)
Campos: E-mail e Senha.
- Credenciais válidas: entra e vai para `/`.
- Credenciais inválidas (`invalid_credentials`): UMA mensagem genérica "E-mail ou senha incorretos" que não diz qual campo está errado.
- E-mail não confirmado (`email_not_confirmed`): "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada."
- Serviço de autenticação indisponível (erro de rede/5xx): "Serviço indisponível no momento. Tente novamente em instantes." sem detalhes técnicos.
- Link "Criar conta" para `/cadastro`. NÃO crie fluxo de "esqueci a senha" (fora do escopo).

## Testes
Adicione testes Vitest + Testing Library cobrindo: cliente da API (headers Bearer e X-Timezone, tratamento de 401, mapeamento de erro), `useSession`, cadastro (todos os erros acima e o sucesso), login (todos os erros acima), `RequireAuth`, `formatBRL` e `formatDateLocal`. Scripts `test`, `typecheck` e `lint` no package.json.

## Fora do escopo
Reset de senha, login social, MFA, qualquer tela de dados (dashboard, extrato etc. são só placeholders), qualquer acesso direto a tabelas do Supabase.
~~~~

## Checklist de aceite (revisar o resultado do Lovable)

- [ ] Nenhum `supabase.from(...)` no código; `supabase-js` só para auth.
- [ ] `VITE_MOCK_AREAS` alterna cada área entre mock e API real sem mudar código.
- [ ] Headers `Authorization` e `X-Timezone` presentes em toda chamada (AUTH-06).
- [ ] Mensagens de cadastro e login idênticas às do prompt (AUTH-01, AUTH-05).
- [ ] Rotas protegidas redirecionam para `/login` sem sessão (AUTH-06).
- [ ] `formatBRL` opera sobre string, sem `parseFloat`.
- [ ] `pnpm typecheck`, `lint` e `test` passam.
