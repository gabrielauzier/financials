# PRD — Financials

**Produto:** Financials — controle de finanças pessoais (aplicação web)
**Status:** Draft
**Autor:** Gabriel
**Data de criação:** 2026-10-04
**Versão:** 1.0
**Fonte:** `docs/ideia.md` + rodada de esclarecimentos (seção 14)

---

## 1. Resumo Executivo

**One-liner:** Aplicação web que consolida transações de várias contas bancárias (via CSV ou cadastro manual) e mostra para onde o dinheiro vai, quanto entrou e quanto se acumulou.

O Financials centraliza receitas e despesas que hoje ficam espalhadas em extratos de bancos diferentes (Nubank, Sofisa Direto, Neon, XP). O usuário importa os CSVs, revisa uma prévia, categoriza rapidamente na própria tabela e acompanha painéis de despesas, tendência anual, gastos por categoria, cartão de crédito e patrimônio.

O MVP é de **uso estritamente pessoal** (um usuário), mas a arquitetura (autenticação, isolamento de dados por usuário) é desenhada para permitir lançamento ao público geral no futuro, sem reescrita.

**Quick Facts**

| Item | Valor |
| :--- | :--- |
| Usuário-alvo (MVP) | O próprio autor (uso pessoal) |
| Usuário-alvo (futuro) | Público geral brasileiro com várias contas bancárias |
| Problema | Dados financeiros fragmentados entre bancos; sem visão consolidada |
| Métricas-chave | ≥90% das linhas importadas sem retrabalho; fechamento mensal ≤10 min |
| Lançamento | Sem prazo fixo; entrega por fases (seção 10) |

---

## 2. Problema

### O problema
Cada banco entrega extratos em formato próprio, sem categorias e sem visão consolidada. Acompanhar despesas, tendência e patrimônio exige juntar tudo manualmente.

### Agravantes específicos
- **Transferências entre contas do mesmo titular** (ex.: `JOAO DA SILVA LTDA` no Nubank PJ → `JOAO DA SILVA` no Nubank pessoal) aparecem como despesa em uma conta e receita em outra, distorcendo todos os totais.
- **Extratos não trazem categoria**, então toda análise por categoria depende de classificação manual.
- **Despesas de cartão de crédito** (parcelas e recorrências) precisam de acompanhamento próprio.

### Por que agora
Contas em múltiplos bancos (incluindo PJ) tornaram o controle manual inviável.

---

## 3. Objetivos

### Objetivos de produto
1. Ter **uma única fonte de verdade** das transações de todas as contas.
2. Reduzir o esforço de importar e categorizar um mês de extratos.
3. Garantir que totais de receita/despesa **não sejam distorcidos** por transferências neutras e estornos.
4. Construir fundação (auth, isolamento por usuário) que permita abrir ao público depois.

### Não-objetivos (MVP)
Ver seção 8.

---

## 4. Persona

**Gabriel (persona primária, MVP)** — pessoa física com contas em vários bancos, incluindo conta PJ. Confortável com tecnologia, quer visão consolidada rápida, aceita categorizar manualmente em troca de importação confiável.

**Persona futura (fora do MVP):** usuário geral brasileiro com 2+ contas, sem conhecimento técnico, que baixa CSV do app do banco.

---

## 5. Requisitos Funcionais

Prioridade: **P0** = obrigatório no MVP.

### 5.1 Autenticação (P0)

**US-01 — Cadastro**
Como visitante, quero me cadastrar com nome, apelido, e-mail e senha, para ter acesso à minha conta.
- Formulário exige nome, apelido, e-mail e senha.
- Após cadastro, um e-mail de confirmação é enviado.
- Login só é permitido após confirmar o e-mail.
- E-mail duplicado exibe erro claro.

**US-02 — Login**
Como usuário, quero entrar com e-mail e senha, para acessar meus dados.
- Credenciais válidas e e-mail confirmado → acesso ao app.
- Credenciais inválidas → mensagem de erro sem revelar qual campo está incorreto.
- Todas as rotas da API (exceto auth) exigem `Authorization: Bearer <JWT>`; sem token válido → 401.

