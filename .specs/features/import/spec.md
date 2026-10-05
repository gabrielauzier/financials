# Importação de CSV Specification

Fonte: `docs/PRD.md` §5.5 (US-10, US-10b, US-11, US-12, 5.5.1, 5.5.2); amostras `references/exemplo_extrato_nubank.csv` e `references/exemplo_fatura_nubank.csv`.

## Problem Statement

Extratos de bancos diferentes chegam em CSV sem categoria. O usuário precisa importá-los com uma prévia obrigatória, sem duplicar transações já importadas, com transferências entre contas próprias marcadas como neutras e com o arquivo original guardado para auditoria. O MVP cobre apenas os formatos Nubank (conta e fatura de cartão), os únicos com amostra.

## Goals

- [ ] ≥90% das linhas de um CSV Nubank são importadas corretamente sem edição manual (exceto categoria).
- [ ] Reimportar o mesmo arquivo grava 0 transações novas.
- [ ] Todo arquivo confirmado fica guardado como anexo ligado ao seu lote.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| CSV de Sofisa Direto, Neon e XP | Sem amostra (PRD Q6); parser entra quando houver arquivo |
| Importação de PDF | Fora do MVP |
| Categorização automática | Fora do MVP |
| Parcelas futuras de compras parceladas | Cada parcela é uma linha da fatura; sem modelagem de parcelamento |
| Desfazer uma importação confirmada | Não pedido |
| Neutras por valor/data (pareamento) | Fora do MVP; só por nome de titular |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Detecção do formato | Pelo cabeçalho: `Data,Valor,Identificador,Descrição` (conta) ou `date,title,amount` (fatura); o banco da conta deve ser Nubank | Cabeçalhos das amostras são inequívocos | n |
| Codificação | UTF-8, com ou sem BOM | Amostras em UTF-8 | n |
| Tamanho máximo do arquivo | 5 MB | PRD não define; extratos pessoais são pequenos | n |
| Espaços repetidos no nome extraído | Colapsados para um espaço e aparados | Amostra tem "SOLUCOES  PUBLICIDADE" com dois espaços | n |
| Nome da contraparte contém " - " | Não suportado; a linha vai para "não reconhecida" | PRD define nome como texto entre o 1º e o 2º " - " | n |
| Escopo da deduplicação | Mesma conta | Mesmo `identifier` pode existir em bancos diferentes | n |
| Nome+data+valor na deduplicação | Compara nome, data (dia local), valor e tipo | PRD: nome + data + valor | n |
| Compras idênticas no mesmo dia na fatura | Sinalizadas como duplicadas; usuário desmarca na prévia | PRD US-11 | n |
| Linha "Pagamento recebido" da fatura | Ignorada, listada na prévia como ignorada | PRD 5.5.2 | n |
| Linha de extrato não reconhecida | Importável com nome = descrição, categoria *Sem categoria*, método BankTransfer, sinalizada na prévia | PRD: nome = descrição completa e sinalizar | n |
| Tipo da linha de extrato | Valor negativo = Expense, positivo = Income | PRD 5.5.1 | n |
| Linha com Valor 0,00 | Não reconhecida; vai para "não reconhecida" | Valor zero é inválido em Transactions | n |
| Neutra automática na fatura | Mesma regra de nomes de titular | Regra única por spec; não afeta compras comuns | n |
| Abrangência de nomes de titular | Contas ativas e inativas do usuário | Alinhado à spec `accounts-categories` | n |
| Data sem hora | Meia-noite no fuso local do usuário | PRD 5.5.1 | n |
| Armazenamento do anexo | Supabase Storage + tabela `Attachment` | PRD §9 | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Importar extrato Nubank (conta) ⭐ MVP

**User Story**: Como usuário, quero importar o CSV do extrato da conta Nubank para não digitar transações.

**Why P1**: É a principal fonte de dados do produto.

**Acceptance Criteria**:

