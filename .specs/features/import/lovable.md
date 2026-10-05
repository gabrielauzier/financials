# Importação de CSV — Prompt Lovable

**Specs**: `.specs/features/import/spec.md` · **Design**: `.specs/features/import/design.md`
**Substitui as tasks de interface**: T19–T23 de `tasks.md` (hooks, etapa conta/arquivo, tabela de prévia, resumo, página).
**Pré-requisito**: prompts `auth`, `accounts-categories` e `transactions` aplicados.

## Prompt (colar no Lovable)

~~~~text
Continue o app "Financials" (React + Vite + TS + Tailwind + shadcn/ui + TanStack Query, UI em pt-BR). Mantenha as regras de arquitetura: dados só pela API via `src/lib/api/client.ts`, mocks em `src/lib/api/mock/` para as áreas listadas em `VITE_MOCK_AREAS`, dinheiro como string. Implemente o fluxo de importação de extratos CSV na rota `/importar`, em `src/features/import/`. É um assistente (wizard) de 3 passos: Conta e arquivo → Prévia → Resumo.

## Ajuste prévio no cliente da API
O `apiRequest` em `src/lib/api/client.ts` hoje sempre serializa o corpo com `JSON.stringify` e define `Content-Type: application/json`. Estenda-o para aceitar `FormData`: quando o corpo for `FormData`, envie-o sem `JSON.stringify` e SEM definir `Content-Type` (o navegador define o boundary). Mantenha o comportamento atual para os demais corpos, os headers `Authorization` e `X-Timezone`, e o tratamento de 401. Adicione teste cobrindo o envio de `FormData`.

## Regra central
A PRÉVIA É SEMPRE OBRIGATÓRIA e não grava nada. A gravação só acontece em "Confirmar importação". O cliente mantém o objeto `File` escolhido: ele é enviado na prévia e REENVIADO, o mesmo arquivo, na confirmação (o servidor reanalisa o arquivo; as linhas da prévia nunca são enviadas de volta, apenas os índices selecionados).

## Contrato da API (multipart/form-data)
Erros: `{ "error": { "code", "message", "field"? } }`.
- `POST /imports/preview` campos: `file`, `accountId` → `{ rows: PreviewRow[], totals: { new: number, duplicate: number, ignored: number, unrecognized: number, invalid: number } }`
  `PreviewRow = { index: number, localDate: "YYYY-MM-DD", type: "Income"|"Expense", amount: string, name: string, paymentMethod: "PIX"|"DebitCard"|"BankTransfer"|"CreditCard", categoryName: string, status: "new"|"duplicate"|"ignored"|"unrecognized"|"invalid", neutral: boolean, reason?: string, counterpartyDocument?: string|null, counterpartyBank?: string|null }`
- `POST /imports/confirm` campos: `file`, `accountId`, `idempotencyKey` (uuid), `selections` (JSON string: `[{ "index": number, "neutral": boolean }]`, somente linhas marcadas) → `{ batchId: uuid, imported: number, skipped: number }`
Códigos de erro: `unsupported_format` (422), `file_too_large` (413), `bank_mismatch` (422), `empty_file` (422), 404, 422 para índice não selecionável.
Hoje só existe suporte a CSV do Nubank (extrato da conta e fatura do cartão), e a conta de destino precisa ser de banco Nubank. Outros bancos respondem `unsupported_format`.

## Mocks
`/imports/preview` deve analisar de verdade os dois formatos de exemplo no próprio mock, para o fluxo ser demonstrável:
- Extrato da conta Nubank: cabeçalho `Data,Valor,Identificador,Descrição`, datas dd/mm/aaaa, valor negativo = despesa. Descrições "Transferência recebida/enviada pelo Pix - NOME - documento - banco Agência: ..." → método PIX e nome extraído; "Débito em conta" → Cartão de débito; "Pagamento de fatura" → despesa; "Dinheiro guardado com resgate planejado" → categoria Investimentos; qualquer outra → status `unrecognized`.
- Fatura do cartão Nubank: cabeçalho `date,title,amount`, valores como "1.335,61"; positivo = despesa no cartão de crédito; negativo (ex.: "- 1.335,61") = status `ignored`.
- Marque `duplicate` quando o identificador/nome+data+valor já constar no mock e `neutral: true` quando o nome do titular bater com um titular de conta do usuário (ignorando maiúsculas e acentos).
`/imports/confirm` do mock: idempotente por `idempotencyKey` (repetir devolve o mesmo resumo sem inserir de novo).

