# Demonstração do MVP

## Problema e proposta

Os condutores registravam as viagens no papel e a administração digitava os dados novamente no Excel. O sistema centraliza o registro e mantém consulta, assinatura, impressão e exportação, reduzindo a redigitação.

## Preparação

Use dados fictícios e o ambiente local configurado conforme o [guia técnico](GUIA_TECNICO.md). O banco inicial inclui três veículos DEMO e cinco setores. Cadastre duas contas fictícias pela interface, como Condutor Demonstração e Consulta Demonstração, com e-mails de exemplo e senhas próprias. Aprove ambas como administrador e altere a segunda para o perfil Consulta na seção Usuários. Não coloque senhas no repositório.

Antes da apresentação, registre e conclua uma viagem de demonstração com chegada no dia seguinte, passageiros fictícios e uma assinatura desenhada apenas para o teste. Deixe outra viagem em andamento para mostrar o bloqueio de nova saída. Esses registros são criados pelas telas e persistidos no MySQL, sem inserir assinaturas simuladas pelo SQL.

Os testes automatizados também criam condutores e ocorrências fictícias em um banco temporário separado, cobrindo os três perfis, viagens concluídas/em andamento e correções; não modificam seu banco local.

## Roteiro sugerido

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