**US-03 — Isolamento de dados**
Como usuário, quero que apenas eu veja meus dados, para garantir privacidade (e permitir abertura ao público no futuro).
- Toda tabela de dados possui `user_id` e Row Level Security no Postgres.
- Usuário A nunca lê nem altera dados do usuário B (coberto por teste automatizado).

> Fora do MVP: reset de senha (decisão explícita do doc de ideia). Consequência registrada em Riscos.

### 5.2 Contas (P0)

**US-04 — Gerenciar contas**
Como usuário, quero cadastrar minhas contas bancárias, para associar cada transação à conta correta.
- CRUD de conta com: banco (Nubank, Sofisa Direto, Neon, XP, Outro), apelido (ex.: "Nubank PJ"), e **nomes de titular associados** (ex.: "JOAO DA SILVA", "JOAO DA SILVA LTDA").
- Toda transação pertence a exatamente uma conta.
- Contas **não são excluídas**: o usuário apenas **desativa** a conta de origem. As transações da conta permanecem intactas (nenhuma é alterada, movida ou removida) e continuam entrando nos cálculos e painéis.
- Conta desativada não aparece como opção de destino em novas importações/transações, mas pode ser reativada. Seus nomes de titular continuam valendo na detecção de neutras.

### 5.3 Transações (P0)

**US-05 — Tabela de extrato**
Como usuário, quero ver todas as transações em tabela, para acompanhar o extrato consolidado.
- Colunas: data, nome, conta, categoria, método de pagamento, tipo, valor, neutra, observações.
- Ordenação por data (padrão: mais recente primeiro), filtros por período, conta, categoria, tipo e neutra; busca por nome; paginação.

**US-06 — CRUD manual**
Como usuário, quero criar, editar e excluir transações, para registrar o que o extrato não cobre.
- Campos: nome, tipo (Receita/Despesa), data, valor, categoria, método de pagamento, observações, URL do recibo, conta, neutra.
- Valor deve ser > 0; o sinal é dado pelo tipo.
- Exclusão pede confirmação.

**US-07 — Edição rápida de categoria**
Como usuário, quero alterar a categoria direto na tabela, para categorizar rápido após importar.
- Seleção de categoria inline, sem abrir formulário; salva imediatamente e atualiza os painéis.
- Seleção em lote de várias linhas para aplicar uma categoria de uma vez.

**US-08 — Transferência neutra (manual)**
Como usuário, quero marcar/desmarcar uma transação como neutra, para que ela não afete receitas, despesas nem acompanhamentos.
- Toggle na tabela e no formulário.
- Transação neutra é excluída de todos os cálculos e painéis (ver 5.9).

### 5.4 Categorias (P0)

**US-09 — Gerenciar categorias**
Como usuário, quero criar, renomear e excluir categorias, para adaptar a classificação ao meu uso.
- Ao criar o usuário, é semeada a lista inicial abaixo. Os **nomes exibidos são em português**.
- Renomear mantém as transações vinculadas.
- Excluir categoria em uso exige reatribuir as transações a outra categoria.
- **Categorias de sistema não podem ser editadas nem excluídas:** *Estorno*, *Sem categoria* e *Investimentos*, que têm comportamento especial nos cálculos (ver 5.9). Podem ser atribuídas a transações normalmente.
- Categorias são armazenadas por identificador e **sempre exibidas em português** (inclusive nos filtros, gráficos e importações).

Lista inicial (identificador original → exibição em pt-BR):

| Identificador | Exibição |
| :--- | :--- |
| Entertainment | Entretenimento |
| Food | Alimentação |
| Salaries | Salários |
| Healthcare | Saúde |
| Utilities | Utilidades |
| Unknown | Desconhecida |
| Transport | Transporte |
| Help | Ajuda (a terceiros) |
| PJ | PJ |
| Bills | Contas |
| Emergency | Emergência |
| Uncategorized | Sem categoria |
| Wishes | Desejos |
| Reversal | Estorno (de compras) |
| Shopping | Compras |
| Pets | Pets |
| Investments | Investimentos |

> Grafia adotada: *Entertainment* (corrigida em relação ao doc original). Nomes em português são o texto exibido em toda a interface.

### 5.5 Importação de CSV (P0)

