# Integração front (Lovable) e backend: status e pendências

**Levantamento em 2026-10-05.** Escopo: as três features já prontas no backend (`auth`, `accounts-categories`, `transactions`; PRs 1 a 3) e o front na versão `v3.1-transactions` (`web/` idêntico ao zip, sem versão mais nova).

## Veredito

**Os contratos batem, mas o front ainda não consegue falar com o backend.** Faltam peças de infraestrutura no backend (servidor, CORS) e a configuração de ambiente do front. Nada disso é difícil, mas bloqueia qualquer teste de ponta a ponta.

## 1. Estado do front

| Item | Situação |
| ---- | -------- |
| Versão aplicada | `v3.1-transactions` (auth, contas, categorias, extrato) |
| Áreas ligadas à API real | **Nenhuma**. `VITE_MOCK_AREAS` não está definida e o padrão é `*` (tudo mockado); `VITE_API_URL` não existe no `.env` |
| Prompts pendentes no Lovable | 4 import, 5 credit-expenses, 6 dashboards (pausados) |
| Gates em `web/` | `yarn test` 35 testes ok, `yarn typecheck` ok, `yarn lint` 0 erros (conferidos na v3.1) |
| Pendências abertas do front | Testes de UI do extrato não entregues (prompt 3), `yarn.lock` fora de sincronia, `.env` versionado, receitas sem cor verde, `AccountsPage` sem tratamento de erro ao ativar/desativar, `emailExists.ts` sem o 3º critério |

## 2. Contratos: conferência campo a campo

Comparei `web/src/lib/api/types.ts` e os clientes (`api.ts` de cada feature) com `api/openapi.json`.

| Área | Rotas | Resultado |
| ---- | ----- | --------- |
| Contas | `GET/POST /accounts`, `PATCH /accounts/:id`, `POST …/activate\|deactivate` | ✅ mesmos campos, tipos e códigos (`duplicate_name`, `holder_required`) |
| Categorias | `GET/POST /categories`, `PATCH/DELETE /categories/:id?reassignTo=` | ✅ mesmos campos; `category_protected` e `reassign_required` tratados pelo front |
| Transações | `GET/POST /transactions`, `PATCH/DELETE /transactions/:id`, `PATCH /transactions/category` | ✅ mesma forma de `Transaction`, filtros, paginação de 50, `amount` como texto, respostas 204 |
| Auth | Supabase Auth direto + Bearer + `X-Timezone` | ✅ headers e tratamento de 401 conferidos nos testes de ambos os lados |

Todas as 14 rotas de dados do front existem na API, e a API não tem rota que o front não use (exceto `/health`).

## 3. Bloqueios para integrar (backend)

| # | Pendência | Efeito | Ação |
| - | --------- | ------ | ---- |
| B1 | **A API não tem servidor.** Não há `listen`, entrypoint, script `dev`/`start` nem `.env.example`; só a fábrica `buildApp()` (usada nos testes) | Impossível subir a API para o front chamar | Criar `src/server.ts` (lê `loadConfig`, porta configurável, desligamento limpo) e scripts `dev` e `start`, mais `api/.env.example` |
| B2 | **Sem CORS.** O navegador bloqueará todas as chamadas do front (outra origem; cabeçalhos `Authorization` e `X-Timezone`; métodos `PATCH` e `DELETE`) | Toda chamada real falha no navegador | Registrar `@fastify/cors` com origem configurável, cabeçalhos `authorization, content-type, x-timezone` e métodos `GET, POST, PATCH, DELETE`. O preflight `OPTIONS` não leva token: o hook de autenticação precisa deixá-lo passar (o plugin de CORS tem de responder antes do hook) e isso exige teste |
| B3 | **JWKS e projeto Supabase.** O `.env` do front aponta para o projeto da nuvem (`unyohhnz…`, Lovable Cloud); a API valida tokens do `SUPABASE_URL` configurado | Token de um projeto não vale no outro | Para o desenvolvimento local, apontar o front para o Supabase local (ver F1) e a API para o mesmo. O projeto de nuvem definitivo só entra no deploy final (decisão do usuário) |
| B4 | **Chaves de dados do front.** O projeto da nuvem não tem as tabelas nem as migrations do backend | A API não pode usá-lo agora | Não usar; reservado para o deploy |

## 4. Pendências de configuração do front (F)

