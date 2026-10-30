# Sistema de Controle de Frotas

Sistema interno de ocorrências diárias de transporte para uma pequena frota empresarial.

## Problema e proposta

Condutores registram viagens em papel e a equipe administrativa redigita os dados no Excel. O contexto estima 40 minutos por veículo por semana, aproximadamente duas horas semanais para três veículos.

A proposta é registrar cada viagem uma única vez, permitindo consulta, assinatura, PDF, impressão e exportação Excel. Passageiros são opcionais e não precisam ter conta. O processo físico permanece durante a avaliação do protótipo.

## Tecnologias

Conforme o PDF: Node.js, Express, MySQL, JWT e frontend HTML/CSS/JavaScript com DOM e Fetch. MySQL Workbench para administração do banco. A estrutura mantém backend/frontend/sql, conforme [estrutura.png](referencias/estrutura.png). O plano está em [PLANO.md](PLANO.md).

## Estado atual

Implementados: schema MySQL, cadastro de condutor pendente, login, JWT em cookie HttpOnly, sessão, logout, autorização por perfil, listagem e aprovação administrativa com auditoria e comando local de primeiro administrador. Frontend integrado com Fetch: login, cadastro, confirmação, aprovação e cadastros administrativos. A senha usa scrypt com salt individual, nunca texto puro.

Novo visual escolhido pelo usuário: tema escuro grafite, contraste forte e detalhes verdes, substituindo a referência Localiza anterior. Variáveis em frontend/variables.css; fonte de sistema, sem dependência externa.

A conexão do backend com o MySQL local foi verificada e as sete tabelas foram encontradas. Não é necessário executar banco.sql novamente. Os testes de integração usam outra instância MySQL temporária e não criam contas no banco de desenvolvimento.

Implementados também os cadastros administrativos de veículos e setores: consulta, criação, edição, busca, filtro de status e ativação/desativação. Veículos podem ser arquivados via DELETE com exclusão lógica, mantendo ocorrências vinculadas e auditoria. Todas as rotas desses cadastros exigem admin ativo. Não há alteração de schema para essa etapa.

Implementado o início de ocorrências: condutor autenticado, veículo/setor ativos, data e horário completos no fuso de Brasília, km inicial, itinerário e passageiros opcionais. Viagens, passageiros e auditoria são gravados em uma transação. Índices e bloqueios impedem duplicidade por veículo/condutor, inclusive sob concorrência.

Histórico completo paginado e detalhes disponíveis em ocorrencias.html, com pesquisa e filtros por período de saída, veículo, condutor, setor e status. Drivers acessam apenas suas próprias viagens; admin/viewer consultam todas. Somente driver inicia a própria viagem.

Implementados chegada, km final, distância gerada pelo MySQL, assinatura em canvas e conclusão transacional. A chegada pode ser salva e retomada depois. Somente a confirmação da assinatura muda o status para completed e libera veículo/condutor. A assinatura PNG fica vinculada ao condutor, ocorrência e instante de confirmação.

Gerar PDF e Imprimir estão disponíveis nos detalhes de cada ocorrência, com layout A4, grafite e verde da paleta do site e assinatura do condutor. Documentos em andamento são identificados como parciais.

Exportar Excel está disponível no histórico do administrador, utilizando todos os resultados dos filtros aplicados, independentemente da página visível. Datas/horários e quilômetros são gravados com tipos e formatos próprios do Excel.

Implementados também: dashboard, gestão de usuários e correções de ocorrências concluídas com justificativa e duas assinaturas. Os dados apresentados vêm do MySQL.

## Perfis

| Perfil | Responsabilidades previstas                                                |
| ------ | -------------------------------------------------------------------------- |
| Driver | Criar, consultar, finalizar e assinar suas próprias ocorrências            |
| Viewer | Consultar ocorrências, pesquisar, filtrar e visualizar documentos          |
| Admin  | Aprovar condutores, gerenciar cadastros, corrigir com auditoria e exportar |