**US-10 — Importar extrato**
Como usuário, quero importar o CSV de extrato de um banco, para não digitar transações.
- Bancos suportados no MVP: **Nubank, Sofisa Direto, Neon e XP — somente CSV**. PDF está fora do escopo.
- Usuário escolhe a conta de destino e envia o arquivo; o parser é selecionado pelo banco da conta.
- Linhas importadas entram como "Sem categoria", exceto onde a regra do parser definir outra (ver 5.5.1).
- Arquivo inválido ou fora do formato esperado → erro claro indicando o problema, sem importar nada.
- **Estado atual:** estão especificados os formatos **Nubank conta** (5.5.1, `references/exemplo_extrato_nubank.csv`) e **Nubank fatura de cartão** (5.5.2, `references/exemplo_fatura_nubank.csv`). Os parsers de Sofisa Direto, Neon e XP dependem de CSVs de exemplo ainda não fornecidos (Q6).

**US-10b — Anexo do arquivo original**
Como usuário, quero que o CSV importado fique guardado, para auditar de onde vieram as transações.
- Ao confirmar uma importação, o arquivo original é salvo em uma **tabela de anexos** vinculada ao lote de importação (`ImportBatch`).
- Cada transação importada referencia o lote que a criou.
- Importação cancelada na prévia não gera anexo.

#### 5.5.1 Formato CSV Nubank (conta)

Cabeçalho: `Data,Valor,Identificador,Descrição` (codificação UTF-8).

| Coluna | Formato | Mapeia para |
| :--- | :--- | :--- |
| Data | `dd/mm/aaaa` (sem hora) | `date` |
| Valor | decimal com ponto, **negativo = saída** | `amount` (valor absoluto) e `type` (negativo → Expense, positivo → Income) |
| Identificador | UUID do Nubank | `identifier` (usado na deduplicação) |
| Descrição | texto livre | `name` e `payment_method` (extraídos, ver abaixo) |

Extração a partir da descrição:

| Padrão da descrição | `payment_method` | `name` |
| :--- | :--- | :--- |
| `Transferência recebida pelo Pix - <NOME> - <doc> - <banco> ...` | PIX | `<NOME>` |
| `Transferência enviada pelo Pix - <NOME> - <doc> - <banco> ...` | PIX | `<NOME>` |
| `Débito em conta` | DebitCard | descrição completa |
| `Pagamento de fatura` | BankTransfer | descrição completa |
| `Dinheiro guardado com resgate planejado` | BankTransfer | descrição completa |

- `<NOME>` é o texto entre o primeiro e o segundo ` - `.
- **Documento** da contraparte (CPF/CNPJ, possivelmente mascarado, ex.: `•••.224.672-••`) é gravado em `counterparty_document` e o **banco** da contraparte (ex.: `NU PAGAMENTOS - IP (0260)`) em `counterparty_bank`, colunas próprias de `Transaction`. Agência e conta da contraparte não são gravadas.
- **Categoria e tipo pelas descrições sem contraparte:**
  - `Dinheiro guardado com resgate planejado` → categoria *Investimentos*.
  - `Pagamento de fatura` → **despesa**, categoria *Sem categoria*.
  - `Débito em conta` → categoria *Sem categoria*.
- **Data sem hora:** gravada à meia-noite no fuso local do usuário (exibida sem deslocar o dia).
- Descrições que não casam com nenhum padrão conhecido entram como "Sem categoria", `name` = descrição completa e sinalizadas na prévia para revisão.
- O nome extraído é o usado na regra de neutras (US-12). No exemplo, `Gabriel Vasconcelos Auzier` é o titular da própria conta; os Pix enviados a esse nome devem ser marcados neutros quando ele estiver cadastrado como titular de uma conta do usuário.

#### 5.5.2 Formato CSV Nubank (fatura de cartão)

Cabeçalho: `date,title,amount` (UTF-8). A conta de destino escolhida na importação representa o cartão (ex.: apelido "Nubank Cartão").

| Coluna | Formato | Mapeia para |
| :--- | :--- | :--- |
| date | `aaaa-mm-dd` | `date` (meia-noite no fuso local) |
| title | texto livre (ex.: `Netflix Entretenimento`, `Prado Som Car - Parcela 3/6`) | `name` (texto integral, inclusive "Parcela x/y") |
| amount | decimal com vírgula, **positivo = compra**, aspas no CSV (ex.: `"1.335,61"`) | `amount` |

