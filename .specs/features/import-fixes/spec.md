# Import: correções de método, formato e neutras (import-fixes) Specification

Origem: `docs/v1/plano-implementacao.md` (F2, itens B0 a B3 e a tabela "Causa do bug de transferências neutras e de métodos") e `docs/v1/bugs-e-melhorias.md` (seção Importação e respostas do Q&A). Escopo: `api/src/modules/import/`, enums de método de pagamento da API e do `web/`, `api/openapi.json` e a tela de preview. A migration `0007` (que já aceita `Other` e cria `transactions.description`) é consumida aqui, não alterada.

## Problem Statement

Rodando o parser atual sobre o extrato real de setembro (96 linhas), 77 saem `unrecognized`: o parser só entende o Pix com "pelo Pix", "Débito em conta", "Pagamento de fatura" e "Dinheiro guardado…". Nessas linhas o `name` vira o texto inteiro e o método vira `BankTransfer` por omissão. As três "Transferência Recebida - <titular LTDA> - …" nunca podem ser neutras, porque o `name` não é o nome da contraparte. A única transferência "enviada pelo Pix" para o próprio titular tem o nome extraído certo, mas o usuário a viu sem marca de neutra; a causa ali ainda não está confirmada. Além disso, o texto original do extrato é descartado (a coluna `description` existe desde a transactions-ux) e o método `Other` não existe na API nem no front.

## Goals

- [ ] Um teste de integração sobre uma fixture sanitizada derivada do extrato real de setembro (96 linhas) falha antes das correções e passa depois, afirmando status, método, categoria, tipo, nome e as 4 transferências neutras.
- [ ] Toda linha do extrato Nubank de conta recebe método, categoria e nome pela tabela de formatos; o que não casa vira `Other` com status `unrecognized`.
- [ ] `Other` ("Outro") é aceito pela API (transações e import), pelo `openapi.json` e exibido no front.
- [ ] O import grava em `transactions.description` o texto original do CSV.
- [ ] As 4 transferências com o nome de um titular saem neutras no JSON do preview, na tela do preview e depois do confirm.

## Out of Scope

Explicitamente excluído para evitar crescimento de escopo.

