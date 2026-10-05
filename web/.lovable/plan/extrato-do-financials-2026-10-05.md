# Extrato do Financials

## Objetivo
Transformar `/extrato` em uma área completa para consultar e manter transações, usando exclusivamente o cliente REST centralizado e o mock isolado de `transactions`.

## Implementação
- Adicionar os tipos de transação, filtros, paginação e entradas de criação/edição ao contrato compartilhado.
- Implementar cerca de 120 transações realistas no mock, distribuídas nas duas contas e nos últimos seis meses, com filtros combinados, busca sem acentos, ordenação estável, paginação e validações do contrato.
- Criar funções de API e hooks TanStack Query para listar, criar, editar, excluir, trocar categoria, alternar neutralidade e aplicar categoria em lote.
- Construir a página responsiva: tabela no desktop, cartões no celular, filtros, busca com atraso de 300 ms, ordenação, seleção, paginação e estados de carregamento, erro e vazio.
- Criar um formulário compartilhado para inclusão e edição, convertendo o valor brasileiro para decimal em string sem usar ponto flutuante.
- Implementar edição imediata de categoria e neutralidade com atualização otimista e restauração em erro, além da alteração em lote em uma única chamada.
- Manter confirmação antes de excluir e preservar a linha ao cancelar ou se a operação falhar.

## Regras de interface
- Reutilizar `AccountSelect`, `CategorySelect`, `formatBRL` e `formatDateLocal`.
- Exibir todos os textos e rótulos em pt-BR, inclusive métodos de pagamento, tipos e mensagens de validação.
- Contas inativas aparecem apenas nos filtros; o formulário oferece somente contas ativas.
- Valores continuam positivos no contrato e recebem o sinal visual de despesa somente na apresentação.

## Testes e validação
- Cobrir tabela/cartões, formatação, ordenação, filtros, busca com debounce, paginação e estado vazio.
- Cobrir validações, conta inativa, criação, edição e exclusão com confirmação.
- Cobrir atualizações inline e em lote, incluindo rollback em falha.
- Rodar toda a suíte, tipos e lint; conferir `/extrato` em desktop e celular.

## Fora do escopo
- Importação de CSV, upload de recibos, recorrência, parcelamento e exportação.