- Compras (valor positivo) viram `Transaction` do tipo **Expense**, `payment_method` = **CreditCard**, categoria *Sem categoria*.
- Linhas de valor negativo (ex.: `Pagamento recebido`, `"- 1.335,61"`) são o pagamento da fatura, que já é contado como despesa no extrato da conta (`Pagamento de fatura`). Elas **não são importadas** e aparecem na prévia como "ignoradas".
- O arquivo **não tem identificador**: a deduplicação usa **nome + data + valor** na mesma conta. Compras idênticas no mesmo dia aparecem como duplicadas na prévia e o usuário pode desmarcar a flag (US-11).
- Parcelamentos: cada parcela vem como linha própria na fatura; o sistema não modela parcelas futuras nas `Transaction`.
- **Não entram nos totais** (ver 5.9): compras de cartão importadas aqui ficam disponíveis para categorização e para a visão de cartão (US-14), mas não somam em despesas/receitas/patrimônio, porque o gasto é contado no pagamento da fatura.

**US-11 — Prévia e deduplicação**
Como usuário, quero revisar uma prévia antes de confirmar, para evitar duplicatas e erros.
- A prévia **sempre** é exibida antes de gravar, listando linhas **novas** e **duplicadas**.
- Duplicata é detectada por `identifier` do banco; se ausente, por **nome + data + valor** na mesma conta.
- Linhas duplicadas vêm sinalizadas e desmarcadas; o usuário pode marcar/desmarcar a flag "duplicada" de cada linha antes de confirmar.
- Só linhas selecionadas são gravadas; ao final, resumo (importadas / ignoradas).
- Linhas candidatas a neutra (US-12) aparecem sinalizadas na prévia.

**US-12 — Neutras automáticas**
Como usuário, quero que o sistema reconheça transferências entre minhas próprias contas, para não distorcer os totais.
- Regra: se o nome da contraparte da transação coincide com um dos **nomes de titular associados a alguma conta do próprio usuário** (US-04), a transação é marcada como neutra automaticamente.
- A comparação ignora caixa, acentos e espaços extras.
- O usuário pode reverter a marcação manualmente (US-08).
- Matching exato/normalizado; heurísticas por valor/data estão fora do MVP.

### 5.6 Cartão de crédito (P0)

**US-13 — Despesas de cartão (controle independente)**
Como usuário, quero registrar despesas de cartão (parceladas/recorrentes), para acompanhar o que ainda vou pagar.
- Entidade **CreditExpense independente de Transaction**: não gera nem é gerada por transações.
- Campos: nome, categoria, valor total, valor já pago, data, dia de recorrência na fatura, status, observações, conta/banco.
- Status e significado: `Once` (inativada na próxima fatura), `Active` (recorre até quitar), `Canceled` (cancelada pelo usuário), `ToCancel` (usuário ainda deve cancelar), `Inactive`.
- CRUD completo, com filtro por status.
- **Transição de status e atualização de `paid_amount` são sempre manuais na fase piloto**: o sistema não muda status nem valor pago automaticamente. Qualquer status pode ser alterado para qualquer outro pelo usuário. Regras automáticas ficam para depois do piloto.

**US-14 — Gastos de cartão por categoria**
Como usuário, quero ver gastos de cartão por categoria, para saber onde o cartão pesa.
- Gráfico/tabela agrupando por categoria as **transações CreditCard** (importadas da fatura) em período selecionável, com total.
- Seção separada com as **CreditExpenses** ativas por categoria, mostrando o valor restante a pagar (total − pago).
- Esses valores são informativos e **não alteram** os totais do dashboard (5.9).

### 5.7 Dashboards (P0)

**US-15 — Despesas dos últimos 30 dias**
Total de despesas dos últimos 30 dias (janela móvel até hoje), com variação em relação aos 30 dias anteriores.

**US-16 — Tendência de 12 meses**
Gráfico mensal dos últimos 12 meses com receitas, despesas e balanço (receitas − despesas).

**US-17 — Gastos por categoria**
Distribuição das despesas por categoria em período selecionável (padrão: mês corrente).

**US-18 — Patrimônio**
Patrimônio acumulado desde a primeira transação, exibido como valor atual e série temporal.
- **Definição MVP:** soma acumulada de (receitas − despesas) conforme 5.9, mais os lançamentos de rendimento de investimentos (US-19). Sem saldo inicial por conta.