| Feature | Reason |
| ------- | ------ |
| Categoria por linha no preview, "selecionar todas", modal de duplicadas, coluna de valor colorido e arquivos importados | Pertencem à feature import-improvements (F3) |
| Badges coloridos de categoria e ícones de banco no preview | Pertencem à feature colors-and-icons (F4) |
| Mostrar `description` no preview | Não pedido; o preview continua mostrando `name` |
| Parser para outros bancos e outros formatos de Nubank | Sem amostra; o escopo é o extrato de conta e a fatura já suportados |
| Regravar o `name` ou a `description` de transações já importadas | Dados anteriores à F2 ficam como estão; sem backfill |
| Neutras por valor, data ou pareamento entre contas | Segue só a regra de nome de titular (IMP-08 da feature import) |
| Editar `description` | Somente leitura (decisão da transactions-ux) |
| Nova migration | A `0007` já aceita `Other` e `description` |
| Commitar o CSV real `references/nubank_extrato_setembro.csv` | Contém o nome do dono e contrapartes reais; só a fixture sanitizada entra no repositório |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida ou registrada aqui.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Fixture sanitizada | `api/test/fixtures/nubank_statement_sanitized.csv`, mesmo cabeçalho `Data,Valor,Identificador,Descrição`, 96 linhas, com a mesma contagem por formato do original (abaixo). Nomes, documentos, bancos de contraparte, valores e identificadores são fictícios; os identificadores são UUIDs novos e distintos | O original tem o nome real do dono e contrapartes reais; a fixture preserva só a forma | n |
| Contagem por formato na fixture | 53 "Compra no débito - X"; 6 "Compra no débito via NuPay - X"; 8 "Estorno" (4 "Estorno - Compra no débito - X" e 4 "Estorno - Ajuste de compra no débito - X"); 6 "Pagamento de boleto efetuado - X"; 17 "Transferência enviada pelo Pix - …" e 1 "Transferência recebida pelo Pix - …"; 3 "Transferência Recebida - …" (sem "pelo Pix"); 1 "Reembolso recebido pelo Pix - …"; 1 "Pagamento de fatura" | Conferido no original com `cut`/`sort`/`uniq`: 53+6+8+6+18+3+1+1 = 96 | n |
| Titulares da fixture | "Maria Souza Lima" (conta pessoa, Nubank) e "Maria Souza Lima LTDA" (conta empresa, Nubank). Das 17 Pix enviadas, uma vai para "Maria Souza Lima" (documento mascarado `•••.224.672-••`, como no original); as 3 "Transferência Recebida" vêm de "MARIA SOUZA LIMA LTDA" (caixa alta, CNPJ fictício, "NU PAGAMENTOS - IP (0260) Agência: 1 Conta: …"). As outras 16 Pix enviadas e a Pix recebida usam nomes fictícios sem relação com os titulares | Reproduz as 4 linhas esperadas como neutras, incluindo a diferença de caixa entre extrato e cadastro | n |
| Resultado esperado da fixture | Importando na conta pessoa: 96 linhas `new` (0 `unrecognized`); métodos: 61 `DebitCard` (53 compras + 8 estornos), 6 `NuPay`, 19 `PIX` (18 Pix + 1 reembolso), 4 `BankTransfer` (3 transferências + 1 fatura), 6 `Boleto`, 0 `Other`; categoria `Reversal` ("Estorno (de compras)") nos 8 estornos e `Uncategorized` nas outras 88; `Income` em 13 linhas (8 estornos, 1 Pix recebida, 3 transferências recebidas, 1 reembolso) e `Expense` nas outras 83; `neutral: true` exatamente nas 4 linhas com nome de titular | Contas feitas sobre as contagens acima e os sinais do original | n |
| Teste de reprodução primeiro | A T1 cria a fixture e a T2 o teste de integração, que é commitado vermelho (falha nas asserções de método, nome, categoria, `description` e neutras) e só fica verde ao fim da T6 e da T8; o teste e a fixture não mudam depois, a menos que a T8 prove que o dado esperado estava errado | Pedido do plano (B0): "Falha primeiro" | n |
| Onde mora a tabela de formatos | Uma única tabela em `api/src/modules/import/parsers/descriptions.ts`, usada só pelo parser de conta; a fatura (`date,title,amount`) segue sem tabela (sempre `CreditCard`) | Pedido do plano: "tabela única por prefixo" | n |
| Como o prefixo casa | Pela forma normalizada (`normalizeName`: sem acento, minúsculas, espaços colapsados) do início da descrição; as entradas são ordenadas do prefixo mais longo para o mais curto ("Compra no débito via NuPay" antes de "Compra no débito"), e o primeiro que casa vale | Evita que "Compra no débito" capture "via NuPay"; atende L-004 (caixa, acento e espaços definidos) | n |
| Como o nome é extraído | O nome vem do texto original (não do normalizado), com espaços colapsados e aparados e caixa preservada: após o primeiro " - " para compra, estorno (após o segundo " - ") e boleto; para transferências e reembolso, entre o primeiro e o segundo " - " | Mantém "Uber UBER *TRIP HELP.U" e "MARIA SOUZA LIMA LTDA" como no extrato; a comparação de titular é que normaliza | n |
| Nome contém " - " | Em compra, estorno e boleto o nome é todo o texto depois do prefixo (inclui " - " internos); em transferências o nome para no primeiro " - " (regra atual) e uma estrutura que não casa com `NOME - DOCUMENTO - BANCO Agência:` vira `Other`/`unrecognized` | Compra e boleto não têm campos depois do nome; transferências têm documento e banco | n |
| Mapeamento de método e categoria | "Compra no débito - X" e "Débito em conta": `DebitCard`; "Compra no débito via NuPay - X": `NuPay`; "Compra no crédito - X": `CreditCard`; "Estorno - (Compra\|Ajuste de compra) no débito - X": `DebitCard` e categoria `Reversal`; "Estorno - (Compra\|Ajuste de compra) no crédito - X": `CreditCard` e `Reversal`; "Transferência (recebida\|enviada) pelo Pix - …" e "Reembolso recebido pelo Pix - …": `PIX`; "Transferência (Recebida\|Enviada) - …" sem "pelo Pix": `BankTransfer`; "Pagamento de boleto efetuado - X": `Boleto`; "Pagamento de fatura": `BankTransfer`; "Dinheiro guardado com resgate planejado": `BankTransfer` e categoria `Investments`; todas as demais categorias `Uncategorized` | Tabela da seção "Causa do bug" do plano mais o comportamento atual preservado | n |
| Categoria `Reversal` | A chave `Reversal` já existe nas categorias de sistema (migration 0002, nome "Estorno (de compras)"); `categoryKey` do `ParsedRow` passa a aceitar `Reversal`. O reembolso Pix não é estorno de compra e fica `Uncategorized` | Chaves vêm do seed, não inventadas; o plano só pede estorno para a linha "Estorno - …" | n |
| Tipo | Sempre pelo sinal do valor (positivo `Income`, negativo `Expense`), inclusive no estorno | Regra atual do parser; o plano diz "tipo Income pelo sinal" | n |
| Estorno de outro tipo | "Estorno - <qualquer outra coisa> - X" vira `Other`, `unrecognized`, `Uncategorized`, com `name` igual ao texto | Só débito e crédito estão mapeados; o resto é "não mapeado" | n |
| Descrição sem o campo do nome | "Compra no débito", "Compra no crédito" ou "Pagamento de boleto efetuado" sem " - X": mantém o método da tabela, `name` igual ao texto da descrição e status `new` | O método é conhecido; falta só o nome | n |
| Não mapeado | Qualquer descrição que não casa: `paymentMethod` `Other`, `categoryKey` `Uncategorized`, `name` igual ao texto original como hoje (sem colapsar espaços), status `unrecognized`, e o preview mostra "Revise esta linha" | Pedido do Q&A: "Other para não mapeados"; o `name` bruto preserva a deduplicação por conteúdo já existente | n |
| `description` | Texto original da coluna Descrição com espaços colapsados e aparados e truncado em 500 pontos de código (não parte um par substituto); a fatura usa o `title`. O import grava essa string em `transactions.description` | A coluna não tem check de tamanho (decisão da transactions-ux, risco da F2); 500 é o limite da API | n |
| `description` de linha inválida | Texto da coluna, também normalizado; nunca é importada | `ParsedRow.description` é obrigatório; linha inválida não chega ao insert | n |
| Resposta do preview | `paymentMethod` do preview aceita todos os 8 métodos de `PAYMENT_METHODS` (inclui `Boleto`, `NuPay` e `Other`); o preview não devolve `description` | O parser agora emite `NuPay` e `Boleto`; o enum do preview só tinha 4 valores | n |
| Enum do web | `ImportPaymentMethod` passa a ser o mesmo tipo de `PaymentMethod`; os rótulos do preview reutilizam `paymentMethodLabels` de `web/src/features/transactions/labels.ts`, com `Other: "Outro"`, e o formulário do extrato deixa de ter cópia própria dos rótulos | Uma tabela de rótulos só; o formulário passa a oferecer "Outro" | n |
| Deduplicação por conteúdo | A regra não muda (`name` exato, dia local, valor e tipo); o nome agora é o extraído. Linhas com `identifier` seguem deduplicadas só pelo identificador. Transações importadas antes da F2 e sem identificador guardam o nome antigo (texto inteiro) e deixam de casar | O extrato Nubank de conta traz identificador em todas as linhas e a fatura não muda de nome; sem backfill (fora de escopo) | n |
| Regra de neutra | Mantida: nome normalizado igual a um nome de titular normalizado de qualquer conta do usuário, em linhas `new`, `unrecognized` e `duplicate`; vale para recebida e enviada | Sem heurística de valor ou data (IMP-08) | n |
| Causa da linha Pix não neutra | Não confirmada. A leitura do código mostra a cadeia correta para essa linha (nome extraído, `classify`, `toPreview`, `initialSelection` e `selectedPayload`), então a T8 reproduz, localiza e corrige; se o teste ficar verde só com a T6, a T8 não altera código de produção e registra no commit o achado (dado cadastrado do usuário) | Pedido explícito do plano: o achado do B0 define a correção do B3 | n |
| Dado cadastrado do usuário | O titular precisa estar na lista `holderNames` de alguma conta para a regra valer; a feature não cria nem corrige titulares | Cadastro de conta está fora do escopo | n |
| Códigos de erro | Sem mudança: `unsupported_format`, `bank_mismatch` e demais erros do import continuam como na feature import; `Other` inválido em transações continua `validation_error` 422 pelo mesmo caminho do método inválido (L-006) | Nenhum erro novo; a falha de método desconhecido já existe | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Reprodução com fixture sanitizada ⭐ MVP

