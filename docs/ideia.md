# Ideia - Financials

## Conceito

Aplicação Web para controle de finanças pessoais. 

Como adicionar finanças?

- Extrato bancário de diferentes bancos (Nubank, Sofisa Direto, Neon, XP, etc.).
- Adição/edição manual de registros. 

## Funcionalidades

As principais funcionalidades são:

- Acompanhamento de extrato (tabela com todas as transações).
- Registro de transações (CRUD).
- Import de transações por meio de extrato bancário de terceiros (Nubank, Sofisa, etc.) com arquivos CSV ou PDF.
- Acompanhamento das despesas no cartão de crédito (gastos por categoria).
- Acompanhamento das despesas totais dos últimos 30 dias. 
- Trend dos últimos 12 meses (balanço geral de receitas e despesas) de transações.
- Acompanhamento dos gastos gerais por categoria. 
- Acompanhamento do patrimônio (acumulado desde o início).

Riscos e mitigações:
 
- Deduplicação de transferências de contas do mesmo recebedor para ele mesmo.
- Categorias não vem selecionadas no extrato. Devem ser atualizadas pelo próprio usuário no MVP (por meio de edição rápida na tabela).

ex: 

JOAO DA SILVA LTDA (Nubank PJ) -> JOAO DA SILVA (Nubank). 

Há dois registros no banco para o mesmo recebedor. Um no extrato do Nubank PJ e outro na conta pessoal Nubank. Este tipo de transferência não deve ser considerada para cálculos de despesas e nenhum acompanhamento e deve ser marcada como uma transferência neutra (que não gera uma receita, nem despesa).

## Tecnologias

- Frontend: React com Vite.
- Backend: Node.js com fastify para API e Supabase.

## Autenticação

Fluxos de autenticação simples com email e senha. 

- Cadastro simples com nome, apelido, email e senha.
- Cadastro deve emitir um email de confirmação. 
- Fluxo de autenticação simples com email e senha. 
- Sem fluxo de reset de senha para o MVP. 
- Rotas autenticadas com Bearer Token JWT.

## Modelos de dados

**Transactions**

Todas as transações.

| Campo | Tipo de Dado | Descrição |
| :--- | :--- | :--- |
| name | string | Nome da transferência |
| type | enum (Income, Expense) | Tipo pode ser receita ou despesa |
| date | datetime | Data em que foi realizada |
| amount | number | Valor da transferência |
| caregory | string | 
| payment_method | enum (BankTransfer, Boleto, Cash, CreditCard, DebitCard, NuPay, PIX) |
| notes | string | Observações |
| receipt | string | URL do recibo |
| created_time | datetime | Data e horário de criação do registro |
| ID | int | Identificador local do registro |
| identifier | string | Identificador externo do banco |
| bank | string | Banco da conta de recebimento |
| neutral | boolean | Se a transferência foi realizada para outra conta do mesmo recebedor |

**CreditExpenses**

Despesas atuais no cartão de crédito.

| Campo | Tipo de Dado | Descrição |
| :--- | :--- | :--- |
| name | string | Nome da transferência |
| category | string |
| total_amount | number | Valor total a pagar | 
| paid_amount | number | Valor do débito já pago |
| date | datetime | Data em que foi realizada |
| recurrency_day | number | Dia em que cai na fatura | 
| created_time | datetime | Data e horário de criação do registro |
| status | enum(Once, Active, Inactive, Canceled, ToCancel) | Delimita o que deve ser feito: Once (será inativada na próxima fatura), Active (recorrência até ser quitada), Canceled (cancelada pelo usuário), ToCancel (a cancelar pelo usuário). |
| notes | string | Observações |
| bank | string | Banco da conta de recebimento |
