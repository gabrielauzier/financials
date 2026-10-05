# Correções de integração e testes do Extrato

## Objetivo
Corrigir exclusivamente a integração dos mocks, o tratamento de datas locais e a cobertura de testes do Extrato, preservando as demais telas.

## Implementação
- Expor leituras seguras dos mocks de contas e categorias e fazer transações consultar essas fontes em tempo real.
- Validar categoria existente em criação, edição e lote; usar “Sem categoria” apenas quando a criação omitir a categoria.
- Exigir conta ativa apenas na criação e manter contas inativas válidas em edições.
- Fazer a exclusão de categoria verificar transações reais e reatribuir todas ao destino de forma consistente.
- Criar o conversor de ISO para data local do formulário e aplicar data local também aos filtros mockados.
- Completar os testes de interface para edição rápida, lote, neutralidade, busca, filtros, ordenação, vazio, paginação e CRUD.
- Declarar a dependência de testes ausente, atualizar o lockfile e trocar o comando de verificação de tipos para `tsc --noEmit`.

## Validação
- Rodar os testes, a verificação de tipos e o lint.
- Confirmar que nomes alterados e novos registros de contas/categorias aparecem nas transações.
- Confirmar o caso de data em UTC que pertence ao dia anterior no fuso de São Paulo.

## Fora do escopo
- Alterações visuais ou funcionais em outras áreas.
- Mudanças no contrato da API real.