**User Story**: Como desenvolvedor, quero um teste de integração sobre um extrato com os mesmos formatos do real, sem dados pessoais, para provar o bug e depois a correção.

**Why P1**: Sem reprodução o conserto da neutra do Pix seria um palpite.

**Acceptance Criteria** (each line is one EARS pattern):

1. The repositório SHALL conter a fixture `api/test/fixtures/nubank_statement_sanitized.csv` com 96 linhas, com a contagem por formato definida nas Assumptions, e SHALL NOT conter o nome, os documentos, os identificadores nem as contrapartes do extrato real.  <!-- IMPFIX-01 -->
2. WHEN o teste de integração gera o preview da fixture na conta com titular "Maria Souza Lima" (havendo outra conta com titular "Maria Souza Lima LTDA") THEN o teste SHALL afirmar os 96 status `new`, os métodos por formato (61 `DebitCard`, 6 `NuPay`, 19 `PIX`, 4 `BankTransfer`, 6 `Boleto`), a categoria `Reversal` nos 8 estornos, o tipo por sinal e os nomes extraídos.  <!-- IMPFIX-01 -->
3. WHEN o mesmo teste lê o preview THEN ele SHALL afirmar `neutral: true` exatamente na Pix enviada para "Maria Souza Lima" e nas 3 "Transferência Recebida" de "MARIA SOUZA LIMA LTDA", e `neutral: false` nas outras 92 linhas.  <!-- IMPFIX-01 -->
4. WHEN o mesmo teste confirma o import das 96 linhas com as marcas de neutra do preview THEN ele SHALL afirmar nas transações gravadas `payment_method`, `name`, `neutral` e `description` iguais ao esperado.  <!-- IMPFIX-01 -->
5. The teste SHALL ser commitado antes das correções e falhar nas asserções de método, nome, categoria, `description` e neutras (estado vermelho registrado na T2).  <!-- IMPFIX-01 -->

