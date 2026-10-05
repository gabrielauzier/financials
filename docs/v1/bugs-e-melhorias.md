# Bugs e Melhorias

## Transações

- Feat(transactions): Toast na confirmação/erro de aplicação de categoria em múltiplas linhas selecionadas.
- Feat(transactions): Toast na confirmação/erro de aplicação de categoria em uma única linha alterada.
- Feat(transactions): Toast na confirmação/erro de edição de transação pelo modal.
- Feat(transactions): Toast na confirmação/erro de exclusão de transação.
- Feat(transactions): Toast na confirmação/erro de adição de transação.
- Feat(transactions): Categorias em formato de Badge com cores diferentes dentro do select. (https://ui.shadcn.com/docs/components/base/badge)
- Feat(transactions): Trocar input de date por Date Picker do Shadcn UI. (https://ui.shadcn.com/docs/components/base/date-picker)
- Feat(transactions): Filtro rápido com seleção de mês e ano. Desabilitar inputs de data quando o filtro rápido estiver ativo e vice-versa.
- Feat(transactions): Esconder coluna de Tipo, pois a informação já está implícita visualmente no valor.
- Feat(transactions): Exibir ícones de bancos. Sugestão: utilizar SVGs do repo https://github.com/Tgentil/Bancos-em-SVG. Também verificar alternativas melhores disponíveis.
- Feat(transactions): Adicionar novo campo "description" cujo objetivo é salvar o título original da transação. Exibir este campo no extrato na mesma coluna de "name", abaixo do nome da transação e com fonte menor e cor mais fraca.
- Fix(transactions): Na visualização inicial do extrato, os inputs de data (De/Até) estão preenchidos. Devem estar vazios.

## Importação

- Feat(import): Deve ser possível selecionar as categorias no preview das transações.
- Feat(import): Exibir arquivos importados para facilitar a reimportação.
- Feat(import): Adicionar método de pagamento do tipo "Other" (Outro).
- Feat(import): Esconder coluna de despesa no preview das transações e exibir Valor com cores diferentes para receitas e despesas. (assim como no extrato principal)
- Feat(import): Exibir modal de confirmação caso exista transações duplicadas, ao clicar em "Confirmar importação".
- Fix(import): Corrigir preview no import - não está fazendo a identificação correta de transferências neutras.
- Fix(import): Não está identificando corretamente métodos de pagamentos conhecidos de transferências no preview das transações. Seguir mapeamento de categorias existentes: "compra do débito" = DebitCard, "compra no crédito" = CreditCard, "pix" = Pix, "transferência enviada" = BankTransfer, "transferência recebida" = BankTransfer. Utilizar método de pagamento "Other" para casos não mapeados/identificados.
- Fix(import): Deveria ser possível selecionar todas as linhas de uma vez no preview das transações.


## Categorias

- Feat(categories): Adicionar opção de cores personalizadas para as categorias.
- Feat(categories): Possibilitar a seleção de cores personalizadas para as categorias. (dentre cores pré-definidas em paleta - utilizar )

## Contas

- Feat(accounts): Adicionar opção de cores personalizadas para as contas.
- Feat(accounts): Adicionar ícones de bancos. Sugestão: utilizar SVGs do repo https://github.com/Tgentil/Bancos-em-SVG. Também verificar alternativas melhores disponíveis.

## Respostas (Q&A)

- Paleta: Utilize todas as cores do Tailwind (Red, Orange, Amber, etc.) nas tonalidades (400, 600, 900).
- Itens repetidos: Pode considerar um só. 
- Reimportar: Adicionar os botões de reimportação para facilitar a importação de arquivos já utilizados e download dos mesmos.
- Neutras: Adicionei uma nova referência (references/nubank_extrato_setembro.csv) onde testei a importação e nenhuma das transferências que contém meu nome "GABRIEL VASCONCELOS AUZIER" foi marcada como neutra, mesmo tendo uma conta com titular "Gabriel Vasconcelos Auzier" e outra com "Gabriel Vasconcelos Auzier LTDA".
- Ícones: Dê prefência ao uso do repositório, caso não encontre alternativa melhor. A licença é compatível com o uso do projeto atualmente (uso apenas pessoal).
- Description: A description não deve ser editável, apenas o nome deve ser editável. É preenchida no import e pode aparecer no modal, mas apenas como texto informativo ou título/subtítulo.