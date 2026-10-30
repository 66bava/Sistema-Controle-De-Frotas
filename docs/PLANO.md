# Plano de desenvolvimento

## Referências e decisões

O PDF Projeto Web.pdf define os requisitos acadêmicos. [contexto.md](referencias/contexto.md) detalha o domínio e [estrutura.png](referencias/estrutura.png) define a organização do código. O PDF tem prioridade: Node.js + Express + MySQL; frontend HTML, CSS e JavaScript com DOM e Fetch. MySQL Workbench será usado para administrar o banco. Supabase não será utilizado.

Decisões confirmadas pelo usuário:

- Visual substituído por escolha do usuário: escuro grafite, contraste forte e detalhes verdes. Referência Localiza anterior descontinuada; usar fonte de sistema e variáveis em frontend/variables.css.
- Condutor se cadastra e aguarda aprovação administrativa. Conta pendente não pode registrar ou consultar viagens. Cadastro público nunca permite escolher perfil privilegiado.
- Consultar o usuário antes de decisões cruciais de visual, adaptações e regras de negócio.

## Entrega 1 — Problema e estrutura inicial

- Documentar problema, público, proposta, perfis e fluxo.
- Manter backend/controllers, database/conexao.js, middlewares/corsemiddleware.js, routes, server.js, package.json e .env.example; frontend/INDEX.HTML e script.js; acrescentar styles.css e sql.
- O arquivo campeonatosControllers.js da imagem exemplifica a organização; os controllers serão do domínio de frotas.
- Criar servidor Express e página inicial com Fetch para GET /api/saude.
- Validar API, arquivos estáticos e sintaxe. Conferir o visual em navegador antes de encerrar a validação visual.

## Entrega 2 — Banco e autenticação

1. Apresentar modelo relacional antes de criar o schema: usuários, veículos, setores, ocorrências, passageiros, assinaturas e auditoria.
2. Manter a criação completa do banco em sql/banco.sql, executável pelo Workbench, com relacionamentos, índices e dados fictícios. Testes ficam separados.
3. Implementar cadastro de condutor pendente, aprovação pelo administrador, login, hash de senha e JWT.
4. Criar middlewares de autenticação e autorização. Nenhum usuário pode elevar o próprio perfil.
5. Documentar criação segura do primeiro administrador.
6. Testar credenciais incorretas, conta pendente/inativa, token inválido e acesso proibido.

## Entrega 3 — CRUD e integração

1. CRUD administrativo de veículos com POST, GET, PUT e DELETE. Exclusão lógica preserva históricos; diferenciar de simples inativação.
2. Gestão de usuários e setores.
3. Iniciar ocorrência com código OC-000001 gerado pelo servidor, veículo e condutor ativos, setor existente e passageiros opcionais.
4. Registrar chegada, km final e assinatura do próprio condutor. Concluir somente com dados válidos e assinatura, usando transação.
5. Dashboard simples, detalhes, histórico, pesquisa e filtros.
6. Auditoria de criação, conclusão, assinatura e correções administrativas. Não apagar ocorrências definitivamente.

Aceite: fluxo persiste no MySQL após reiniciar o servidor. Driver acessa apenas suas ocorrências; viewer consulta; admin gerencia e exporta. Verificar restrições diretamente na API.

## Entrega 4 — Documentos e conclusão

- PDF A4, assinatura e impressão com informações equivalentes à folha atual.
- Excel com registros filtrados ou de um período.
- Testes de fluxo completo, permissões, validações, documentos, filtros e exportação.
- Revisão de responsividade, acessibilidade, mensagens e prevenção de duplicidade.
- README final com instalação, SQL, rotas e testes; roteiro de apresentação.

## Regras e pontos para alinhamento

Distância sempre calculada pelo backend. Km final deve ser maior ou igual ao inicial. Chegada deve ser posterior ou igual à saída. Ocorrência concluída exige assinatura vinculada ao usuário e instante. A assinatura é um recurso de protótipo.