**Independent Test**: Rodar só `api/test/import-fixes.int.test.ts` antes das correções e ver as falhas listadas; depois da T8, ver tudo verde.

---

### P1: Método `Other` na API e no front ⭐ MVP

**User Story**: Como usuário, quero o método de pagamento "Outro" para o que o import não reconhece e para lançamentos manuais.

**Why P1**: O mapeamento usa `Other` para tudo que não casa; sem ele o insert falharia no check.

**Acceptance Criteria**:

1. The API SHALL aceitar `Other` em `paymentMethod` na criação e na edição de transações e devolvê-lo na leitura.  <!-- IMPFIX-02 -->
2. IF `paymentMethod` não está entre `BankTransfer`, `Boleto`, `Cash`, `CreditCard`, `DebitCard`, `NuPay`, `PIX` e `Other` THEN a API SHALL responder 422 `validation_error` no campo `paymentMethod` com a lista que inclui `Other`.  <!-- IMPFIX-02 -->
3. The resposta do preview do import SHALL aceitar em `paymentMethod` os 8 métodos, incluindo `Boleto`, `NuPay` e `Other`.  <!-- IMPFIX-02 -->
4. The `api/openapi.json` SHALL listar `Other` nos enums e nas descrições de método de pagamento, regenerado por `pnpm -C api openapi:export` e conferido pelo teste de swagger.  <!-- IMPFIX-02 -->
5. The tipos `PaymentMethod` e `ImportPaymentMethod` do `web/` SHALL incluir `Other`, e o rótulo exibido para `Other` SHALL ser "Outro" no extrato, no formulário e no preview do import.  <!-- IMPFIX-03 -->
6. The preview do import SHALL exibir o rótulo em português de cada um dos 8 métodos, incluindo "Boleto", "NuPay" e "Outro".  <!-- IMPFIX-03 -->
7. The mock de transações do `web/` SHALL incluir `Other` entre os métodos gerados.  <!-- IMPFIX-03 -->

**Independent Test**: Criar uma transação com `paymentMethod: "Other"` pela API e ver "Outro" no extrato.

---

### P1: Mapeamento de formatos de descrição ⭐ MVP

