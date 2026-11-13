# Demonstração do MVP

## Problema e proposta

Os condutores registravam as viagens no papel e a administração digitava os dados novamente no Excel. O sistema centraliza o registro e mantém consulta, assinatura, impressão e exportação, reduzindo a redigitação.

## Preparação

Use dados fictícios e o ambiente local configurado conforme o [guia técnico](GUIA_TECNICO.md). O banco inicial inclui três veículos DEMO e cinco setores. Cadastre duas contas fictícias pela interface, como Condutor Demonstração e Consulta Demonstração, com e-mails de exemplo e senhas próprias. Aprove ambas como administrador e altere a segunda para o perfil Consulta na seção Usuários. Não coloque senhas no repositório.

Antes da apresentação, registre e conclua uma viagem de demonstração com chegada no dia seguinte, passageiros fictícios e uma assinatura desenhada apenas para o teste. Deixe outra viagem em andamento para mostrar o bloqueio de nova saída. Esses registros são criados pelas telas e persistidos no MySQL, sem inserir assinaturas simuladas pelo SQL.

Os testes automatizados também criam condutores e ocorrências fictícias em um banco temporário separado, cobrindo os três perfis, viagens concluídas/em andamento e correções; não modificam seu banco local.

## Entrega 3: CRUD, integração e permissões

1. Entre como administrador e abra Veículos no menu lateral. Cadastre um veículo fictício com placa válida e número interno ainda não utilizados (POST /api/veiculos).
2. Localize o veículo na lista e recarregue a página para mostrar a consulta dos dados persistidos no MySQL (GET /api/veiculos).
3. Use Editar para alterar o modelo, salve e confira o resultado após recarregar (PUT /api/veiculos/:id).
4. Tente cadastrar uma placa duplicada e uma placa inválida para mostrar as mensagens de validação. Explique que o backend também valida as entradas.
5. Use Arquivar no veículo fictício e confirme (DELETE /api/veiculos/:id). Mostre que ele sai da lista e explique a exclusão lógica: o banco preserva o registro e os vínculos históricos. Desativar é uma ação diferente, que permite reativação pela interface.
6. Na aba Network/Rede das ferramentas do navegador, mostre os métodos e respostas das requisições. Relacione o Fetch em frontend/api.js e a atualização do DOM em frontend/cadastros.js às rotas e consultas do backend.
7. Entre como Condutor ou Consulta e acesse /api/veiculos pela barra do navegador para demonstrar a resposta de acesso negado. Mostre em backend/routes/cadastrosRoutes.js que todas as operações exigem admin, inclusive quando chamadas diretamente, sem passar pelos botões.
8. Demonstre o bloqueio de nova viagem para condutor ou veículo já ocupado e a rejeição de km final inferior ao inicial. Use o fluxo de viagens descrito abaixo.

Use somente o veículo fictício criado para essa demonstração ao arquivar. As alterações feitas pelas telas ficam no banco local.

## Roteiro completo do MVP

1. Apresente o problema, o público e a proposta de registrar os dados uma única vez.
2. Mostre cadastro pendente, aprovação e os acessos de Condutor, Consulta e Administrador.
3. Como condutor, registre a saída com veículo, setor, quilômetros, destino e passageiros. Mostre que outra viagem fica bloqueada enquanto a atual não for assinada e concluída.
4. Registre a chegada e o km final. Mostre a distância automática e a validação de km inferior ao inicial. Assine para concluir.
5. Consulte o dashboard e o histórico com pesquisa e filtros; abra o PDF, a impressão e a exportação administrativa para Excel.
6. Como administrador, abra uma viagem concluída, proponha um ajuste com justificativa e assinatura. Mostre que o registro atual permanece igual enquanto aguarda o condutor.
7. Como condutor, abra Correções pendentes, confira a comparação, marque a concordância e assine. Mostre os dados atualizados, a versão anterior, a assinatura preservada e o PDF com as duas assinaturas da correção.
8. Mostre a gestão de usuários e explique a proteção do último administrador e o bloqueio de acesso para contas inativas.
9. Explique a arquitetura: HTML/CSS/JavaScript com DOM e Fetch → rotas Express → controllers → services → MySQL. Mostre os relacionamentos do banco, JWT em cookie HttpOnly, hash de senha e permissões na API.

## Pontos para explicar na apresentação

- O frontend não acessa o MySQL diretamente nem decide permissões.
- O JWT identifica a conta; perfil e status atuais vêm do banco em cada requisição.
- Restrições no banco e transações impedem duas viagens em andamento para o mesmo veículo/condutor.
- Datas são armazenadas em UTC e apresentadas no horário de Brasília.
- A correção preserva o registro anterior; a proposta só entra em vigor com as duas assinaturas.
- A assinatura desenhada é um recurso de protótipo. O processo físico continua disponível durante a validação.
- O MVP não inclui GPS, manutenção, combustível ou integração com ERP.