Cadastro público cria somente driver/pending e rejeita tentativas de definir perfil/status. Contas pendentes ou inativas não entram. Cada requisição protegida busca o usuário atual no MySQL, evitando manter acesso de uma conta inativada ou permissões antigas no JWT.

## Estrutura

- backend/controllers: entrada e resposta HTTP.
- backend/services: autenticação, senha, JWT e regras transacionais.
- backend/database/conexao.js: pool MySQL com sessão em UTC.
- backend/middlewares: autenticação, autorização, origem, CORS e erros.
- backend/routes: rotas e limites de tentativas.
- backend/utils: validação e erros de negócio.
- backend/scripts: primeiro administrador e testes isolados.
- backend/tests: testes unitários e de integração.
- frontend: HTML, CSS e módulos JavaScript.
- sql/banco.sql: banco completo; sql/testes/regras.sql: testes estruturais.

## Instalação e execução local

Requer Node.js 22.9+ e MySQL Server 8.0.16+. Para uma instalação nova, seguir [sql/README.md](../sql/README.md). Não repetir o script no banco existente.

No PowerShell, a partir da raiz:

    cd backend
    npm.cmd install
    if (!(Test-Path .env)) { Copy-Item .env.example .env }

Configurar backend/.env com os dados locais do MySQL e JWT_SECRET aleatório de pelo menos 32 bytes. No ambiente atual a chave JWT foi gerada automaticamente no .env, sem exibição e sem alterar as credenciais existentes. Não versionar nem compartilhar esse arquivo. FRONTEND_ORIGIN deve corresponder à origem usada no navegador, normalmente http://localhost:3000.

Criar o primeiro administrador no terminal interativo:

    npm.cmd run criar-admin

Informar nome, e-mail e uma senha entre 10 e 128 caracteres. A senha fica oculta durante a digitação. O comando recusa criar outro administrador se já existir um. Não há rota pública para criar administradores. A conta inicial já fica ativa e sua criação registra auditoria.

Iniciar o servidor:

    npm.cmd run dev

Abrir http://localhost:3000. Para executar sem watch: npm.cmd start. Em produção, usar HTTPS e NODE_ENV=production para cookie Secure. JWT expira em uma hora; logout limpa o cookie no navegador. Não armazenar JWT no localStorage.

## Como conferir o fluxo

1. Criar o administrador pelo comando local.
2. Abrir o site e solicitar um cadastro de condutor com outro e-mail.
3. Tentar entrar como condutor: deve informar que aguarda aprovação.
4. Entrar como administrador e aprovar o cadastro na lista de solicitações.
5. Sair e entrar como condutor: deve mostrar acesso ativo.
6. Conferir no Workbench os registros em usuarios e auditoria, sem copiar hashes ou credenciais para documentação.
7. Na conta admin, abrir Veículos e Setores pelo menu lateral. Cadastrar, editar e conferir filtros e status.
8. Arquivar um veículo de teste: ele sai da lista, mas seu registro e histórico permanecem no banco. Placa e número interno continuam reservados. Para suspensão temporária, usar Desativar.

## Rotas implementadas