| # | Pendência | Ação |
| - | --------- | ---- |
| F1 | Apontar o front para o stack local: `VITE_SUPABASE_URL=http://127.0.0.1:55321` e `VITE_SUPABASE_PUBLISHABLE_KEY` (obtida em `pnpm -C api db:status`), em `web/.env.local` (o script de sincronização protege `.env*`; o `.env.local` não deve ser versionado) | Criar o arquivo e conferir o login |
| F2 | `VITE_API_URL` (porta da API, a definir em B1) e `VITE_MOCK_AREAS=import,creditExpenses,dashboard,investmentReturns` para manter mockadas só as áreas ainda sem backend | Definir no `.env.local` |
| F3 | Redirecionamento do e-mail de confirmação: o front usa `emailRedirectTo = window.location.origin`, mas o Supabase local tem `site_url = http://127.0.0.1:3000` e só aceita `https://127.0.0.1:3000` como URL extra | Ajustar `supabase/config.toml` (`site_url` e `additional_redirect_urls`) para a origem real do front. Confirmar a porta ao rodar `yarn dev` (o pacote do Lovable fixa 8080 apenas no sandbox) |
| F4 | Dois domínios de dados: o login vai ao Supabase local e os dados à API; os dois precisam estar de pé | Documentar no README a ordem de subida: `db:start`, API, `yarn dev` |
| F5 | Tipos escritos à mão em `types.ts`: hoje coincidem com o OpenAPI, mas não há nada que acuse divergência futura | Gerar com `openapi-typescript` a partir de `api/openapi.json` (task `auth T20`) e deixar o `typecheck` acusar mudanças |

## 5. Diferenças de comportamento que aparecerão na integração

| # | Diferença | Onde se vê | Severidade | Ação |
| - | --------- | ---------- | ---------- | ---- |
| D1 | **Não é possível limpar observações e recibo ao editar uma transação.** O formulário omite `notes` e `receipt` quando vazios; a API só limpa com `null` (ou texto em branco) | Editar transação e apagar o campo: o valor antigo permanece | Média | Ajuste no front: enviar `null` quando o campo for esvaziado em edição |
| D2 | **Mensagens de erro da API estão em inglês** e o front exibe `error.message` em vários caminhos (`not_found` de categoria, validação em contas, exclusão, lote) | Textos em inglês misturados com português | Média | Mapear por `code` no front (lista de códigos em `api/src`), com o texto em português; manter `message` só para diagnóstico |
| D3 | **400 contra 422**: corpo malformado dá 400 `validation_error`; o contrato do front fala em 422 com `field` | Mensagem genérica em casos raros | Baixa | Decisão única para a API inteira (400 ou 422 para campo ausente e em branco) |
| D4 | Ordem de categorias: a API ordena por nome sem caixa; o mock seguia a ordem da semente | Listas e seletores | Baixa | Aceitar a ordem da API |
| D5 | Data de transação criada pelo front: meio-dia local; importada: meia-noite local | Edição reescreve a hora para meio-dia | Baixa | Aceitar, ou enviar a data original quando o campo de data não mudou |
| D6 | `GET /transactions` com `from > to` devolve lista vazia sem erro | Filtro de período invertido | Baixa | Validar no front |
| D7 | **E-mail duplicado**: o `emailExists.ts` do front não detecta o caso não confirmado (precisa do critério `confirmation_sent_at − created_at ≥ 1s`) | Cadastro com e-mail já usado e não confirmado mostra "Verifique seu e-mail" | Média | Mensagem de correção ao Lovable (já registrada no roteiro) |
| D8 | O mock e a API divergem em detalhes (por exemplo, código `validation` no mock e `validation_error` na API) | Ramos de erro não exercitados com a API real | Baixa | Repetir o checklist de cada prompt contra a API real |

## 6. Plano mínimo para a primeira integração (ordem)

1. **Backend**: B1 (servidor, scripts, `.env.example`) e B2 (CORS com teste de preflight). Uma feature pequena, no mesmo ciclo de spec, tasks, lote e verificação.
2. **Supabase local**: F3 (URLs de redirecionamento) e confirmar a porta do front.
3. **Front**: `.env.local` (F1 e F2) e subir tudo na ordem de F4.
4. **Verificação manual com a API real**, por área, na ordem: login e cadastro (com o e-mail de confirmação no Mailpit, porta 55324), contas, categorias, extrato. Repetir o checklist de cada prompt (`features/*/lovable.md`), retirando cada área de `VITE_MOCK_AREAS` conforme passar.
5. **Mensagem de correção ao Lovable** com D1, D2, D7 e os testes de UI do extrato (e F5), e aplicar o zip com `.lovable/sync-codebase.sh`.

