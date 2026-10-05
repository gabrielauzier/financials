# Autenticação Specification

Fonte: `docs/PRD.md` §5.1 (US-01, US-02, US-03).

## Problem Statement

O Financials guarda dados financeiros sensíveis. O MVP é de uso pessoal, mas precisa de cadastro, login e isolamento de dados por usuário desde o início para permitir abertura ao público depois sem reescrita. Supabase Auth emite o JWT; o Fastify valida o token e protege a API.

## Goals

- [ ] 100% das rotas de dados da API respondem 401 sem Bearer JWT válido.
- [ ] Zero acesso cruzado entre usuários, comprovado por teste automatizado de RLS.
- [ ] Cadastro com confirmação de e-mail e login funcionando ponta a ponta.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Reset / recuperação de senha | Decisão explícita do PRD para o MVP |
| Login social, MFA | Não pedido no PRD |
| Exportação / exclusão de conta (LGPD) | Fora do MVP; desenho não deve bloqueá-la |
| Papéis / permissões | Um usuário comum por conta |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Política de senha | Mínimo 8 caracteres | PRD não define; padrão comum | n |
| Apelido único? | Não é único | PRD não exige unicidade | n |
| Duração da sessão / refresh do JWT | Padrão do Supabase Auth | PRD não define | n |
| Erro de e-mail duplicado | Mensagem "E-mail já cadastrado" | PRD pede "erro claro" | n |
| Reenvio do e-mail de confirmação | Fora do MVP; usuário com e-mail não confirmado tenta novo cadastro após erro claro | PRD não define reenvio | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Cadastro com confirmação ⭐ MVP

**User Story**: Como visitante, quero me cadastrar com nome, apelido, e-mail e senha para ter uma conta.

**Why P1**: Sem conta não há dados nem isolamento.

**Acceptance Criteria**:

1. WHEN o visitante envia nome, apelido, e-mail válido e senha com 8+ caracteres THEN o sistema SHALL criar a conta com e-mail não confirmado.
2. WHEN a conta é criada THEN o sistema SHALL enviar um e-mail de confirmação ao endereço informado.
3. IF algum campo (nome, apelido, e-mail ou senha) está vazio THEN o sistema SHALL rejeitar o cadastro indicando o campo inválido.
4. IF a senha tem menos de 8 caracteres THEN o sistema SHALL rejeitar o cadastro com mensagem de senha curta.
5. IF o e-mail já está cadastrado THEN o sistema SHALL rejeitar o cadastro com a mensagem "E-mail já cadastrado".
6. WHEN o usuário abre o link de confirmação válido THEN o sistema SHALL marcar o e-mail como confirmado.
7. WHEN uma conta é criada THEN o sistema SHALL semear as categorias iniciais do usuário (ver spec `accounts-categories`).

**Independent Test**: Cadastrar, abrir o link do e-mail, e ver a conta confirmada.

---

### P1: Login e proteção da API ⭐ MVP

**User Story**: Como usuário, quero entrar com e-mail e senha para acessar apenas meus dados.

**Why P1**: Toda a aplicação depende de uma sessão autenticada.

**Acceptance Criteria**:

1. WHEN o usuário com e-mail confirmado envia credenciais válidas THEN o sistema SHALL autenticá-lo e retornar um JWT.
2. IF o e-mail não está confirmado THEN o sistema SHALL recusar o login com mensagem de confirmação pendente.
3. IF as credenciais são inválidas THEN o sistema SHALL responder com mensagem genérica que não revela qual campo está errado.
4. IF uma rota da API (exceto autenticação) é chamada sem `Authorization: Bearer <JWT>` válido THEN o sistema SHALL responder 401.
5. IF o JWT está expirado ou com assinatura inválida THEN o sistema SHALL responder 401.
6. WHILE não há sessão válida no frontend o sistema SHALL redirecionar rotas protegidas para a tela de login.

**Independent Test**: Chamar `GET /transactions` sem token (401) e com token (200).

---

### P1: Isolamento de dados por usuário ⭐ MVP

**User Story**: Como usuário, quero que somente eu veja meus dados para garantir privacidade.

**Why P1**: Requisito de segurança e base para o lançamento público.

**Acceptance Criteria**:

1. The sistema SHALL armazenar `user_id` em toda tabela de dados do usuário.
2. The sistema SHALL ativar Row Level Security em toda tabela de dados do usuário, permitindo acesso apenas às linhas cujo `user_id` é o do usuário autenticado.
3. IF o usuário A requisita (leitura, edição ou exclusão) um registro do usuário B por id THEN o sistema SHALL responder 404.
4. WHEN o Fastify consulta o banco em nome do usuário THEN o sistema SHALL executar a consulta sob a identidade do usuário autenticado e nunca com chave de serviço irrestrita.

**Independent Test**: Criar dois usuários; o usuário A tenta ler e alterar um registro do B e recebe 404.

---

## Edge Cases

- IF o e-mail informado tem formato inválido THEN o sistema SHALL rejeitar o cadastro com mensagem de e-mail inválido.
- IF o serviço de e-mail do Supabase falha no envio THEN o sistema SHALL informar que a confirmação não foi enviada e manter a conta não confirmada.
- IF o Supabase Auth está indisponível no login THEN o sistema SHALL exibir mensagem de indisponibilidade sem expor detalhes técnicos.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| AUTH-01 | P1: Cadastro (campos e validação) | - | Pending |
| AUTH-02 | P1: Cadastro (e-mail de confirmação) | - | Implementing |
| AUTH-03 | P1: Cadastro (confirmação do e-mail) | - | Pending |
| AUTH-04 | P1: Cadastro (categorias semeadas) | - | Pending |
| AUTH-05 | P1: Login | - | Pending |
| AUTH-06 | P1: Proteção da API (JWT) | - | Implementing |
| AUTH-07 | P1: Isolamento (user_id + RLS) | - | Implementing |
| AUTH-08 | P1: Isolamento (404 cruzado, sem chave de serviço) | - | Pending |

**Coverage:** 8 total, 0 mapped to tasks, 8 unmapped ⚠️

---

## Success Criteria

- [ ] Cadastro, confirmação e login completam sem intervenção manual.
- [ ] Teste de isolamento entre dois usuários passa para todas as tabelas de dados.
