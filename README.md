# Sistema de Controle de Frotas

Projeto web para organizar os registros diários de viagens com frota empresarial.

## Problema e público afetado

Atualmente, muitas empresas preenchem os dados das viagens em folhas de papel. Depois, a equipe administrativa precisa digitar essas informações novamente em uma planilha Excel.

Esse processo gera retrabalho, dificulta a consulta do histórico e aumenta a possibilidade de erros. O público afetado são os condutores e a equipe responsável pelo controle dos registros da frota.

## Proposta de solução

Centralizar o registro e a consulta das viagens em um sistema web. Os dados serão preenchidos uma única vez, com possibilidade de gerar PDF, imprimir e exportar para Excel, mantendo o uso do documento físico durante a validação do sistema.

## Principais funcionalidades

- Cadastro, login e aprovação de condutores.
- Controle de acesso conforme o perfil do usuário.
- Cadastro e gestão de veículos, setores e usuários.
- Registro de saída, chegada, quilometragem e passageiros opcionais.
- Cálculo automático da distância percorrida e assinatura do condutor.
- Histórico com pesquisa e filtros.
- Dashboard com indicadores e viagens recentes.
- Geração de PDF, impressão e exportação para Excel.
- Correção administrativa com justificativa e assinaturas do administrador e do condutor.

## Perfis de usuário

| Perfil        | Ações previstas                                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Condutor      | Cadastrar-se e aguardar aprovação, consultar suas viagens, registrar saída e chegada e assinar suas ocorrências.                                               |
| Consulta      | Consultar as viagens, pesquisar, filtrar e visualizar os documentos, sem editar dados.                                                                         |
| Administrador | Aprovar e gerenciar usuários, veículos e setores, consultar todas as viagens, exportar dados e corrigir ocorrências mediante justificativa e duas assinaturas. |

As permissões são verificadas também pela API.

## Fluxo básico

1. O condutor se cadastra e aguarda aprovação do administrador.
2. Após o login, seleciona o veículo e registra a saída da viagem.
3. Ao retornar, informa a chegada e a quilometragem final.
4. O sistema calcula a distância, e o condutor assina para concluir a ocorrência.
5. O registro fica disponível no histórico para consulta, PDF e impressão. O administrador também pode exportar os dados para Excel.

Uma viagem pode terminar no dia seguinte. O sistema impede outra viagem para o mesmo condutor ou veículo enquanto a anterior estiver em andamento.

## Tecnologias

HTML, CSS e JavaScript no frontend, com manipulação do DOM e requisições Fetch. Backend com Node.js e Express, banco relacional MySQL e autenticação JWT. O banco pode ser administrado pelo MySQL Workbench.

## Estrutura do projeto

```text
backend/
  controllers/   Entrada e resposta das requisições
  database/      Conexão com o MySQL
  middlewares/   Autenticação, permissões e tratamento de erros
  routes/        Rotas da API
  services/      Regras de negócio
frontend/        Telas, estilos e interação com a API
sql/             Scripts e modelo do banco de dados
docs/            Documentação e referências
README.md        Apresentação do projeto
.gitignore       Exclusão de dependências e credenciais do Git
```

## Andamento

Já estão implementados autenticação, aprovação de condutores, veículos, setores, registro e conclusão de viagens com assinatura, histórico, dashboard, PDF, impressão e Excel.

Permanecem previstas a gestão completa de usuários, as correções administrativas com justificativa e duas assinaturas e a revisão final do sistema.

## Documentação complementar

- [Guia técnico e instruções de instalação](docs/GUIA_TECNICO.md).
- [Mapa do código](docs/NAVEGACAO.md).
- [Plano de desenvolvimento](docs/PLANO.md).
- [Script completo do banco](sql/banco.sql) e [instruções do MySQL Workbench](sql/README.md).