### 5.7.1 Investimentos (P0)

**US-19 — Atualizar rendimento de investimentos**
Como usuário, quero registrar o retorno dos meus investimentos ao longo do tempo, para que o patrimônio reflita a valorização e não apenas os aportes.
- Transações da categoria *Investimentos* (aportes e resgates) **não são receita nem despesa** e **não alteram o patrimônio** por si só: o dinheiro apenas muda de lugar.
- O usuário registra **lançamentos de rendimento** (data, valor positivo ou negativo, conta/instituição, observação) para refletir ganho ou perda do investimento.
- O patrimônio soma todos os lançamentos de rendimento (ver 5.9).
- Lançamentos de rendimento têm CRUD completo e aparecem em lista própria, ordenada por data.
- Atualização é sempre **manual** no MVP (sem integração com corretoras).

### 5.8 Regras globais
- Moeda: **BRL**, formato `R$ 1.234,56`.
- Datas armazenadas em UTC e **exibidas no fuso local do usuário** (navegador).
- Interface em **pt-BR**; internacionalização fora do MVP.

### 5.9 Regras de cálculo (fonte única)

| Tipo de transação | Receitas | Despesas | Patrimônio |
| :--- | :--- | :--- | :--- |
| Receita normal | + | — | + |
| Despesa normal | — | + | − |
| **Neutra** | ignorada | ignorada | ignorada |
| **Estorno** (categoria Reversal) | **ignorado** | **abate** (reduz o total) | + |
| **Compra de cartão** (`payment_method` = CreditCard, vinda da fatura) | ignorada | ignorada (o gasto é contado no pagamento da fatura) | ignorada |
| **Pagamento de fatura** (extrato da conta) | — | + (despesa, *Sem categoria*) | − |
| **Investimentos** (aporte ou resgate) | ignorado | ignorado | ignorado (movimentação interna) |
| **Lançamento de rendimento** | ignorado | ignorado | + / − (valor lançado) |

Patrimônio = Σ receitas − Σ despesas (com neutras, estornos e investimentos tratados como acima) + Σ lançamentos de rendimento.

Estas regras valem para todos os painéis (US-15 a US-18) e devem ser implementadas em um único ponto na API para evitar divergências.

---

## 6. Métricas de Sucesso

| Métrica | Meta | Como medir |
| :--- | :--- | :--- |
| Import sem retrabalho | ≥90% das linhas de cada CSV importadas corretamente sem edição manual (exceto categoria) | Linhas confirmadas na prévia sem edição posterior ÷ total de linhas importadas |
| Tempo de fechamento mensal | ≤10 minutos para importar + categorizar um mês | Medição manual do usuário no fechamento; opcionalmente timestamps (início da importação → última categorização) |

Não há métricas de aquisição/retenção no MVP (uso pessoal).

---

## 7. Escopo — Dentro (MVP)

- Cadastro/login com e-mail e senha, confirmação por e-mail, JWT.
- Contas, categorias (lista inicial editável) e transações (CRUD + edição rápida).
- Importação CSV de Nubank, Sofisa Direto, Neon e XP com prévia e deduplicação.
- Neutras automáticas (por nomes de titular) e manuais.
- CreditExpenses independentes + visão por categoria.
- Dashboards: últimos 30 dias, tendência 12 meses, por categoria, patrimônio.
- pt-BR, BRL, fuso local do usuário.

## 8. Escopo — Fora (MVP)

- Importação de **PDF**.
- Reset de senha / recuperação de conta.
- Categorização automática (regras/IA).
- Saldo inicial por conta; integração automática com corretoras para cotação/rendimento.
- Vínculo entre CreditExpenses e Transactions.
- Detecção de neutras por heurística (valor/data/par) .
- Open Banking / integração direta com bancos.
- Multi-moeda, internacionalização, app mobile, orçamento/metas, relatórios exportáveis.
- Cobrança, planos, onboarding para público geral.

---

## 9. Considerações Técnicas

