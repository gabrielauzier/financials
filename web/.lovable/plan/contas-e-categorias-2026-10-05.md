# Contas e Categorias

## Objetivo
Transformar as páginas `/contas` e `/categorias` em áreas funcionais, mantendo a API REST centralizada, mocks isolados por área e toda a interface em pt-BR.

## Implementação
- Adicionar os tipos e funções de API para contas e categorias, sempre usando `apiRequest`.
- Implementar os mocks em memória com os seeds fornecidos, filtros, criação, edição, ativação/desativação, exclusão com reatribuição e todos os códigos de erro do contrato.
- Criar hooks de consulta e mutations com TanStack Query e invalidação dos caches afetados.
- Criar `AccountSelect`, que oculta contas inativas por padrão, e `CategorySelect`, que lista todas as categorias.
- Construir a tela de Contas com lista, estados vazio/carregando/erro, formulário acessível em diálogo, campo de titulares em chips, edição e confirmação para ativar/desativar, sem qualquer exclusão.
- Construir a tela de Categorias com criação, renomeação inline, proteção visual das categorias de sistema e exclusão com segundo passo de reatribuição quando necessário.
- Manter o visual sóbrio, responsivo e compatível com os temas existentes.

## Validação e erros
- Validar e normalizar entradas antes das chamadas: remover espaços nas pontas, exigir nome/apelido e ao menos um titular, impedir titulares repetidos e limitar comprimentos.
- Traduzir os códigos da API para as mensagens exatas solicitadas, mantendo os dados na tela em qualquer falha.
- Tratar como categorias em uso no mock as categorias comuns que representam os dados financeiros seedados; após reatribuição, a exclusão é concluída.

## Testes
- Cobrir formulário de conta, duplicidade, ausência de exclusão, ativação/desativação e filtro do seletor.
- Cobrir nomes em português, proteção das categorias de sistema, renomeação, exclusão com destino e seletor de categorias.
- Rodar testes, verificação de tipos e lint; validar as duas páginas em desktop e celular.

## Fora do escopo
- Exclusão de conta, saldo inicial, ícones ou cores de categoria e subcategorias.