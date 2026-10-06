# Melhoria nas Transações

- Possibilidade de salvar filtros aplicados para que o usuário tenha um botão de aplicação rápida dos mesmos. Adicionar botão de "Salvar Filtro". Exibir modal com confirmação ao salvar os filtros aplicados e nome para o filtro. Salvar filtros localmente no armazenamento local do navegador.
- Permitir que o usuário gerencie filtros salvos, incluindo a possibilidade de renomear e excluir filtros previamente salvos.
- Exibir filtros salvos em um menu suspenso ou lista para fácil acesso e aplicação rápida.
- Permitir que o usuário aplique rapidamente um filtro salvo clicando nele no menu suspenso ou lista.
- Exibir resumo das transações filtradas, incluindo total de entradas, saídas, investimentos e saldo resultante. Card abaixo dos filtros aplicados e acima da lista de transações. Exibir: quantidade total em destaque, valores de receitas, despesas e saldo em fonte menor e com cores diferenciadas para facilitar a visualização rápida. 
- No resumo das transações filtradas, incluir também os filtros rápidos ao clicar nos valores de entradas, saídas, investimentos e saldo, permitindo ao usuário aplicar rapidamente esses filtros.
- Adicionar paginação com controle de número de itens por página e navegação entre páginas. Exibir "Anterior", "Próxima" e botões das páginas abaixo da lista de transações, permitindo ao usuário navegar facilmente entre diferentes páginas de resultados.

## Ajustes finos a fazer - v2

- Exibir identificadores da transação no modal. Tanto o id real no banco de dados quanto o identifier externo devem ser mostrados. Apenas para exibição, não para edição.
- Exibir toasts de sucesso e erro com cores diferentes para facilitar a distinção visual.
- Permitir limpar filtros individualmente sem afetar os demais filtros aplicados. (sugestão: adicionar um ícone de "limpar" ao lado de cada label de filtro ativo)
- Adicionar dia da semana na exibição das transações para facilitar a identificação do contexto temporal. Exibir abaixo da data da transação em formato abreviado, por exemplo: "Seg" para segunda-feira, "Ter" para terça-feira, etc. Fonte mais clara e menor que a data principal.   

## Respostas (Q&A)

1. **Quais linhas entram no resumo:** siga as mesmas regras do dashboard.
2. **Clique em saldo:** deixar o saldo como não clicável, apenas texto.
3. **Itens por página:** pode seguir o padrão proposto: 25, 50 (atual) e 100, com 50 como valor inicial; a escolha fica salva no navegador. O limite de 100 vale também na API.
4. **Filtros salvos:** pode seguir com o padrão proposto: todos os filtros do extrato (busca, tipo, conta, categoria, neutra, datas, filtro rápido de mês, ordenação), sem a página. Itens por página não entram no filtro salvo. Filtros salvos valem só neste navegador (local storage), como você pediu; não sincronizam entre dispositivos.