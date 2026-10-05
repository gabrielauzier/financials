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

## Checklist de aceite

Verificado em 2026-10-04 sobre a primeira versão gerada pelo Lovable em `web/` (leitura do código + execução de `yarn test`, `npx tsc --noEmit` e `eslint`).

- [x] Nenhum `supabase.from(...)` no código; `supabase-js` só para auth. *(Os arquivos de service role em `src/integrations/supabase/` foram gerados pelo Lovable e não são importados; só `start.ts` importa o `auth-attacher`.)*
- [x] `VITE_MOCK_AREAS` alterna cada área entre mock e API real sem mudar código. *(`src/lib/api/mock/index.ts`; padrão `*`, vazio = nenhuma. Sem teste cobrindo `shouldMock`.)*
- [x] Headers `Authorization` e `X-Timezone` presentes em toda chamada real (AUTH-06). *(Teste em `client.test.ts`; chamadas mockadas não enviam headers.)*
- [x] Mensagens de cadastro e login idênticas às do prompt (AUTH-01, AUTH-05). *(Conferidas no código de `SignupForm.tsx` e `LoginForm.tsx`.)*
- [x] Rotas protegidas redirecionam para `/login` sem sessão (AUTH-06). *(Cada rota privada usa `RequireAuth`; teste em `RequireAuth.test.tsx`.)*
- [x] `formatBRL` opera sobre string, sem `parseFloat`. *(Ressalva: trunca em vez de arredondar além de 2 casas e devolve `R$ 0,00` para entrada inválida, sem sinalizar.)*
- [x] `test` passa. *(7 arquivos, 19 testes, após instalar `@testing-library/dom`, dependência faltante.)*
- [ ] `typecheck` passa. *(Falha: o script usa `tsgo`, pacote ausente do `package.json`. `npx tsc --noEmit` dá 0 erros. Correção: trocar o script por `tsc --noEmit` ou adicionar `@typescript/native-preview`.)*
- [ ] `lint` passa. *(688 erros, todos do Prettier: código em 100 colunas sem `.prettierrc`. Com `printWidth: 100` só sobra `routeTree.gen.ts`, que é gerado. Correção: `.prettierrc` com `printWidth: 100` e `.prettierignore` com `routeTree.gen.ts`.)*

### Desvios registrados

| # | Desvio | Esperado (spec/design/prompt) | Entregue pelo Lovable | Impacto / ação |
| - | ------ | ----------------------------- | --------------------- | -------------- |
| 1 | Stack do front | SPA Vite + React Router | TanStack Start (SSR, Nitro) com rotas por arquivo (`AGENTS.md` do projeto confirma) | Hospedagem precisa de runtime Node; **decisão pendente** (aceitar ou pedir SPA) |
| 2 | Nome da chave pública do Supabase | `VITE_SUPABASE_ANON_KEY` | `VITE_SUPABASE_PUBLISHABLE_KEY` | Usar o nome novo na configuração; prompt e roteiro atualizados |
| 3 | Gerenciador de pacotes | `pnpm` | `yarn.lock` e `bun.lock` presentes | Comandos do front viram `yarn` dentro de `web/`; `bun.lock` é redundante |
| 4 | Cliente da API só envia JSON | Suporte a `FormData` para a importação | `apiRequest` sempre faz `JSON.stringify(body)` | Prompt de `import` passou a pedir a extensão do cliente |
| 5 | Mocks de todas as áreas já criados | Só a base; mocks por prompt | Mocks de accounts, categories, transactions, import, creditExpenses, dashboard e investmentReturns | Sem dano; os prompts seguintes devem reaproveitar e ajustar, sem duplicar |
| 6 | Script `typecheck` com `tsgo` | Script que roda | Pacote ausente | Ver item de `typecheck` acima |
| 7 | Formatação sem `.prettierrc` | `lint` verde | 688 erros de Prettier | Ver item de `lint` acima |
| 8 | Projeto Supabase | Projeto usado também pela API | `supabase/config.toml` com `project_id` `unyohhnzkhsnlnrrcfms` | Confirmar que é o projeto que a API usará (validação do JWT depende dele) |
| 9 | Regra provisória de e-mail já cadastrado | Confirmada pela task auth T13 | `identities` vazio, ainda não validada contra o Supabase real | Revisar `isEmailAlreadyRegistered` quando T13 rodar |
