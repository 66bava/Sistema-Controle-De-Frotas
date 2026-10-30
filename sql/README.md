# Banco de dados no MySQL Workbench

## Preparação

1. Abrir a conexão local de desenvolvimento no Workbench.
2. Conferir a versão com SELECT VERSION(); é necessário MySQL Server 8.0.16 ou superior, por causa dos CHECKs.
3. Ler [MODELO.md](MODELO.md). Não executar scripts em um banco de produção.
4. Abrir e executar [banco.sql](banco.sql). Esse único arquivo cria o banco, as sete tabelas, os relacionamentos, as restrições, cinco setores e três veículos fictícios, e executa consultas de conferência.
5. Atualizar a lista de Schemas no Workbench.
6. Usar Database → Reverse Engineer para gerar o diagrama a partir do banco criado.

O schema é uma criação inicial, não uma migration para tabelas já existentes. Não repetir banco.sql caso o banco já contenha essas tabelas. Não há DROP nem TRUNCATE. A criação de tabelas MySQL faz commits implícitos: se houver erro, examinar o estado antes de continuar.

## Configuração da aplicação

Copiar backend/.env.example para backend/.env e preencher DB_HOST, DB_PORT, DB_USER, DB_PASSWORD e DB_NAME localmente. Não enviar a senha pelo chat nem versionar o arquivo. Usar DB_NAME=controle_frotas e usuário próprio da aplicação, não root.

Cadastro e login estão implementados. Criar o primeiro administrador pelo comando npm.cmd run criar-admin, na pasta backend. Condutores se cadastram pela interface e aguardam aprovação. Não há senhas compartilhadas no seed.

## Verificação

As consultas de conferência estão no final de banco.sql. Separadamente, testes/regras.sql executa casos positivos e negativos com ROLLBACK dos registros em desenvolvimento; não é necessário executá-lo para instalar o banco. O teste cria um procedimento temporário de verificação no schema e o remove ao terminar com sucesso; requer CREATE ROUTINE e EXECUTE. Uma execução com erro pode deixar o procedimento para inspeção. AUTO_INCREMENT pode avançar apesar do ROLLBACK.

Validação concluída em 28/10/2026 no MySQL 8.0.42, em instância temporária isolada: schema criado, seed executado duas vezes e testes estruturais aprovados. Foram conferidos sete tabelas, três veículos, cinco setores e zero usuários após o ROLLBACK. A instância foi encerrada. Seu serviço MySQL80 e os bancos existentes não foram alterados.

O arquivo banco.sql consolida, na mesma ordem e sem alterar as instruções, os scripts de estrutura, dados iniciais e conferência. O usuário informou executar banco.sql no Workbench, e a conexão da aplicação confirmou as sete tabelas. Não é necessário repetir a criação.
