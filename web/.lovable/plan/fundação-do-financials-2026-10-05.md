# Fundação do Financials

## Objetivo
Construir a base navegável e testada do app financeiro em pt-BR, com autenticação por e-mail e senha, páginas protegidas, layout responsivo e cliente único para a futura API REST.

## Implementação
- Configurar a autenticação por e-mail/senha no Lovable Cloud, usando apenas o serviço de autenticação; nome e apelido ficarão exclusivamente nos metadados do usuário, sem tabelas.
- Criar um provedor de sessão e o hook `useSession()` para restaurar e acompanhar a sessão, cadastrar, entrar e sair.
- Criar cadastro e login acessíveis com validações e mensagens exatamente como especificado, incluindo confirmação de e-mail e detecção isolada de e-mail já cadastrado.
- Proteger as páginas privadas e redirecionar para `/login` quando a sessão não existir ou for perdida.
- Criar o layout do aplicativo com menu lateral no desktop, menu móvel, apelido do usuário e saída segura.
- Criar as páginas-placeholder Dashboard, Extrato, Importar, Cartão de crédito, Contas e Categorias, contendo somente seus títulos.
- Criar um cliente REST centralizado com token Bearer, fuso horário, erros tipados, encerramento da sessão em 401 e seleção de mocks por área via `VITE_MOCK_AREAS`.
- Criar a estrutura inicial de mocks, sem implementar dados das áreas ainda.
- Criar utilitários de moeda decimal em string e data local.
- Aplicar um visual financeiro sóbrio, responsivo, acessível, com temas claro e escuro.

## Rotas
- Públicas: `/login`, `/cadastro`.
- Protegidas: `/`, `/extrato`, `/importar`, `/cartao`, `/contas`, `/categorias`.
- A estrutura usará o roteador nativo do projeto, preservando as URLs e os comportamentos solicitados.

## Testes e qualidade
- Cobrir cliente da API, sessão, cadastro, login, proteção de acesso e formatação com Vitest e Testing Library.
- Adicionar scripts de teste, verificação de tipos e lint.
- Validar o fluxo principal em desktop e celular e conferir que todas as rotas têm metadados próprios.

## Limites
- Sem tabelas, políticas, migrations ou acesso direto a dados no serviço de autenticação.
- Sem reset de senha, login social, MFA ou conteúdo real nas páginas privadas.