Regras confirmadas: viagens podem atravessar a meia-noite; impedir nova viagem para veículo ou condutor com ocorrência em andamento, exigindo concluir a anterior com assinatura. Correções exigem justificativa e novas assinaturas do administrador responsável e do condutor. Guardar versão anterior e aplicar somente após ambas as assinaturas. Datas completas em UTC, apresentadas no fuso America/Sao_Paulo. Modelo e limitações em sql/MODELO.md.

Não implementar GPS, mapas, combustível, manutenção, IA ou funcionalidades fora do MVP. Validar cada etapa antes de avançar. Manter o mesmo repositório nas quatro entregas, com commits coerentes e README atualizado.

## Progresso em 28/10/2026

- Estrutura, schema e conexão MySQL local verificados. Usuário informou executar sql/banco.sql.
- Cadastro pendente, login, cookie JWT, sessão, logout, aprovação administrativa e auditoria implementados.
- Primeiro administrador criado por comando local interativo; nenhuma conta criada automaticamente no ambiente de desenvolvimento.
- Testes unitários e integração com MySQL isolado e Chrome; telas de login, cadastro e aprovação em tema grafite/verde.
- Etapa seguinte: cadastros administrativos, seguidos pelo fluxo de viagens.

## Progresso em 29/10/2026

- Veículos: GET, POST, PUT e DELETE com exclusão lógica; consulta por ID, ativação/desativação, validação de placa e duplicidade.
- Setores: consulta, criação, edição e ativação/desativação.
- Interface administrativa com abas, busca, filtro de status e formulários em dialog. Acesso restrito a admin pela API.
- Auditoria transacional de criação, edição e arquivamento; histórico de viagens preservado.
- Testes unitários, integração MySQL isolada e fluxo real no Chrome aprovados. Nenhuma migration necessária nem alteração de dados reais nesta etapa.
- Naquele ponto ainda faltavam gestão completa de usuários e o fluxo de ocorrências, assinatura, histórico e documentos; avanços registrados abaixo.

## Início de ocorrências — 29/10/2026

- POST de início com condutor da sessão, validação de ativos, passageiros opcionais e auditoria transacional.
- Bloqueio de viagem simultânea por condutor/veículo, com locks e índices únicos existentes.
- Opções de cadastro para condutores sem liberar acesso administrativo a veículos/setores.
- Lista recente e detalhe com acesso restrito ao próprio condutor; admin/viewer consultam a frota.
- Interface de saída responsiva, código OC e retomada após recarregar. Horários tratados por Temporal em America/Sao_Paulo e UTC no MySQL.
- Testes unitários e integração com concorrência e Chrome aprovados sem alterações no banco de desenvolvimento.
- Chegada e assinatura foram implementadas na etapa seguinte, descrita abaixo.

## Chegada, assinatura e conclusão — 29/10/2026

- Chegada e km final persistidos, com validação no frontend/backend e distância calculada no MySQL.
- Assinatura por canvas com mouse/toque/caneta; PNG validado, sem permitir imagem vazia.
- Apenas o condutor ativo da ocorrência pode registrar chegada e assinar. Admin/viewer consultam conforme seu perfil.
- Revisão impede confirmar assinatura sobre dados alterados em outra aba.
- Conclusão e auditoria atômicas, sem duplicidade por envio concorrente. Viagem concluída libera os índices únicos de veículo/condutor.
- Assinatura persistida e consultada em endpoint protegido. Fluxo retomável após recarregar a página.
- Testes unitários e integração MySQL/Chrome aprovados, incluindo retorno no dia seguinte e confirmação concorrente. Nenhuma migration necessária.
- Histórico completo e filtros foram implementados após a revisão da navegação; documentos e exportação seguem como etapas seguintes. Correção administrativa com duas assinaturas continua pendente.

## Ajuste de navegação — revisão do usuário

- Menu lateral compartilhado por painel e viagens; fixo no desktop e recolhível no celular.
- Nomes claros por perfil, item selecionado, atalhos no Início e saída da conta no menu.
- Cadastros e aprovações abertos por URL da seção, preservando navegação em recargas.
- Ações renomeadas para Registrar saída, Registrar chegada e Assinar e concluir viagem.
- Nenhuma alteração no banco ou nas permissões. Menu conferido e aprovado pelo usuário antes do início do histórico.

