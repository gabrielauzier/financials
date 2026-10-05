# Roteiro de execução dos prompts Lovable

O front é construído no Lovable. Cada feature tem **um único prompt** em `.specs/features/<feature>/lovable.md`, que substitui as tasks de interface (fases "Web" de cada `tasks.md`). A API (Fastify + Supabase) continua sendo feita pelas tasks de `api/` e `supabase/`.

## Como os dois trabalhos se encaixam

- O front só conversa com o Supabase para **autenticação**; todos os dados vêm da API (AD-001, AD-002).
- Enquanto uma área da API não existe, o front roda com **mocks em memória** que reproduzem o contrato (códigos de erro incluídos). A variável `VITE_MOCK_AREAS` define quais áreas usam mock (`*` = todas, vazio = nenhuma). Quando a API de uma área fica pronta, remove-se a área da lista e o front passa a chamar `VITE_API_URL`.
- Por isso os prompts podem rodar **em paralelo** à implementação da API, na mesma ordem de features.

## Passo 0 — Preparação (uma vez)

1. Criar o projeto Supabase (ou usar o local do `supabase start`) com **confirmação de e-mail ligada**; anotar URL e anon key.
2. Criar o projeto no Lovable, conectar a integração com o Supabase **apenas para autenticação** e ativar a sincronização com o GitHub.
3. Definir como o código do Lovable entra neste repositório como `web/` (**decisão pendente**, ver D1 abaixo).
4. Configurar no Lovable as variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (pode ficar vazia no início) e `VITE_MOCK_AREAS=*`.

## Passo a passo dos prompts

Rodar na ordem. Cada prompt depende dos anteriores (reusa componentes e o cliente da API).

| # | Prompt | Depende de | Entrega no front | Tasks substituídas |
| - | ------ | ---------- | ---------------- | ------------------ |
| 1 | [auth](features/auth/lovable.md) | Passo 0 | Fundação: cliente da API, mocks, formatação, layout, cadastro, login, rota protegida | auth T14–T20 |
| 2 | [accounts-categories](features/accounts-categories/lovable.md) | 1 | `/contas`, `/categorias`, `AccountSelect`, `CategorySelect` | accounts-categories T12–T16 |
| 3 | [transactions](features/transactions/lovable.md) | 1, 2 | `/extrato` com filtros, formulário, edição inline, lote, neutra | transactions T13–T21 |
| 4 | [import](features/import/lovable.md) | 1, 2, 3 | `/importar` com prévia obrigatória e resumo | import T19–T23 |
| 5 | [credit-expenses](features/credit-expenses/lovable.md) | 1, 2 | `/cartao` com status manual | credit-expenses T8–T12 |
| 6 | [dashboards](features/dashboards/lovable.md) | 1, 2 | `/` com painéis, patrimônio e rendimentos | dashboards T14–T20 |

Os prompts 3, 4, 5 e 6 só dependem de 1 e 2 (e 4 também de 3 para o botão "Ver extrato"); a ordem acima segue a das features da API.

### Rotina de cada prompt

1. Abrir `features/<feature>/lovable.md` e colar o bloco do prompt no chat do Lovable (um prompt por vez; não juntar).
2. Esperar o Lovable terminar e abrir o preview com `VITE_MOCK_AREAS=*`.
3. Percorrer o **Checklist de aceite** do mesmo arquivo; o que falhar vira uma mensagem de correção curta no Lovable (citando o item do checklist).
4. Trazer o código para `web/` e rodar localmente `pnpm -C web typecheck`, `pnpm -C web lint` e `pnpm -C web test`.
5. Só avançar para o próximo prompt com os três comandos verdes e o checklist completo; fazer um commit por prompt.

## Troca de mocks pela API real (pontos de integração)

Quando as tasks de API de uma feature estiverem concluídas e verificadas, retirar a área do `VITE_MOCK_AREAS` e repetir o checklist do prompt contra a API real.

| Área(s) em `VITE_MOCK_AREAS` | Pode sair do mock quando | Observação |
| ---------------------------- | ------------------------- | ---------- |
| login/cadastro (não usam mock) | auth T1–T13 concluídas (JWT validado, `withUser`, RLS) | Login funciona só com o Supabase; as rotas da API passam a exigir o token |
| `accounts`, `categories` | accounts-categories T1–T11 concluídas | Confirmar seed de 17 categorias e códigos de erro |
| `transactions` | transactions T1–T12 concluídas | Confirmar fuso (`X-Timezone`) nos filtros de data |
| `import` | import T1–T18 concluídas | Testar com `references/exemplo_extrato_nubank.csv` e `exemplo_fatura_nubank.csv` |
| `creditExpenses` | credit-expenses T1–T7 concluídas | — |
| `dashboard`, `investmentReturns` | dashboards T1–T13 concluídas | Conferir que a soma por categoria bate com o total de despesas |

Tipos da API: depois de `pnpm -C api openapi:export` (auth T12), gerar localmente os tipos com `openapi-typescript` e substituir `src/lib/api/types.ts` escrito à mão; o `typecheck` deve acusar qualquer divergência de contrato (corrigir no front ou na API conforme a spec).

## Ordem sugerida de trabalho (API e front em paralelo)

```
API auth (T1–T13) ─────────────► Lovable 1 (auth)
API accounts-categories ───────► Lovable 2
API transactions ──────────────► Lovable 3
API import ────────────────────► Lovable 4
API credit-expenses ───────────► Lovable 5
API dashboards ────────────────► Lovable 6
Integração por área (tabela acima) à medida que cada API conclui
```

O prompt de uma feature pode rodar antes ou depois da API correspondente; o único requisito é que o prompt 1 exista antes dos demais.

## O que muda no processo de qualidade

- As fases "Web" dos `tasks.md` deixam de ser executadas pelo fluxo do `tlc-spec-driven`; o gate dessas partes passa a ser: checklist de aceite do prompt + `typecheck`, `lint` e `test` do `web/`. Os prompts exigem testes Vitest, mas o Lovable não garante que eles passem: **rodar localmente é obrigatório** antes de aceitar cada prompt.
- A regra de cálculo continua só na API (AD-003): o front apenas exibe. Qualquer cálculo de total no front é defeito.
- Dinheiro continua string decimal (AD-004) e o fuso vai em `X-Timezone` (AD-005): ambos estão nos prompts e nos checklists.
- A Verifier final de cada feature deve incluir uma conferência manual do checklist do prompt contra a API real, já que o front não tem teste de integração com ela.

## Decisões pendentes

| # | Decisão | Recomendação |
| - | ------- | ------------ |
| D1 | Como o repositório do Lovable vira `web/` neste projeto | Clonar o repositório do Lovable em `web/` (cópia versionada neste repo, sincronizando manualmente após cada prompt); alternativa: submódulo git. Este diretório ainda não é um repositório git |
| D2 | Detecção de "e-mail já cadastrado" | O prompt 1 usa regra provisória (`identities` vazio); a task auth T13 confirma o comportamento real e a função `isEmailAlreadyRegistered` pode precisar de ajuste |