**Arquitetura**
- **Frontend:** React + Vite (SPA).
- **Backend:** Node.js + Fastify, expondo toda a API REST; é a única camada de lógica de negócio.
- **Supabase:** Auth (cadastro, confirmação por e-mail, emissão do JWT) e Postgres. O frontend autentica via Supabase Auth e chama o Fastify com o JWT; o Fastify valida o token e acessa o banco.
- **Isolamento:** `user_id` em todas as tabelas + RLS no Postgres (defesa em profundidade, essencial para o futuro lançamento público).

**Modelo de dados** (derivado de `ideia.md`, ajustado)

Todas as chaves primárias são **uuid**.

*Account* (nova): id, user_id, bank, nickname, holder_names[], active (boolean), created_at.

*Category* (nova): id, user_id, key (identificador estável), name (texto exibido em pt-BR), is_system (Estorno, Sem categoria, Investimentos — não editáveis), created_at.

*Transaction*: id, user_id, account_id, name, type (`Income`|`Expense`), date, amount, category_id, payment_method (`BankTransfer`, `Boleto`, `Cash`, `CreditCard`, `DebitCard`, `NuPay`, `PIX`), notes, receipt (URL), identifier (id externo do banco), counterparty_document, counterparty_bank, neutral (boolean), import_batch_id (nulo se manual), created_time.

*ImportBatch* (nova): id, user_id, account_id, bank, status, row_count, imported_count, skipped_count, created_at.

*Attachment* (nova): id, user_id, import_batch_id, filename, mime_type, size, storage_path (arquivo no Supabase Storage), created_at.

*InvestmentReturn* (nova): id, user_id, account_id, date, amount (positivo ou negativo), notes, created_time.

*CreditExpense*: id, user_id, account_id (banco), name, category_id, total_amount, paid_amount, date, recurrency_day, status (`Once`, `Active`, `Inactive`, `Canceled`, `ToCancel`), notes, created_time.

**Observações**
- O campo `bank` do doc original é substituído por `account_id`; `category` (string) por `category_id` para permitir renomear categorias sem reescrever transações.
- O doc grafa `caregory` (typo); corrigido para `category`.
- `receipt` é apenas uma URL (sem upload de arquivo).
- Valores monetários em `numeric(14,2)` (nunca float).
- Parsers de CSV isolados por banco (um módulo por banco), para adicionar bancos sem mexer no restante.
- Hospedagem: deploy simples em plataforma gerenciada para frontend e API + Supabase cloud.

**Segurança / privacidade**
- Senhas gerenciadas pelo Supabase Auth; nenhuma credencial bancária é armazenada.
- O CSV original é guardado como anexo (Supabase Storage + tabela `Attachment`), isolado por usuário via RLS.
- Base mínima para LGPD no futuro: dados isolados por usuário, possibilidade de exportar/excluir conta (fora do MVP, mas não bloqueado pelo desenho).

---

## 10. Fases e Marcos (sem datas fixas)

| Fase | Entrega |
| :--- | :--- |
| 1. Fundação | Projeto, auth Supabase + JWT no Fastify, RLS, contas e categorias semeadas |
| 2. Transações | CRUD, tabela com filtros, edição rápida, neutras manuais |
| 3. Importação | Parsers Nubank/Sofisa/Neon/XP, prévia, deduplicação, neutras automáticas |
| 4. Dashboards | 30 dias, tendência 12 meses, por categoria, patrimônio (regras 5.9) |
| 5. Cartão e investimentos | CreditExpenses + visão por categoria; lançamentos de rendimento |
| 6. Deploy | Hospedagem e validação das métricas de sucesso |

---

## 11. Riscos e Mitigações

| Risco | Impacto | Mitigação |
| :--- | :--- | :--- |
| Formato de CSV muda ou varia por tipo de conta | Import falha / linhas erradas | Parsers isolados, validação estrita de cabeçalho, erro claro, testes com CSVs reais |
| Neutras não detectadas (nome do titular diferente do cadastrado) | Totais distorcidos | Usuário pode marcar manualmente; prévia sinaliza candidatas |
| Falso positivo de neutra | Transação real ignorada | Marcação revertível; filtro "neutras" visível na tabela |
| Duplicatas sem `identifier` (nome+data+valor) | Duas compras idênticas no mesmo dia tratadas como duplicadas | Prévia permite o usuário desmarcar a flag "duplicada" |
| Sem reset de senha | Perda de acesso à conta | Aceito no MVP (uso pessoal); deve ser resolvido antes do lançamento público |
| Categorização 100% manual | Esforço no fechamento mensal | Edição inline e em lote; meta de ≤10 min monitorada |
| Rendimento de investimentos depende de lançamento manual | Patrimônio desatualizado se o usuário esquecer | Lembrete visual da data do último lançamento; automação fica fora do MVP |
| Patrimônio sem saldo inicial | Valor não reflete saldo real dos bancos | Definição explícita no MVP; saldo inicial é evolução futura |

