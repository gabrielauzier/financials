# Plano de implementação: bugs e melhorias da v1

Fonte: `docs/v1/bugs-e-melhorias.md` (26 itens, com as respostas do Q&A). Cada item foi conferido contra o código e contra o extrato `references/nubank_extrato_setembro.csv`. O plano agrupa os itens em 4 features, no fluxo spec-driven já usado (spec → design → tasks → lotes de worker → Verifier), uma branch por feature empilhada sobre a anterior.

## Decisões já tomadas (Q&A)

| Tema | Decisão |
| ---- | ------- |
| Paleta | Todas as famílias de cor do Tailwind (red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose, slate, gray, zinc, neutral, stone) nas tonalidades 400, 600 e 900. O banco guarda a chave (ex.: `blue-600`), não um hex. |
| Itens de cor de categoria | Um só item. |
| Arquivos importados | Lista dos lotes com botão de reimportar (reabre o preview a partir do arquivo guardado) e botão de baixar o arquivo. |
| Ícones de banco | Usar o repositório Tgentil/Bancos-em-SVG; alternativa só se houver algo melhor. Licença confirmada por você para uso pessoal. |
| `description` | Somente leitura, preenchida pelo import. Só o `name` é editável. Aparece no extrato (abaixo do nome) e no modal como texto informativo. |

## O que o código e o extrato de setembro mostram

| Item | Situação atual |
| ---- | -------------- |
| Toasts | `components/ui/sonner.tsx` existe, mas nenhuma tela usa toast. |
| Date picker | `calendar`, `popover`, `react-day-picker` e `date-fns` já estão no projeto. Falta o componente. |
| De/Até preenchidos, coluna Tipo, filtro mês/ano | Só front. A API já filtra por `from`/`to`. |
| `description` | Não existe coluna. O import grava só a contraparte do Pix em `name` e descarta o texto original. |
| Método `Other` | Falta no check de `payment_method` (migration 0003), nos enums da API e no front. |
| Seleção e preview do import | O confirm recebe `[{ index, neutral }]`; a categoria vem do parser. Não há "selecionar todas", nem modal de duplicadas, nem categoria por linha. |
| Arquivos importados | Existem `import_batches` e `attachments` (Storage), mas não há endpoint de listagem, reimportação nem download. |
| Cores e ícones | Não há `color` em `accounts` nem em `categories`. `Account.bank` é um enum (`Nubank`, `SofisaDireto`, `Neon`, `XP`, `Other`). |

### Causa do bug de transferências neutras e de métodos (reproduzido)

Rodei o parser atual sobre `nubank_extrato_setembro.csv` (96 linhas):

- **77 de 96 linhas saem `unrecognized`** e só 1 como `BankTransfer` conhecida. O parser só entende "Transferência enviada/recebida **pelo Pix**", "Débito em conta", "Pagamento de fatura" e "Dinheiro guardado…". O extrato real traz outros formatos:

| Descrição no extrato | Linhas | Hoje | Proposta de método |
| -------------------- | ------ | ---- | ------------------ |
| Compra no débito - … | 53 | `unrecognized` | `DebitCard` |
| Compra no débito via NuPay - … | 6 | `unrecognized` | `NuPay` |
| Estorno - Compra no débito / Ajuste de compra no débito | 8 | `unrecognized` | `DebitCard`, categoria *Estorno*, tipo Income |
| Transferência **Recebida** - … (sem "pelo Pix") | 3 | `unrecognized` | `BankTransfer` |
| Transferência enviada/recebida pelo Pix - … | 18 | ok | `PIX` |
| Reembolso recebido pelo Pix - … | 1 | `unrecognized` | `PIX` |
| Pagamento de boleto efetuado - … | 6 | `unrecognized` | `Boleto` |
| Pagamento de fatura | 1 | ok | `BankTransfer` |

  O mapeamento que você pediu (débito, crédito, Pix, transferências, `Other` para o resto) cobre isso, mais `NuPay`, `Boleto` e o estorno, que já existem nos enums.