| Método             | Rota                            | Acesso                                                       |
| ------------------ | ------------------------------- | ------------------------------------------------------------ |
| GET                | /api/saude                      | Público; saúde do servidor, não verifica MySQL               |
| POST               | /api/auth/cadastro              | Público, limitado; cria condutor pendente                    |
| POST               | /api/auth/login                 | Público, limitado; emite cookie JWT                          |
| GET                | /api/auth/sessao                | Usuário ativo autenticado                                    |
| POST               | /api/auth/logout                | Limpa o cookie                                               |
| GET                | /api/usuarios/pendentes         | Admin ativo                                                  |
| POST               | /api/usuarios/:id/aprovar       | Admin ativo, transação com auditoria                         |
| GET / POST         | /api/veiculos                   | Admin: listar e cadastrar                                    |
| GET / PUT / DELETE | /api/veiculos/:id               | Admin: consultar, editar e arquivar                          |
| GET / POST         | /api/setores                    | Admin: listar e cadastrar                                    |
| GET / PUT          | /api/setores/:id                | Admin: consultar e editar                                    |
| GET                | /api/ocorrencias/opcoes         | Driver: veículos/setores ativos e disponibilidade            |
| POST               | /api/ocorrencias                | Driver: iniciar a própria viagem                             |
| GET                | /api/ocorrencias                | Histórico com filtros, total e paginação, respeitando perfil |
| GET                | /api/ocorrencias/filtros        | Opções históricas permitidas ao usuário, incluindo inativos  |
| GET                | /api/ocorrencias/exportar-excel | Admin ativo: todos os resultados filtrados em XLSX           |
| GET                | /api/ocorrencias/:id            | Driver: somente própria; admin/viewer: todas                 |
| PUT                | /api/ocorrencias/:id/chegada    | Driver: salvar chegada/km da própria viagem                  |
| POST               | /api/ocorrencias/:id/assinatura | Driver: assinar revisão conferida e concluir                 |
| GET                | /api/ocorrencias/:id/assinatura | PNG protegido pelas mesmas permissões de leitura             |
| GET                | /api/ocorrencias/:id/pdf        | PDF A4 para download; mesmas permissões de leitura           |
| GET                | /api/ocorrencias/:id/impressao  | Documento HTML A4 protegido para impressão                   |

POST exige application/json. Requisições com Origin diferente do configurado são rejeitadas. Sessão é enviada automaticamente via cookie; as permissões não dependem dos botões visíveis.

## Testes

    npm.cmd test

Executa testes unitários; integração é ignorada sem MYSQL_INTEGRATION=1. Não carrega .env nem acessa o banco local nessa execução.

Integração real em instância MySQL temporária, com o servidor instalado no caminho padrão do Windows:

    npm.cmd run test:integracao
    npm.cmd run test:interface

A interface usa o Chrome instalado e gera capturas em backend/test-results, ignorado pelo Git. O banco deve terminar em _test; o script usa porta aleatória e não carrega .env. A instância temporária é encerrada e os logs permanecem na pasta temporária informada. Os testes verificam primeiro administrador, cadastro, duplicidade, pendência, login, JWT inválido/expirado, autorização, inativação, auditoria, logout e o fluxo de aprovação pelo navegador, incluindo layout de celular.

Se o Windows bloquear scripts locais, executar a rotina com liberação apenas para esse processo, sem mudar a política do sistema:

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/testar-isolado.ps1 -ComNavegador

## Regras confirmadas das viagens

Viagens podem terminar no dia seguinte. Veículo e condutor só podem ter uma ocorrência em andamento; é necessário concluir e assinar a anterior antes de outra. Correções exigem justificativa e assinaturas do administrador e do condutor, preservando a versão anterior. Início, chegada e conclusão já estão integrados ao MySQL. O fluxo de correção com duas assinaturas está implementado conforme a seção abaixo.

## Entregas e GitHub

Manter o mesmo repositório nas quatro entregas, commits coerentes e README atualizado. Não enviar node_modules, .env, senhas, tokens ou resultados locais de testes. Para avaliação, os arquivos precisam ser enviados ao GitHub no prazo.

## Validação dos cadastros em 29/10/2026

Testes unitários aprovados para placas antigas/Mercosul, campos e identificadores. Integração aprovada com MySQL 8.0.42 isolado: CRUD de veículos, cadastros de setores, status, duplicidade, auditoria e preservação de viagem vinculada após arquivamento. Chrome validou edição, filtros, ativação/desativação, arquivamento e uso de setores em tela de celular. Dados de teste não foram inseridos no banco de desenvolvimento.