## 7. O que não bloqueia

- Contratos de `accounts-categories`, `transactions` e `auth`: conferidos e coerentes.
- Áreas sem backend (`import`, `credit-expenses`, `dashboards`) continuam mockadas sem impacto nas demais.
- Pendências de endurecimento do backend (emissor e audiência do JWT, papel de banco sem bypass, `prepare: false` atrás de pooler) só importam no deploy.

---

## 8. Resultado da integração (2026-10-05)

Feature `api-server` (servidor + CORS) implementada e **verificada (PASS na iteração 2)**, branch `feat/api-server`; integração local feita e testada no navegador com a API real.

### Bloqueios e configurações

| # | Item | Situação |
| - | ---- | -------- |
| B1 | Servidor da API (`src/server.ts`, scripts `dev`/`build`/`start`, `.env.example`, README) | ✅ Feito |
| B2 | CORS (origens exatas, preflight sem token, 401 legível pelo navegador) | ✅ Feito e testado (12 testes de integração) |
| B3 | Projeto Supabase | ✅ Resolvido localmente: front e API usam o stack local (`web/.env.local` e `api/.env`, ambos fora do git) |
| F1 e F2 | `web/.env.local` com URL local, chave publicável, `VITE_API_URL` e `VITE_MOCK_AREAS=import,creditExpenses,dashboard,investmentReturns` | ✅ Feito |
| F3 | Redirecionamento do e-mail de confirmação | ✅ `site_url=http://localhost:8080` e URLs adicionais em `supabase/config.toml`; o front roda na **porta 8080** |
| F4 | Ordem de subida documentada | ✅ README |
| F5 | Tipos gerados do OpenAPI | Pendente (task `auth T20`, do front) |

### Fluxos conferidos no navegador, com a API real

| Fluxo | Resultado |
| ----- | --------- |
| Cadastro (nome, apelido, e-mail, senha) | ✅ "Verifique seu e-mail"; e-mail no Mailpit com link para `http://localhost:8080` |
| Confirmação pelo link | ✅ redireciona ao app já com sessão |
| Preflight e chamadas (`OPTIONS` 204, `GET /accounts` 200 com Bearer) | ✅ sem erro de CORS |
| Contas: criar | ✅ gravada no banco com o titular |
| Contas: apelido repetido em outra caixa | ✅ "Já existe uma conta com esse apelido" (409) |
| Categorias | ✅ as 17 em português vindas da semeadura do banco |
| Extrato: listar dados reais | ✅ 3 transações da API |
| Extrato: categoria inline | ✅ persistiu no banco |
| Extrato: switch de neutra | ✅ persistiu no banco; linha esmaecida |
| Extrato: criar pelo formulário (`1.234,56`, observação) | ✅ gravada como `1234.56` com a observação |
| Sair, redirecionamento ao login e login com senha errada | ✅ "E-mail ou senha incorretos" |
| Login com a senha certa | ✅ vai ao Dashboard (ainda um placeholder) |

### O que ainda precisa de ajuste no front (Lovable)

Nada bloqueia o uso, mas estes itens aparecerão ao usar o app (mensagem de correção ao Lovable abaixo):

| # | Item | Efeito | Severidade |
| - | ---- | ------ | ---------- |
| D1 | Editar transação não consegue limpar observações nem recibo | O valor antigo permanece | Média |
| D2 | Mensagens de erro da API em inglês aparecem em vários caminhos | Texto em inglês misturado | Média |
| D7 | `emailExists.ts` não detecta e-mail já cadastrado e não confirmado | Mostra "Verifique seu e-mail" em vez de "E-mail já cadastrado" | Média |
| — | Ativar/desativar conta sem tratamento de erro | Falha silenciosa | Baixa |
| — | Testes de UI do extrato, `yarn.lock` fora de sincronia | Qualidade | Média/Baixa |

### Mensagem de correção ao Lovable (pendente de envio)

~~~~text
Faça apenas as correções abaixo, sem mudar o comportamento das demais telas. O front agora conversa com a API real (VITE_MOCK_AREAS não inclui accounts, categories, transactions).