1. WHEN o usuário envia um CSV com cabeçalho `Data,Valor,Identificador,Descrição` para uma conta ativa de banco Nubank THEN o sistema SHALL gerar a prévia de importação com as linhas lidas.
2. IF o cabeçalho não corresponde a nenhum formato Nubank suportado THEN o sistema SHALL rejeitar o arquivo com mensagem do erro e não gerar prévia.
3. IF o arquivo excede 5 MB THEN o sistema SHALL rejeitá-lo com mensagem de tamanho excedido.
4. IF o arquivo escolhido é de formato Nubank mas a conta de destino é de outro banco THEN o sistema SHALL rejeitar a importação com mensagem de formato incompatível.
5. WHEN a coluna Data tem formato `dd/mm/aaaa` THEN o sistema SHALL converter para a meia-noite desse dia no fuso local do usuário.
6. WHEN o Valor é negativo THEN o sistema SHALL criar a linha como Expense com o valor absoluto; WHEN positivo, como Income.
7. WHEN a Descrição segue `Transferência (recebida|enviada) pelo Pix - <NOME> - <documento> - <banco> Agência: ...` THEN o sistema SHALL extrair `name` = NOME, `counterparty_document` = documento, `counterparty_bank` = texto entre o documento e " Agência:", e `payment_method` = PIX.
8. WHEN a Descrição é "Débito em conta" THEN o sistema SHALL criar a linha com `name` igual à descrição, `payment_method` = DebitCard e categoria *Sem categoria*.
9. WHEN a Descrição é "Pagamento de fatura" THEN o sistema SHALL criar a linha como Expense com `name` igual à descrição, `payment_method` = BankTransfer e categoria *Sem categoria*.
10. WHEN a Descrição é "Dinheiro guardado com resgate planejado" THEN o sistema SHALL criar a linha com `name` igual à descrição, `payment_method` = BankTransfer e categoria *Investimentos*.
11. IF a Descrição não casa com nenhum padrão conhecido THEN o sistema SHALL criar a linha com `name` igual à descrição, `payment_method` = BankTransfer, categoria *Sem categoria* e sinalizá-la como "não reconhecida" na prévia.
12. WHEN o nome extraído tem espaços repetidos THEN o sistema SHALL colapsá-los em um espaço.
13. WHEN a linha é lida THEN o sistema SHALL usar a coluna Identificador como `identifier`.

**Independent Test**: Importar `references/exemplo_extrato_nubank.csv`: 14 linhas na prévia; Pix recebido de "MERCADO AUTO SOLUCOES PUBLICIDADE E TECNOLOGIA LTDA" com documento `41.460.383/0001-68`, banco `BCO SANTANDER (BRASIL) S.A. (0033)`, Income 8608,00.

---

### P1: Importar fatura Nubank (cartão) ⭐ MVP

**User Story**: Como usuário, quero importar o CSV da fatura do cartão Nubank para acompanhar os gastos do cartão por categoria.

**Why P1**: Pedido do usuário na discovery; alimenta a visão de cartão.

**Acceptance Criteria**:

1. WHEN o usuário envia um CSV com cabeçalho `date,title,amount` para uma conta ativa de banco Nubank THEN o sistema SHALL gerar a prévia com as linhas lidas.
2. WHEN a coluna date tem formato `aaaa-mm-dd` THEN o sistema SHALL converter para a meia-noite desse dia no fuso local do usuário.
3. WHEN o amount tem formato `1.335,61` (vírgula decimal, ponto de milhar) THEN o sistema SHALL interpretá-lo como 1335,61.
4. WHEN o amount é positivo THEN o sistema SHALL criar a linha como Expense com `payment_method` = CreditCard, `name` = title integral e categoria *Sem categoria*.
5. WHEN o amount é negativo (ex.: `- 1.335,61`) THEN o sistema SHALL marcar a linha como "ignorada" e não importá-la.
6. WHEN o title contém "Parcela 3/6" THEN o sistema SHALL preservar o texto integral no `name`.
7. WHEN a linha é de fatura THEN o sistema SHALL gravar `identifier` vazio e deduplicar por nome, data, valor e tipo na mesma conta.
8. WHILE uma transação é CreditCard o sistema SHALL tratá-la como fora dos totais de receitas, despesas e patrimônio (regras na spec `dashboards`).

**Independent Test**: Importar `references/exemplo_fatura_nubank.csv`: 18 compras na prévia e 1 linha ignorada ("Pagamento recebido").

---

### P1: Prévia e deduplicação ⭐ MVP

**User Story**: Como usuário, quero revisar uma prévia antes de confirmar para evitar duplicatas e erros.

**Why P1**: Decisão do PRD: prévia sempre obrigatória.

**Acceptance Criteria**:

1. WHEN o arquivo é válido THEN o sistema SHALL sempre exibir a prévia antes de gravar qualquer transação.
2. The sistema SHALL classificar cada linha da prévia como nova, duplicada, ignorada ou não reconhecida.
3. WHEN a linha tem `identifier` já existente na mesma conta THEN o sistema SHALL classificá-la como duplicada.
4. WHEN a linha não tem `identifier` e há transação com mesmo nome, data, valor e tipo na mesma conta THEN o sistema SHALL classificá-la como duplicada.
5. WHEN a linha é duplicada THEN o sistema SHALL exibi-la com a seleção de importação desmarcada.
6. WHEN o usuário marca ou desmarca a flag "duplicada" de uma linha THEN o sistema SHALL incluí-la ou excluí-la da importação, respectivamente.
7. WHEN o usuário confirma THEN o sistema SHALL gravar somente as linhas selecionadas.
8. WHEN a confirmação termina THEN o sistema SHALL exibir o resumo com quantidade importada e quantidade ignorada.
9. IF a gravação falha para qualquer linha THEN o sistema SHALL reverter a importação inteira e não gravar nenhuma transação nem anexo.
10. WHEN o usuário cancela na prévia THEN o sistema SHALL não gravar transações, lote nem anexo.
11. IF a mesma confirmação é enviada mais de uma vez para a mesma prévia THEN o sistema SHALL gravar as transações apenas na primeira vez.
12. WHEN o mesmo arquivo é importado novamente após uma importação confirmada THEN o sistema SHALL classificar todas as linhas importáveis como duplicadas.