## Passo 1 — Conta e arquivo
Seletor de conta (`AccountSelect`, só ativas) e seletor/arrastar-soltar de arquivo `.csv`. Bloqueie no cliente arquivo acima de 5 MB ("Arquivo excede 5 MB") e extensão diferente de .csv. Botão "Gerar prévia" chama `/imports/preview` e exibe erros do servidor: `unsupported_format` "Formato de arquivo não reconhecido", `bank_mismatch` "Formato incompatível com a conta selecionada", `empty_file` "O arquivo não tem linhas", `file_too_large` "Arquivo excede 5 MB". Gere um `idempotencyKey` (uuid v4) ao entrar na prévia e mantenha-o estável em reenvios da mesma sessão.

## Passo 2 — Prévia
Resumo no topo com contagens (novas, duplicadas, ignoradas, não reconhecidas, inválidas). Tabela com checkbox por linha, Data, Nome, Método, Categoria, Tipo, Valor (`formatBRL`), Neutra e Status:
- Badges: "Nova", "Duplicada", "Ignorada", "Não reconhecida", "Inválida" (com `reason` em tooltip).
- Linhas `duplicate` vêm DESMARCADAS; o usuário pode marcá-las (isso equivale a desmarcar a flag "duplicada") e depois desmarcar de novo.
- Linhas `new` e `unrecognized` vêm marcadas; `unrecognized` ficam destacadas com "Revise esta linha".
- Linhas `ignored` e `invalid` não têm checkbox e nunca são enviadas.
- Switch "Neutra" por linha (inicia com o valor sugerido pelo servidor); a escolha vai em `selections`. Ajuda: "Transferências entre suas próprias contas são marcadas como neutras automaticamente."
- Contador "N linhas selecionadas" e botão "Confirmar importação" (desabilitado com 0 selecionadas) e "Cancelar" (volta ao passo 1 sem chamar a API de confirmação).

## Passo 3 — Resumo
Após confirmar: "X transações importadas, Y ignoradas" e botões "Ver extrato" (vai para `/extrato`) e "Importar outro arquivo". Em erro de gravação: mensagem "Nada foi importado. Tente novamente." mantendo a prévia e a mesma `idempotencyKey`.

## Hooks
`useImportPreview()` e `useImportConfirm()` em `src/features/import/useImport.ts` (multipart via `FormData`; sem converter dinheiro em número).

## Testes
Vitest + Testing Library: bloqueio de arquivo grande/extensão, tradução dos erros do servidor, duplicadas desmarcadas e marcáveis, ignoradas/inválidas sem checkbox, neutra editável refletida no payload, confirmar desabilitado com 0 linhas, reenvio do mesmo arquivo com a mesma `idempotencyKey`, cancelar sem chamar confirmação, resumo e erro de gravação.

## Fora do escopo
PDF, Sofisa Direto/Neon/XP, categorização automática, desfazer importação.
~~~~

## Checklist de aceite

- [ ] Prévia nunca grava; cancelar não chama `/imports/confirm` (IMP-05.10).
- [ ] Duplicadas começam desmarcadas e são marcáveis (IMP-05.5/6).
- [ ] Confirmar reenvia o arquivo, `accountId`, `idempotencyKey` e só os índices marcados (IMP-07).
- [ ] Ignoradas e inválidas não podem ser selecionadas.
- [ ] Neutras sugeridas ficam sinalizadas e editáveis (IMP-08).
- [ ] Resumo mostra importadas e ignoradas (IMP-05.8).