## Histórico completo e filtros — 29/10/2026

- Pesquisa por código, placa, veículo, condutor, setor, itinerário e passageiro.
- Filtros combinados: período de saída no fuso local, veículo, condutor, setor e status.
- Paginação real com totais e acesso a todos os registros; contagem/consulta em snapshot consistente.
- Opções históricas incluem inativos e arquivados, respeitando a privacidade do condutor.
- Tabela desktop, cards no celular, filtros na URL e retorno dos detalhes mantendo a consulta.
- Viagem em andamento obtida separadamente dos filtros para manter visível seu acesso à finalização.
- Testes unitários, integração MySQL isolada e Chrome aprovados. Nenhuma alteração no schema ou dados reais.
- Próxima etapa: PDF e impressão. Permanecem pendentes também Excel, dashboard, gestão completa de usuários e correções com justificativa e duas assinaturas.

## PDF e impressão — 30/10/2026

- Gerar PDF e Imprimir adicionados aos detalhes da ocorrência.
- A4 com paleta grafite/verde lida do site, fonte incorporada, assinatura, revisão e numeração de páginas.
- Corpo branco e versão de impressão com adaptação das cores para legibilidade em papel.
- Documento parcial identificado quando a viagem ainda não foi assinada/concluída.
- Leitura transacional de dados, passageiros e assinatura; mesmos controles de acesso do detalhe.
- Conteúdo longo com continuação de páginas, nomes de passageiros preservados e assinatura mantida em bloco.
- Testes de conteúdo, layout A4, páginas, escape de HTML, permissões e fluxo no Chrome. Nenhuma alteração no banco de desenvolvimento.
- Próxima etapa: exportação Excel conforme os filtros. Continuam pendentes também dashboard, gestão completa de usuários e correções administrativas com duas assinaturas.

## Exportação Excel — 30/10/2026

- Ação Exportar Excel no histórico administrativo, com todos os resultados dos filtros aplicados.
- Endpoint exige admin ativo; não depende de ocultar botões. Paginação validada mas não limita os registros exportados.
- Dados completos das ocorrências e passageiros no mesmo snapshot do banco.
- Datas civis/horários em Brasília, quilômetros numéricos e campos textuais literais, preservando conteúdos semelhantes a fórmulas.
- Cabeçalhos grafite/verde, filtros do Excel, congelamento de linhas e critérios da exportação. Pendências sem valores inventados.
- Dependência de geração instalada com override transitivo corrigido; auditoria sem vulnerabilidades.
- Testes unitários, integração MySQL temporária e download no Chrome aprovados. Nenhuma migration necessária.
- Próxima etapa proposta: dashboard simples com indicadores. Ainda faltam gestão completa de usuários e correções com justificativa e assinatura de administrador/condutor, além da revisão final do MVP.

## Organização do desenvolvimento

- Referências originais agrupadas em docs/referencias, preservando o conteúdo.
- Guia técnico, mapa de navegação e plano concentrados em docs; README da raiz com atalhos e comandos principais.
- Código formatado para leitura, sem mudar a estrutura backend/frontend/sql ou regras do sistema.
- Comandos de execução, teste e formatação disponíveis na raiz. Configuração do editor facilita seguir importações e localizar funções.
- Resultados gerados de testes e .gitignore redundante do backend removidos; dependências locais, .env, fontes e testes preservados.

## Dashboard — 30/10/2026

- Início com saídas de hoje (Brasília), viagens em andamento, concluídas e veículos ativos.
- Totais de status consideram todo o histórico; ativos inclui veículos em viagem, sem arquivados.
- Condutor consulta somente suas viagens; admin e consulta visualizam toda a frota.
- Cinco saídas mais recentes com acesso direto ao detalhe, atualização manual e tratamento de falhas.
- Consultas no mesmo snapshot, sem alterar o schema.
- Próxima etapa: gestão completa de usuários; correções com justificativa e duas assinaturas permanecem pendentes.

- Validação: 43 testes de integração/interface e 27 unitários aprovados; formatação conferida. Banco de desenvolvimento preservado.