- **Neutras:** as 3 "Transferência Recebida - GABRIEL VASCONCELOS AUZIER LTDA" nunca podem ser neutras hoje, porque caem em `unrecognized` e o `name` vira o texto inteiro (não o nome da contraparte). Esta é a causa para o titular com LTDA. A única linha "Transferência enviada pelo Pix - Gabriel Vasconcelos Auzier" tem o nome extraído certo e, com o titular cadastrado, a API a marcaria como neutra. Como você viu nenhuma marcada, falta confirmar na integração se o problema ali é o dado cadastrado, a API ou a tela. Isso é a primeira task da F2: um teste de integração com esse CSV e as duas contas (titulares "Gabriel Vasconcelos Auzier" e "Gabriel Vasconcelos Auzier LTDA"), que deve terminar com as 4 linhas neutras.

## Features, ordem e dependências

```
F1 transactions-ux ─► F2 import-fixes ─► F3 import-improvements ─► F4 colors-and-icons
```

F1 e F2 não dependem das cores. F3 e F4 usam os componentes de cor e ícone no preview, então os badges do preview ficam para o fim da F4.

### F1 · transactions-ux

| # | Item | Mudança | Teste |
| - | ---- | ------- | ----- |
| 1 | Fix De/Até vazios | Estado inicial sem datas; "Limpar filtros" também. | Render inicial sem `from`/`to`. |
| 2 | Esconder coluna Tipo | Remove a coluna; o filtro por tipo continua. | Sem cabeçalho "Tipo"; filtro envia `type`. |
| 3 | Toasts | Helper único sobre o `sonner`, mensagens em pt-BR e erro via `messageForError`. Aplicado em: categoria em massa, categoria numa linha, edição pelo modal, exclusão e criação. | Cada fluxo emite toast de sucesso e de erro. |
| 4 | Date Picker | Componente `DatePicker` (Popover + Calendar, locale pt-BR) que entrega `YYYY-MM-DD` sem passar por `Date` com fuso. Troca nos filtros e no formulário. | A string exata é enviada; borda de mês. |
| 5 | Filtro rápido mês/ano | Seletor que define `from`/`to`. Ativo, desabilita De/Até; digitar uma data desativa o rápido. | Exclusão mútua e parâmetros corretos. |
| 6 | `description` | Migration 0007 (`transactions.description text`). API devolve em GET/POST e aceita no POST/import, mas **PATCH não a altera**. O import grava o texto original. Extrato mostra abaixo do nome (fonte menor, cor fraca); o modal mostra como subtítulo. | Round-trip, RLS, PATCH ignora o campo, tela. |

### F2 · import-fixes (bugs)

| # | Item | Mudança |
| - | ---- | ------- |
| B0 | Reprodução | Teste de integração com `nubank_extrato_setembro.csv` (copiado como fixture) e as duas contas, afirmando status, método e neutras esperados. Falha primeiro. |
| B1 | Método `Other` | Migration 0007: `Other` no check. Enums da API (transações e import), tipos e rótulo "Outro" no front. |
| B2 | Mapeamento de método e formatos | Tabela única por prefixo, sem diferenciar caixa e acento: a tabela acima, com `Other` e status `unrecognized` para o que não casar. O nome da contraparte é extraído também de "Transferência Recebida/Enviada - …", "Reembolso … pelo Pix - …", "Compra no débito - …" e "Pagamento de boleto efetuado - …". O texto original vai para `description`. |
| B3 | Neutras | Corrigido pelo B2 para o LTDA; para a linha do Pix, a correção segue o achado do B0. Critério: as 4 transferências com seu nome saem neutras. |

### F3 · import-improvements