## Iniciar uma viagem

1. Entrar como condutor aprovado e abrir Minhas viagens ou o link Viagens no cabeçalho.
2. Clicar em Nova viagem.
3. Selecionar veículo e setor ativos; conferir data/horário de saída, informar km inicial e itinerário. Passageiros são opcionais, um por linha.
4. Clicar em Registrar saída. A confirmação apresenta código e detalhes salvos no MySQL.
5. Retornar depois pela lista de viagens. Não é necessário manter a página aberta.

Horários usam America/Sao_Paulo na entrada e apresentação, com UTC no banco. A conversão usa Temporal, rejeitando datas inexistentes. [Referência técnica](https://tc39.es/proposal-temporal/docs/plaindatetime.html). O código usa o ID gerado no banco, com no mínimo seis dígitos sem truncar IDs maiores.

O condutor não pode informar outro usuário, status, distância ou campos de conclusão ao iniciar. Uma viagem em andamento impede outra para a mesma pessoa ou veículo. O bloqueio exige conclusão com assinatura; salvar somente a chegada não libera o veículo. Não há encerramento automático.

Testes aprovados: horário noturno preservando a data local, passageiros opcionais, dados inválidos, acessos indevidos, concorrência pelo mesmo veículo e recuperação da ocorrência após recarregar. Chrome validou a saída em celular e detalhe em desktop, em MySQL temporário isolado.

## Finalizar e assinar a viagem

1. Entrar como o condutor da ocorrência e abrir a viagem em andamento.
2. Em Registrar chegada, conferir a data completa de chegada e informar o km final. A chegada pode ocorrer no dia seguinte.
3. Clicar em Registrar chegada e continuar. Distância é calculada pelo banco; não é um campo de entrada.
4. Desenhar a assinatura com mouse, dedo ou caneta. Limpar assinatura permite refazer.
5. Clicar em Assinar e concluir viagem. Veículo e condutor ficam liberados para outra viagem.
6. Reabrir a ocorrência para consultar os dados e a assinatura persistida. Admin e viewer podem consultar, mas não assinar em nome do condutor.

Chegada anterior à saída, km final inferior ao inicial e PNG vazio/inválido são rejeitados. A API valida a imagem com dimensões e tamanho limitados, decodifica e regrava o PNG, usando [pngjs](https://github.com/pngjs/pngjs). Não se trata de verificação biométrica nem de assinatura certificada.

A chegada incrementa a revisão quando os dados mudam. A confirmação deve corresponder à revisão conferida; alterações em outra aba exigem reabrir, conferir e assinar novamente. Atualizar a mesma chegada não cria revisões desnecessárias. Ocorrência concluída não aceita nova chegada ou segunda conclusão por esses endpoints.

Conclusão usa lock e transação: imagem, usuário, assinado_em, status e auditorias de assinatura/conclusão são gravados juntos. Duas confirmações simultâneas produzem uma conclusão e um conflito HTTP 409. O PNG só pode ser acessado por usuário autenticado com permissão para a ocorrência.

Validação em 29/10/2026: testes unitários e integração no MySQL 8.0.42 isolado aprovados. Chrome validou chegada no dia seguinte, retomada após recarga, assinatura, limpeza, conclusão, consulta da imagem e manutenção da tela correta após recarregar. Não foi necessária alteração no schema nem execução de SQL no banco de desenvolvimento.

## Navegação lateral

As telas internas usam o mesmo menu, fixo no computador e recolhível pelo botão Menu no celular. O item atual fica destacado. O menu de celular fecha ao selecionar uma opção, clicar fora ou pressionar Escape, e mantém o foco do teclado dentro dele enquanto está aberto.

- Condutor: Início, Nova viagem, Minhas viagens e Sair da conta.
- Administrador: Início, Todas as viagens, Aprovar condutores, Veículos, Setores e Sair da conta.
- Consulta: Início, Todas as viagens e Sair da conta.

Início apresenta atalhos com descrições das ações. Veículos, Setores e Aprovar condutores usam endereços próprios com a seção selecionada, permitindo recarregar ou voltar pelo navegador sem perder a localização. Não foram acrescentados links para funcionalidades ainda não implementadas.

A navegação foi reorganizada sem alterar o schema ou as regras de acesso. O menu foi aprovado pelo usuário e o histórico com filtros foi implementado na etapa seguinte.

## Histórico, pesquisa e filtros

Abrir Minhas viagens (condutor) ou Todas as viagens (admin/consulta) pelo menu lateral. Usar Pesquisar viagens, preencher os filtros desejados e clicar em Aplicar filtros. Limpar filtros remove os critérios; Atualizar refaz a consulta e atualiza as opções de cadastro. No celular, os filtros adicionais ficam disponíveis na seção Filtrar por período, veículo e status.

A pesquisa encontra código da ocorrência, placa, marca/modelo, condutor, setor, itinerário e nomes de passageiros. Percentual e sublinhado são tratados literalmente. SQL usa parâmetros; não concatenar entradas do usuário em consultas.

O período corresponde à data local de saída em America/Sao_Paulo. O dia final é inclusivo: a API converte o início do dia seguinte para UTC e usa limite superior exclusivo, incluindo os milissegundos finais do dia selecionado. Chegada no dia seguinte não altera a data de saída usada no filtro.

Veículos arquivados/inativos, setores inativos e condutores inativos aparecem nas opções quando possuem registros no histórico acessível. O condutor recebe apenas opções presentes nas próprias viagens; o filtro de condutor é exibido somente para admin/consulta. Tentar consultar outro condutor pela API com perfil driver retorna HTTP 403.

Tabela no computador e cards no celular. Paginação permite acessar todo o histórico: padrão 20 registros, com opções de 50 e 100. Viagens em andamento aparecem primeiro; as demais são ordenadas por saída e ID decrescentes. Os filtros e a página ficam no endereço, permitindo recarregar e voltar dos detalhes sem perder a consulta. A viagem atual é consultada independentemente dos filtros, mantendo visível o acesso para chegada/assinatura mesmo se não corresponder à pesquisa.

Parâmetros de GET /api/ocorrencias:

| Parâmetro                           | Formato                                                           |
| ----------------------------------- | ----------------------------------------------------------------- |
| busca                               | Texto com até 150 caracteres                                      |
| data_inicial / data_final           | AAAA-MM-DD, opcionais e inclusivas no fuso local                  |
| veiculo_id / condutor_id / setor_id | ID inteiro positivo                                               |
| status                              | in_progress ou completed                                          |
| pagina                              | Inteiro positivo; páginas além do fim são ajustadas para a última |
| limite                              | De 1 a 100; padrão 20                                             |

Resposta inclui ocorrencias, total, pagina, paginas, limite e em_andamento (somente a viagem atual do próprio condutor, ou null). A contagem e os registros usam a mesma restrição de acesso e snapshot transacional. Datas inválidas, período invertido, status desconhecido e parâmetros duplicados são rejeitados.

Validação em 29/10/2026: testes unitários e integração MySQL 8.0.42 isolada aprovados, incluindo mais de uma página, filtros combinados, limites do dia local, pesquisa literal, privacidade, opções inativas e consulta de viagens antigas. Chrome verificou paginação, limpeza, resultado vazio, recarga, retorno dos detalhes e cards no celular. Nenhuma migration nem alteração de dados de desenvolvimento foi necessária.

## PDF e impressão

1. Abrir uma ocorrência pelo histórico.
2. Clicar em Gerar PDF para baixar OC-000001.pdf, com o código correspondente ao registro.
3. Clicar em Imprimir para abrir a versão de impressão em outra aba e o diálogo do navegador. Se necessário, usar Imprimir documento nessa aba.

O PDF usa os tokens grafite/verde de frontend/variables.css, fonte Inter incorporada, papel A4, cabeçalho de identificação, status, dados do veículo, condutor/setor, datas completas de saída/chegada, quilômetros, distância, itinerário, passageiros e assinatura. Rodapé informa código, revisão, emissão e páginas. O corpo é branco para favorecer legibilidade. Textos extensos continuam em páginas adicionais; cada nome de passageiro e o bloco de assinatura ficam juntos.

Na impressão, o papel permanece branco, com texto grafite e detalhes verdes. O cabeçalho adapta o uso das cores para continuar legível mesmo sem fundos. A barra de ações não aparece no papel. O navegador aguarda o carregamento da fonte e da assinatura antes de abrir a impressão.

A viagem em andamento gera documento parcial, com campos ainda não informados e assinatura marcados como pendentes. A chegada preenchida sem assinatura não é apresentada como conclusão. Não criar assinatura ou horários fictícios para completar o documento.

Documento, passageiros e imagem são lidos no mesmo snapshot do banco. O condutor pode gerar somente seus registros; admin e consulta têm o mesmo acesso de leitura já previsto. Endpoints exigem sessão ativa e respondem com cache privado/no-store. Não há armazenamento público de PDFs no servidor.

[PDFKit](https://pdfkit.org/docs/text.html) gera o arquivo com fontes Inter do pacote @fontsource/inter. HTML de impressão usa o mesmo modelo de dados e escapa conteúdo informado pelo usuário. PDF.js e canvas são dependências de desenvolvimento para testar conteúdo, A4 e renderizar páginas; não são necessários para gerar o PDF em produção.

Validação em 30/10/2026: PDF com assinatura em uma página A4; documento longo com itinerário e 50 passageiros, sem texto fora das margens e sem dividir nomes entre páginas; versão parcial; rejeição de acesso a outro condutor. Chrome validou download, aba de impressão, carregamento da fonte/imagem, chamada de impressão e ocultação da barra no papel. Artefatos fictícios de verificação ficam em backend/test-results, ignorado pelo Git. Nenhuma migration foi necessária.

## Exportação Excel

Na conta de administrador, abrir Todas as viagens, aplicar a pesquisa/período e os demais filtros desejados, e clicar em Exportar Excel. Sem filtros, o arquivo inclui todas as ocorrências. Paginação não restringe a exportação. O botão informa o total e fica indisponível enquanto existirem alterações de filtros ainda não aplicadas ou quando a consulta estiver vazia.

A API exige admin ativo e usa os mesmos critérios validados do histórico, inclusive o período de saída em Brasília, busca literal e cadastros históricos inativos. Condutor e consulta recebem HTTP 403, mesmo tentando o endereço diretamente. Resposta com cache privado/no-store e nome ocorrencias-transporte-AAAA-MM-DD.xlsx. Nenhum arquivo é publicado no servidor.

Planilha Ocorrências com código, data de saída, veículo, placa, condutor, passageiros, setor, hora de saída, data/hora de chegada, km inicial/final, distância, itinerário e status. Passageiros ficam em linhas dentro da mesma célula. Campos não informados permanecem vazios. A data de chegada separada preserva viagens que terminam no dia seguinte.

Datas e horas representam os componentes locais de America/Sao_Paulo, sem aplicar um segundo deslocamento ao abrir o Excel. Quilômetros permanecem números. Campos textuais, inclusive conteúdos semelhantes a fórmulas, são gravados como texto literal, sem fórmulas ou links executáveis. A distância vem do banco, não é calculada a partir de entrada manual na planilha.

O arquivo usa grafite/verde do site nos títulos, cabeçalho congelado, filtro nas colunas, quebra de texto e critérios/emissão no topo. Dados extensos são preservados nas células; a altura máxima de uma linha segue o limite do Excel e pode exigir expansão de visualização na planilha. A API também pode gerar uma planilha vazia válida com cabeçalhos.

A consulta lê ocorrências e todos os passageiros associados no mesmo snapshot transacional, sem truncar por paginação nem selecionar apenas os passageiros encontrados pela busca. A capacidade máxima de linhas do formato XLSX é respeitada com mensagem para reduzir o período, sem exportar um subconjunto silenciosamente.

Geração com [ExcelJS](https://github.com/exceljs/exceljs). package-lock.json e override da dependência transitiva uuid mantêm a versão corrigida compatível; instalação auditada sem vulnerabilidades reportadas.

Validação em 30/10/2026: testes de dados, tipos, formatação, textos literais e arquivo vazio aprovados. Integração MySQL isolada confirmou todos os registros filtrados além da página atual, filtros combinados, passageiros completos, pendências e permissões. Chrome confirmou download administrativo, bloqueio quando há filtros não aplicados e ausência da ação para condutor. Exemplos fictícios em backend/test-results/modelo-exportacao.xlsx e exportacao-filtrada.xlsx, ignorados pelo Git. Sem mudança no schema ou nos dados de desenvolvimento.

## Gestão de usuários

A seção Usuários permite pesquisar por nome, e-mail, matrícula e função, filtrar por perfil/status e navegar por páginas de 20 contas. Somente administradores ativos podem consultar a lista e alterar acessos.

- GET /api/usuarios: busca, perfil, status e pagina opcionais.
- PUT /api/usuarios/:id/acesso: perfil (driver/viewer/admin) e status (active/inactive).

Cadastros pendentes passam primeiro pela aprovação existente. Alterações ficam na auditoria. As permissões são consultadas no banco a cada requisição, incluindo sessões já abertas. O administrador não altera o próprio acesso, e o último administrador ativo é protegido dentro da transação. Viagens em andamento e correções aguardando o condutor bloqueiam alterações que interromperiam esse fluxo.

## Correções com duas assinaturas

No detalhe de uma viagem concluída, outro administrador pode propor a correção do veículo, setor, horários, quilômetros, itinerário e passageiros, informando a justificativa e assinando a proposta. O condutor original permanece responsável e precisa estar ativo. Veículo e setor inativos podem permanecer quando já eram os originais; novas seleções precisam estar ativas.

A proposta é imutável depois do envio. Uma ocorrência aceita apenas uma proposta pendente por vez. Enquanto o condutor não concordar e assinar, nenhum dado do registro atual muda. O condutor encontra a proposta em Correções pendentes, confere a comparação entre as versões e assina. O MVP não oferece edição, cancelamento ou rejeição de proposta já assinada; divergências devem ser resolvidas entre as partes antes da confirmação.

A aplicação ocorre em transação: substitui os campos e a assinatura atual do condutor, incrementa a revisão, registra a segunda assinatura e mantém o snapshot anterior completo, incluindo passageiros e assinatura original. Um hash SHA-256 canônico vincula proposta, justificativa, revisão e participantes; revisão/hash divergentes e confirmações repetidas são rejeitados. A assinatura continua sendo de protótipo, sem certificação digital.

- GET /api/ocorrencias/correcoes-pendentes: fila de até 200 propostas; condutor vê somente as próprias.
- GET /api/ocorrencias/:id/correcoes: histórico completo autorizado.
- POST /api/ocorrencias/:id/correcoes: proposta assinada pelo administrador.
- POST /api/ocorrencias/:id/correcoes/:correcaoId/confirmar: assinatura e confirmação pelo condutor original.
- GET /api/ocorrencias/:id/correcoes/:correcaoId/assinatura/:parte: imagem protegida (administrador, condutor ou anterior).

PDF e impressão usam os dados vigentes e incluem justificativas e assinaturas das correções aplicadas. Excel exporta os dados vigentes. O histórico anterior pode ser consultado no detalhe. Não há alteração no schema: a tabela de correções já existe no banco completo original.