1) Editar transação deve conseguir limpar campos
- No formulário de edição, quando Observações ou Recibo forem esvaziados, envie `notes: null` e/ou `receipt: null` no PATCH (hoje o campo é omitido e a API mantém o valor antigo). Na criação, continue omitindo campos vazios. Teste: editar uma transação com observação, apagar o texto, salvar e ver o campo vazio depois do reload.

2) Mensagens de erro da API sempre em português
- Nunca exiba `error.message` vindo da API (está em inglês). Crie `src/lib/api/errorMessages.ts` com `messageForError(error: unknown): string` que mapeia por `error.code`: `duplicate_name` (contexto: conta → "Já existe uma conta com esse apelido"; categoria → "Já existe uma categoria com esse nome"), `holder_required` → "Informe ao menos um titular", `category_protected` → "Categoria protegida", `reassign_required` → "Escolha a categoria de destino", `invalid_amount` → "Valor inválido", `invalid_account` → "Selecione uma conta ativa", `invalid_receipt_url` → "URL inválida", `not_found` → "Registro não encontrado. Atualize a página e tente de novo", `validation_error` → "Dados inválidos. Revise os campos", `unauthorized` → "Sua sessão expirou. Entre novamente", `internal_error` e qualquer outro código ou falha de rede → "Não foi possível concluir a operação. Tente novamente." Use `error.field` para marcar o campo quando houver. Substitua todos os usos de `reason.message`/`error.message` nas telas de contas, categorias e extrato por essa função. Teste cada código.

3) Detecção de e-mail já cadastrado
- Em `src/features/auth/emailExists.ts`, `isEmailAlreadyRegistered(result)` deve retornar true quando: (a) `result.error?.code === "user_already_exists"`; ou (b) `result.data.user?.identities` é um array vazio; ou (c) `result.data.user` tem `confirmation_sent_at` e `created_at` e a diferença `confirmation_sent_at − created_at` é de pelo menos 1000 ms (GoTrue reenvia a confirmação para o usuário existente não confirmado e devolve o usuário antigo). Testes para os três casos e para um cadastro novo (diferença menor que 1000 ms) retornando false.

4) Contas: ativar e desativar com tratamento de erro
- Em `AccountsPage`, se a chamada falhar, mantenha o diálogo aberto e mostre a mensagem de `messageForError`.

5) Testes de UI do extrato (Vitest + Testing Library, API mockada), todos obrigatórios e verificados no arquivo de testes:
- categoria inline: escolher categoria salva sem formulário; com falha forçada, restaura a anterior e mostra "Não foi possível salvar a categoria"
- lote: marcar 2 linhas, aplicar categoria faz UMA chamada com os 2 ids; com falha, nada muda e a seleção permanece
- switch de neutra: persiste; com falha volta ao anterior
- busca com debounce de 300 ms (timers falsos): uma única consulta e página 1
- filtros emitem os parâmetros certos e reiniciam a página; "Limpar filtros" restaura
- ordenação por Valor alterna a ordem
- estado vazio, paginação, exclusão com confirmação e cancelamento, criar e editar pelo formulário

6) Dependências
- Mantenha `yarn.lock` sincronizado com `package.json` (`yarn install` sem alterações pendentes).

Ao final, `yarn test`, `yarn typecheck` e `yarn lint` devem passar em instalação limpa.
~~~~

### Importação (2026-10-05)

Feature `import` concluída no backend e no front (implementado direto em `web/`), **PASS na primeira iteração do Verifier**. Conferida no navegador com a API real: arquivo do extrato Nubank → prévia (14 novas, 6 neutras, categorias "Sem categoria" e "Investimentos") → confirmação ("14 transações importadas") → 14 transações, 1 lote, 1 anexo e 1 objeto no Storage; reenvio com linhas já importadas mostra "duplicadas" desmarcadas. `VITE_MOCK_AREAS` local passou a ser `creditExpenses,dashboard,investmentReturns`. A API agora precisa de `SUPABASE_PUBLISHABLE_KEY` no `api/.env` para o Storage (já documentado no `.env.example` e no README).

Observação de ambiente: o launcher do preview não conseguiu abrir `/Volumes/MacOnlySSD` após o reinício do app (erro `getcwd: Operation not permitted`); API e front foram subidos pelo shell. Rodar `pnpm -C api dev` e `yarn --cwd web dev` manualmente funciona.