**User Story**: Como usuário, quero que o import reconheça débito, NuPay, estorno, transferências, reembolso, boleto e fatura, com o método e o nome certos, para não revisar linha por linha.

**Why P1**: 77 das 96 linhas do extrato real saíam `unrecognized`.

**Acceptance Criteria**:

1. The parser de conta SHALL decidir método, categoria e extração de nome por uma única tabela de formatos, casando o início da descrição sem diferenciar caixa nem acento.  <!-- IMPFIX-04 -->
2. WHEN a descrição é "Compra no débito - X" THEN o parser SHALL definir `DebitCard`, categoria `Uncategorized`, `name` igual a X e status `new`.  <!-- IMPFIX-04 -->
3. WHEN a descrição é "Compra no débito via NuPay - X" THEN o parser SHALL definir `NuPay`, `name` igual a X e status `new`.  <!-- IMPFIX-04 -->
4. WHEN a descrição é "Compra no crédito - X" THEN o parser SHALL definir `CreditCard`, `name` igual a X e status `new`.  <!-- IMPFIX-04 -->
5. WHEN a descrição é "Estorno - Compra no débito - X" ou "Estorno - Ajuste de compra no débito - X" THEN o parser SHALL definir `DebitCard`, categoria `Reversal`, `name` igual a X e o tipo pelo sinal do valor.  <!-- IMPFIX-04 -->
6. WHEN a descrição é "Estorno - Compra no crédito - X" ou "Estorno - Ajuste de compra no crédito - X" THEN o parser SHALL definir `CreditCard`, categoria `Reversal` e `name` igual a X.  <!-- IMPFIX-04 -->
7. WHEN a descrição é "Transferência recebida pelo Pix - NOME - DOC - BANCO Agência: …" ou "Transferência enviada pelo Pix - …" THEN o parser SHALL definir `PIX`, `name` igual a NOME, `counterpartyDocument` igual a DOC e `counterpartyBank` igual a BANCO.  <!-- IMPFIX-05 -->
8. WHEN a descrição é "Transferência Recebida - NOME - DOC - BANCO Agência: …" ou "Transferência Enviada - …" (sem "pelo Pix") THEN o parser SHALL definir `BankTransfer`, `name` igual a NOME e extrair documento e banco.  <!-- IMPFIX-05 -->
9. WHEN a descrição é "Reembolso recebido pelo Pix - NOME - DOC - BANCO Agência: …" THEN o parser SHALL definir `PIX`, categoria `Uncategorized`, `name` igual a NOME e extrair documento e banco.  <!-- IMPFIX-05 -->
10. WHEN a descrição é "Pagamento de boleto efetuado - X" THEN o parser SHALL definir `Boleto`, `name` igual a X e status `new`.  <!-- IMPFIX-04 -->
11. WHEN a descrição é "Pagamento de fatura" THEN o parser SHALL definir `BankTransfer` e status `new`.  <!-- IMPFIX-04 -->
12. WHEN a descrição é "Débito em conta" ou "Dinheiro guardado com resgate planejado" THEN o parser SHALL manter o comportamento atual (`DebitCard`; `BankTransfer` com categoria `Investments`).  <!-- IMPFIX-04 -->
13. WHEN o prefixo aparece em outra caixa ou sem acento (ex.: "COMPRA NO DEBITO - x") THEN o parser SHALL aplicar o mesmo mapeamento do prefixo canônico.  <!-- IMPFIX-04 -->
14. WHEN o nome extraído contém espaços repetidos THEN o parser SHALL colapsá-los em um espaço e apará-los, preservando a caixa.  <!-- IMPFIX-05 -->
15. WHEN a descrição é "Compra no débito via NuPay - X" THEN o parser SHALL escolher `NuPay` e não `DebitCard`.  <!-- IMPFIX-04 -->
16. IF a descrição não casa com nenhum formato da tabela (inclui "Estorno - " de outro tipo e transferência sem a estrutura `NOME - DOC - BANCO Agência:`) THEN o parser SHALL definir `Other`, categoria `Uncategorized`, `name` igual ao texto original e status `unrecognized`.  <!-- IMPFIX-07 -->
17. The tipo da linha (`Income` ou `Expense`) SHALL continuar vindo do sinal do valor para todos os formatos.  <!-- IMPFIX-04 -->

