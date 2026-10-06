-- Part 1 (transactions-ux): original title of the transaction, read-only after creation.
-- Additive and without a check: existing rows keep description null.
alter table public.transactions add column description text;

-- Part 2 (import-fixes): accept the 'Other' payment method. The constraint name is the one
-- Postgres generated for the inline check in 0003.
alter table public.transactions drop constraint transactions_payment_method_check;
alter table public.transactions add constraint transactions_payment_method_check
  check (payment_method in
    ('BankTransfer', 'Boleto', 'Cash', 'CreditCard', 'DebitCard', 'NuPay', 'PIX', 'Other'));