**Independent Test**: Importar o extrato, confirmar, importar o mesmo arquivo: todas as linhas aparecem como duplicadas e desmarcadas.

---

### P1: Neutras automáticas ⭐ MVP

**User Story**: Como usuário, quero que transferências entre minhas contas sejam marcadas neutras automaticamente.

**Why P1**: Sem isso os totais ficam distorcidos (exemplo do PRD: PJ → pessoal).

**Acceptance Criteria**:

1. WHEN o nome extraído de uma linha coincide, após normalização, com um nome de titular de qualquer conta do usuário THEN o sistema SHALL marcar a linha como neutra na prévia.
2. The sistema SHALL normalizar nomes ignorando caixa, acentos e espaços repetidos antes de comparar.
3. WHEN o usuário altera a marcação de neutra de uma linha na prévia THEN o sistema SHALL gravar a transação com o valor escolhido.
4. IF nenhum nome de titular coincide THEN o sistema SHALL manter a linha como não neutra.
5. The sistema SHALL não aplicar heurísticas de valor ou data para marcar neutras.

**Independent Test**: Com titular "Gabriel Vasconcelos Auzier" cadastrado, os 5 Pix enviados a esse nome no exemplo ficam neutros na prévia.

---

### P1: Anexo do arquivo original ⭐ MVP

**User Story**: Como usuário, quero que o CSV importado fique guardado para auditar a origem das transações.

**Why P1**: Decisão do PRD: guardar o CSV em tabela de anexos.

**Acceptance Criteria**:

1. WHEN a importação é confirmada com sucesso THEN o sistema SHALL guardar o arquivo original no armazenamento e registrá-lo na tabela `Attachment` ligado ao `ImportBatch`.
2. WHEN a importação é confirmada THEN o sistema SHALL registrar no `ImportBatch` a conta, o banco, a quantidade de linhas, a importada e a ignorada.
3. The sistema SHALL ligar cada transação importada ao lote que a criou por `import_batch_id`.
4. The sistema SHALL aplicar isolamento por `user_id` e RLS ao anexo e ao arquivo no armazenamento.

**Independent Test**: Confirmar uma importação e baixar o arquivo anexado idêntico ao enviado.

---

## Edge Cases

- IF o arquivo está vazio ou só tem cabeçalho THEN o sistema SHALL rejeitá-lo com mensagem de arquivo sem linhas.
- IF uma linha tem data inválida ou valor não numérico THEN o sistema SHALL classificá-la como não reconhecida e excluí-la da seleção.
- WHEN o arquivo contém duas linhas com o mesmo `identifier` THEN o sistema SHALL classificar a segunda como duplicada.
- IF o armazenamento do anexo falha THEN o sistema SHALL reverter a importação e informar o erro.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| IMP-01 | P1: Extrato Nubank (validação de arquivo e conta) | - | Implementing |
| IMP-02 | P1: Extrato Nubank (data, valor, tipo) | - | Implementing |
| IMP-03 | P1: Extrato Nubank (extração por descrição) | - | Pending |
| IMP-04 | P1: Fatura Nubank (parser) | - | Pending |
| IMP-05 | P1: Prévia (classificação e seleção) | - | Pending |
| IMP-06 | P1: Prévia (deduplicação) | - | Pending |
| IMP-07 | P1: Prévia (confirmação atômica e idempotente) | - | Pending |
| IMP-08 | P1: Neutras automáticas | - | Pending |
| IMP-09 | P1: Anexo e lote de importação | - | Pending |

**Coverage:** 9 total, 0 mapped to tasks, 9 unmapped ⚠️

---

## Success Criteria

- [ ] `references/exemplo_extrato_nubank.csv` importa 14 linhas com tipo, método, nome, documento e banco corretos.
- [ ] `references/exemplo_fatura_nubank.csv` importa 18 compras e ignora 1 linha.
- [ ] Reimportar qualquer arquivo confirmado grava 0 transações.