| # | Item | Mudança |
| - | ---- | ------- |
| I1 | Categoria no preview | O confirm aceita `categoryId` opcional por linha. A API valida que a categoria é do usuário. Select por linha no preview. |
| I2 | Selecionar todas | Checkbox no cabeçalho do preview seleciona as linhas selecionáveis (nova, duplicada, não reconhecida); estado indeterminado quando parcial. Linhas inválidas e ignoradas ficam de fora. |
| I3 | Preview: valor e coluna | Remove a coluna de despesa; mostra o Valor colorido (verde para receita, vermelho para despesa), como no extrato. |
| I4 | Confirmação de duplicadas | Ao clicar em "Confirmar importação" com linhas duplicadas selecionadas, abre um modal com a quantidade e as opções "Importar mesmo assim" e "Voltar". Sem duplicadas selecionadas, importa direto. |
| I5 | Arquivos importados | `GET /imports` (arquivo, conta, data, linhas importadas e ignoradas), `GET /imports/:id/file` (download pelo Storage com o token do usuário) e `POST /imports/:id/preview` (relê o arquivo guardado e devolve o preview, com as duplicatas marcadas). Tela com os botões "Reimportar" e "Baixar". |

### F4 · colors-and-icons

| # | Item | Mudança |
| - | ---- | ------- |
| C1 | Cor em categorias e contas | Migration 0008: `color` (chave da paleta, com check) em `categories` e `accounts`, com cor padrão para as categorias de sistema. API aceita e devolve `color`. Seletor de paleta (grade de cores 400/600/900) nos formulários. |
| C2 | Badges de categoria | `CategoryBadge` (shadcn Badge com a cor da categoria) nos selects do extrato (linha, modal, filtro, massa) e no select do preview do import. |
| C3 | Ícones de banco | `BankIcon` com SVGs do repositório sugerido (Nubank, Sofisa, Neon, XP; genérico para `Other`). Usado no extrato (conta), na lista de contas e no seletor de conta. A cor da conta aparece como detalhe visual. |

## Banco e API

| Migration | Conteúdo | Feature |
| --------- | -------- | ------- |
| 0007 | `transactions.description`; `payment_method` aceita `Other` | F1, F2 |
| 0008 | `accounts.color`, `categories.color` (+ cores padrão) | F4 |

Todas aditivas. Em produção entram com `supabase db push` depois do merge, com a sua confirmação, seguidas de redeploy da API e do front.

Contrato novo: `description` em transações; `color` em contas e categorias; `categoryId` no confirm; `GET /imports`, `GET /imports/:id/file`, `POST /imports/:id/preview`.

## Execução

1. Spec, design e tasks por feature; lotes de até 7 tasks; front e backend na mesma feature.
2. Verifier independente por feature, com sensor de mutação; itens de UI conferidos no navegador contra a API local.
3. Gates a cada commit: `pnpm -C api test`, typecheck e lint; `yarn --cwd web test`, typecheck e lint.
4. Um PR por feature, empilhado sobre o #11. O CI (#10) precisa estar verde antes dos merges.

| Feature | Tasks (aprox.) | Lotes |
| ------- | -------------- | ----- |
| F1 transactions-ux | 9 | 2 |
| F2 import-fixes | 6 | 1 |
| F3 import-improvements | 12 | 2 |
| F4 colors-and-icons | 10 | 2 |

## Riscos

- **Linha do Pix neutra:** o parser já a extrai corretamente, então a causa não está só no parser. O B0 dá o diagnóstico antes de qualquer correção.
- **Reimportação (I5):** o confirm relê o arquivo enviado na requisição; ler do Storage cria uma segunda origem de arquivo. O risco de duplicar em concorrência já registrado continua.
- **Dedupe por nome:** mudar o `name` extraído (B2) afeta a regra de duplicata por conteúdo (nome, dia, valor e tipo) para linhas sem identificador. Os extratos do Nubank trazem identificador, então o impacto é baixo, mas entra no teste.
- **Licença dos SVGs:** você confirmou uso pessoal; registro a origem e a licença num `NOTICE` ao copiar os arquivos.
- **Mocks do front:** precisam acompanhar `description`, `color` e os endpoints novos de import, para os testes não mascararem divergências.