---

## 12. Dependências e Premissas

**Dependências:** Supabase (Auth, Postgres, envio de e-mail de confirmação); acesso a CSVs reais de cada banco para construir e testar os parsers.

**Premissas:**
- O usuário baixa os CSVs manualmente nos apps/sites dos bancos.
- Uso por um único usuário no MVP.
- Todas as transações são em BRL.

---

## 13. Questões Abertas

Itens não definidos em `ideia.md` nem nas respostas; precisam de decisão antes ou durante a implementação.

| # | Questão |
| :--- | :--- |
| Q6 | Parsers de **Sofisa Direto, Neon e XP**: aguardam CSVs de exemplo (Nubank conta e fatura já especificados). |
| Q11 | Rendimentos de investimento (US-19): confirmar o modelo de **lançamento de variação** (valor ganho/perdido por data) em vez de **saldo atual informado** (o sistema calcula a diferença). |
| Q14 | Como o pagamento de fatura entra *Sem categoria*, o gráfico geral de gastos por categoria (US-17) não mostra o que foi gasto no cartão por categoria. Aceitar (cartão só na US-14) ou fazer US-17 incluir compras de cartão apenas na distribuição por categoria, sem alterar totais? |
| Q15 | Compras de cartão ficam fora dos totais por mês de pagamento: confirmar que isso é desejado para a tendência de 12 meses (gasto aparece no mês do pagamento, não da compra). |
| Q13 | Confirmar que as categorias não editáveis são exatamente *Estorno*, *Sem categoria* e *Investimentos*. |

---

## 14. Decisões tomadas na discovery

| Tema | Decisão |
| :--- | :--- |
| Público | Uso pessoal no MVP, com base para abertura futura |
| Bancos/formatos | Nubank, Sofisa Direto, Neon, XP; somente CSV |
| Categorias | Lista inicial editável, nomes em pt-BR, CRUD pelo usuário |
| Neutras | Automática (nomes de titular por conta) + manual |
| Patrimônio | Soma de transações |
| Cartão | CreditExpenses independente de Transactions |
| Contas | Entidade Conta com nomes de titular |
| Reimport | Ignorar duplicadas (identifier ou nome+data+valor), prévia sempre, flag editável |
| Estorno | Não conta como receita; abate despesa |
| Backend | Supabase Auth + Postgres; Fastify como API |
| Sucesso | ≥90% linhas ok; ≤10 min de fechamento |
| Prazo/infra | Sem prazo; deploy simples |
| Moeda/idioma/fuso | BRL; pt-BR; fuso local do usuário |
| Chave primária | uuid |
| Excluir conta | Não há exclusão; apenas desativação; transações permanecem intactas |
| CSV Nubank | Modelo de `references/exemplo_extrato_nubank.csv`; tipo pelo sinal; método e nome extraídos da descrição |
| Categorias de sistema | Não editáveis nem excluíveis; nomes sempre em pt-BR |
| Investimentos | Não são despesa nem receita nem mudam o patrimônio; rendimento lançado manualmente |
| Anexos | CSV original guardado em tabela de anexos |
| Recibo | Apenas URL |
| Status do cartão | Transição manual no piloto |
| Descrições sem contraparte (Nubank) | Débito → DebitCard; fatura e dinheiro guardado → BankTransfer; guardado → *Investimentos*; fatura → despesa; nome = descrição |
| Documento/banco da contraparte | Colunas próprias (`counterparty_document`, `counterparty_bank`) |
| Fatura Nubank (CSV) | Importada como Transactions (CreditCard); compras não somam nos totais; pagamento no extrato é a despesa; linha "Pagamento recebido" ignorada |
| Data sem hora | Meia-noite no fuso local |