**Independent Test**: Parsear uma linha de cada formato e conferir método, categoria, nome e documento; parsear "Qualquer coisa" e ver `Other` com `unrecognized`.

---

### P1: `description` gravada pelo import ⭐ MVP

**User Story**: Como usuário, quero que cada transação importada guarde o título original do extrato, para reconhecê-la depois.

**Why P1**: O nome extraído descarta o resto do texto; a `description` preserva o original.

**Acceptance Criteria**:

1. The parser SHALL preencher `description` de toda linha com o texto original da coluna Descrição (ou `title` na fatura), com espaços colapsados e aparados.  <!-- IMPFIX-06 -->
2. WHEN o texto original excede 500 pontos de código THEN o parser SHALL truncar `description` em exatamente 500 pontos de código, sem partir um par substituto.  <!-- IMPFIX-06 -->
3. WHEN o import é confirmado THEN o sistema SHALL gravar `transactions.description` com o `description` da linha, e a leitura da API (`GET /transactions`) SHALL devolvê-lo.  <!-- IMPFIX-06 -->
4. WHEN o texto original tem 500 pontos de código ou menos THEN o sistema SHALL gravá-lo inteiro, sem alteração além do colapso de espaços.  <!-- IMPFIX-06 -->
5. The `description` SHALL NOT mudar o `name` gravado nem a regra de neutra.  <!-- IMPFIX-06 -->

**Independent Test**: Confirmar a fixture e ler, por `GET /transactions`, o texto original de uma "Compra no débito - X" na `description` e X no `name`.

---

### P1: Deduplicação íntegra com os novos nomes ⭐ MVP

**User Story**: Como usuário, quero que reimportar o mesmo arquivo continue sendo detectado como duplicado depois que o nome passa a ser a contraparte.

**Why P1**: A deduplicação por conteúdo usa `name`; mudar o `name` sem teste poderia quebrá-la.

**Acceptance Criteria**:

1. WHEN uma linha com `identifier` já existe na conta THEN o preview SHALL marcá-la `duplicate` independentemente do `name` guardado.  <!-- IMPFIX-08 -->
2. WHEN uma linha sem `identifier` tem o mesmo `name` extraído, dia local, valor e tipo de uma transação já importada da conta THEN o preview SHALL marcá-la `duplicate`.  <!-- IMPFIX-08 -->
3. WHEN uma linha sem `identifier` difere só no `name` extraído de uma transação existente THEN o preview SHALL mantê-la `new`.  <!-- IMPFIX-08 -->
4. WHEN o arquivo é importado de novo logo após o confirm THEN o preview SHALL marcar as 96 linhas da fixture como `duplicate`.  <!-- IMPFIX-08 -->

**Independent Test**: Confirmar a fixture e gerar o preview dela de novo: 96 `duplicate`.

---

### P1: Transferências próprias neutras ⭐ MVP

**User Story**: Como usuário, quero que as transferências entre minhas contas cheguem marcadas como neutras no preview e fiquem neutras depois do confirm.

**Why P1**: Bug reportado: nenhuma das 4 transferências com o nome do titular saiu neutra.

**Acceptance Criteria**:

1. WHEN o nome extraído de uma linha `new`, `unrecognized` ou `duplicate`, normalizado, é igual ao nome normalizado de um titular de qualquer conta do usuário THEN o preview SHALL devolver `neutral: true` para ela.  <!-- IMPFIX-09 -->
2. WHEN o extrato traz "Transferência Recebida - MARIA SOUZA LIMA LTDA - …" e uma conta tem o titular "Maria Souza Lima LTDA" THEN o preview SHALL devolver `neutral: true` para a linha.  <!-- IMPFIX-09 -->
3. WHEN o extrato traz "Transferência enviada pelo Pix - Maria Souza Lima - …" e uma conta tem o titular "Maria Souza Lima" THEN o preview SHALL devolver `neutral: true` para a linha.  <!-- IMPFIX-09 -->
4. WHEN o nome extraído não é igual a nenhum titular (inclui um nome que só contém o titular como prefixo, como "Maria Souza Lima Santos") THEN o preview SHALL devolver `neutral: false`.  <!-- IMPFIX-09 -->
5. WHEN a linha neutra do preview é confirmada sem o usuário mexer na chave THEN o sistema SHALL gravar `transactions.neutral = true`.  <!-- IMPFIX-09 -->
6. WHEN o preview chega ao front com `neutral: true` THEN a tela SHALL exibir a chave "Neutra" ligada nessa linha, selecionada ou não.  <!-- IMPFIX-10 -->
7. WHEN o usuário seleciona ou desmarca uma linha neutra THEN o front SHALL manter a chave "Neutra" no valor do preview.  <!-- IMPFIX-10 -->
8. WHEN o usuário confirma com uma linha neutra selecionada THEN o front SHALL enviar `{ index, neutral: true }` para essa linha.  <!-- IMPFIX-10 -->
9. WHEN o usuário desliga a chave "Neutra" de uma linha THEN o front SHALL enviar `neutral: false` para ela.  <!-- IMPFIX-10 -->
10. IF o teste de integração da fixture continua falhando só na linha Pix depois do mapeamento de formatos THEN a correção SHALL ser aplicada na camada onde a causa for provada (`classify`, `toPreview`, leitura da resposta ou tela) e SHALL ter teste de regressão nessa camada.  <!-- IMPFIX-09 -->

**Independent Test**: Preview da fixture com as duas contas: 4 linhas `neutral: true`; na tela, 4 chaves ligadas; confirmar e ler 4 transações com `neutral = true`.

---

## Edge Cases

- IF a descrição fica vazia ou só com espaços THEN o sistema SHALL manter a linha `invalid` com a razão "Empty description" (regra atual, sem `description` gravada).
- WHEN a descrição tem mais de 500 pontos de código THEN o sistema SHALL truncar só a `description` e manter o `name` extraído.
- WHEN o texto original tem tabulações ou espaços repetidos THEN o sistema SHALL colapsá-los em um espaço na `description`.
- WHEN o prefixo está em caixa alta ou sem acento (ex.: "TRANSFERENCIA RECEBIDA - …") THEN o sistema SHALL mapear como "Transferência Recebida".
- WHEN a Pix enviada tem documento mascarado (`•••.224.672-••`) THEN o sistema SHALL extrair o nome e guardar o documento mascarado como texto.
- WHEN a descrição é "Compra no débito" sem " - X" THEN o sistema SHALL definir `DebitCard`, `name` igual à descrição e status `new`.
- WHEN o nome de uma "Compra no débito - X" contém " - " THEN o sistema SHALL usar todo o texto depois do primeiro " - " como `name`.
- WHEN um titular tem o mesmo nome de uma contraparte com outra caixa ou sem acento THEN o sistema SHALL tratar a linha como neutra.
- WHEN o mesmo arquivo da fixture é confirmado duas vezes com a mesma chave de idempotência THEN o sistema SHALL devolver o resumo da primeira (regra existente), sem regravar `description`.

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| IMPFIX-01 | P1: Reprodução com fixture sanitizada | In Tasks | Verified |
| IMPFIX-02 | P1: Método `Other` na API e no front | In Tasks | Verified |
| IMPFIX-03 | P1: Método `Other` na API e no front | In Tasks | Verified |
| IMPFIX-04 | P1: Mapeamento de formatos de descrição | In Tasks | Verified |
| IMPFIX-05 | P1: Mapeamento de formatos de descrição | In Tasks | Verified |
| IMPFIX-06 | P1: `description` gravada pelo import | In Tasks | Verified |
| IMPFIX-07 | P1: Mapeamento de formatos de descrição | In Tasks | Verified |
| IMPFIX-08 | P1: Deduplicação íntegra com os novos nomes | In Tasks | Verified |
| IMPFIX-09 | P1: Transferências próprias neutras | In Tasks | Verified |
| IMPFIX-10 | P1: Transferências próprias neutras | In Tasks | Verified |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] O teste de integração da fixture sanitizada passa com as 4 transferências neutras, os métodos esperados por formato e a `description` gravada.
- [ ] `pnpm -C api test` e `yarn --cwd web test`, mais typecheck e lint de cada app, passam.
- [ ] No navegador, contra a API local, importando a fixture: nenhuma linha "não reconhecida", 4 chaves "Neutra" ligadas e "Outro" listado entre os métodos do formulário do extrato.
- [ ] Rodando o extrato real (`references/nubank_extrato_setembro.csv`, que continua fora do repositório) com as duas contas cadastradas, o dono confirma que as 4 transferências saem neutras.
