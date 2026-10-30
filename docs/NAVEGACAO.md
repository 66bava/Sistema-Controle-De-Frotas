# Mapa do código

Use este arquivo para encontrar onde alterar cada função. Os links abrem os arquivos diretamente no editor.

## Pontos de entrada

| Área             | Arquivos                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Servidor         | [server.js](../backend/server.js) inicia; [app.js](../backend/app.js) conecta rotas, middlewares e arquivos estáticos |
| Login e cadastro | [INDEX.HTML](../frontend/INDEX.HTML), [script.js](../frontend/script.js)                                              |
| Área interna     | [painel.html](../frontend/painel.html), [painel.js](../frontend/painel.js)                                            |
| Viagens          | [ocorrencias.html](../frontend/ocorrencias.html), [ocorrencias.js](../frontend/ocorrencias.js)                        |
| Menu lateral     | [navegacao.js](../frontend/navegacao.js)                                                                              |
| Estilos          | [styles.css](../frontend/styles.css); cores em [variables.css](../frontend/variables.css)                             |
| Banco            | [banco.sql](../sql/banco.sql), [modelo](../sql/MODELO.md), [conexão](../backend/database/conexao.js)                  |

## Por funcionalidade

| Funcionalidade              | Interface                                                                                            | Entrada da API                                                                                                             | Regra principal                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Cadastro, login e aprovação | [script.js](../frontend/script.js), [painel.js](../frontend/painel.js)                               | [authRoutes](../backend/routes/authRoutes.js), [authController](../backend/controllers/authController.js)                  | [authService](../backend/services/authService.js)                                                                         |
| Autenticação e perfis       | [api.js](../frontend/api.js)                                                                         | [authMiddleware](../backend/middlewares/authMiddleware.js)                                                                 | [tokenService](../backend/services/tokenService.js), [senhaService](../backend/services/senhaService.js)                  |
| Primeiro administrador      | Terminal: [criar-admin.js](../backend/scripts/criar-admin.js)                                        | Comando local, sem rota pública                                                                                            | [primeiroAdminService](../backend/services/primeiroAdminService.js)                                                       |
| Veículos e setores          | [cadastros.js](../frontend/cadastros.js)                                                             | [cadastrosRoutes](../backend/routes/cadastrosRoutes.js), [controller](../backend/controllers/cadastrosController.js)       | [cadastrosService](../backend/services/cadastrosService.js)                                                               |
| Iniciar viagem              | [ocorrencias.js](../frontend/ocorrencias.js)                                                         | [ocorrenciasRoutes](../backend/routes/ocorrenciasRoutes.js), [controller](../backend/controllers/ocorrenciasController.js) | [ocorrenciasService](../backend/services/ocorrenciasService.js)                                                           |
| Histórico e filtros         | [historico.js](../frontend/historico.js)                                                             | [ocorrenciasController](../backend/controllers/ocorrenciasController.js)                                                   | [filtrosHistorico](../backend/utils/filtrosHistorico.js), [ocorrenciasService](../backend/services/ocorrenciasService.js) |
| Chegada e assinatura        | [finalizacao.js](../frontend/finalizacao.js), [assinaturaCanvas.js](../frontend/assinaturaCanvas.js) | [ocorrenciasController](../backend/controllers/ocorrenciasController.js)                                                   | [finalizacaoService](../backend/services/finalizacaoService.js), [validação](../backend/utils/validacaoFinalizacao.js)    |
| PDF                         | [documentos.js](../frontend/documentos.js)                                                           | [documentosController](../backend/controllers/documentosController.js)                                                     | [pdfService](../backend/services/pdfService.js), [modelo comum](../backend/services/documentoModel.js)                    |
| Impressão                   | [documento.css](../frontend/documento.css), [impressao.js](../frontend/impressao.js)                 | [documentosController](../backend/controllers/documentosController.js)                                                     | [impressaoService](../backend/services/impressaoService.js)                                                               |
| Excel                       | [exportacaoExcel.js](../frontend/exportacaoExcel.js), [historico.js](../frontend/historico.js)       | [excelController](../backend/controllers/excelController.js)                                                               | [excelService](../backend/services/excelService.js), [consulta](../backend/services/ocorrenciasService.js)                |
| Erros e saúde               | [api.js](../frontend/api.js)                                                                         | [errosMiddleware](../backend/middlewares/errosMiddleware.js), [saudeRoutes](../backend/routes/saudeRoutes.js)              | [ErroHttp](../backend/utils/erroHttp.js)                                                                                  |

## Onde colocar cada alteração

- HTML: estrutura e campos da tela.
- CSS: aparência, responsividade e impressão.
- JavaScript do frontend: interação e consumo da API.
- routes: endereços e permissões dos endpoints.
- controllers: entrada/saída HTTP e chamada da regra.
- services: regra de negócio e operações no banco.
- utils: validação e funções reutilizáveis.
- tests: verificação de comportamento e permissões.

Exemplo: para alterar a conclusão de uma viagem, comece em [finalizacao.js](../frontend/finalizacao.js), siga para [ocorrenciasController.js](../backend/controllers/ocorrenciasController.js) e depois [finalizacaoService.js](../backend/services/finalizacaoService.js). As regras de formato estão em [validacaoFinalizacao.js](../backend/utils/validacaoFinalizacao.js).

## Testes

- [Integração completa e navegador](../backend/tests/integration.test.js).
- [Autenticação](../backend/tests/auth.test.js).
- [Cadastros](../backend/tests/cadastros.test.js).
- [Saída de viagem](../backend/tests/ocorrencias.test.js).
- [Finalização](../backend/tests/finalizacao.test.js).
- [Histórico](../backend/tests/historico.test.js).
- [PDF e impressão](../backend/tests/documentos.test.js).
- [Excel](../backend/tests/excel.test.js).
- [Rotina do MySQL temporário](../backend/scripts/testar-isolado.ps1).
- [Regras SQL](../sql/testes/regras.sql).

## O que é gerado

backend/node_modules contém as dependências instaladas. backend/test-results contém somente capturas e documentos fictícios gerados pelos testes. Esses diretórios ficam fora do Git e ocultos no explorador; seus conteúdos não são o código-fonte das funcionalidades.

## Dashboard

[Interface](../frontend/dashboard.js) → [rota](../backend/routes/dashboardRoutes.js) → [controller](../backend/controllers/dashboardController.js) → [consulta MySQL](../backend/services/dashboardService.js).

## Gestão de usuários e correções

- Usuários: [interface](../frontend/usuarios.js), [rotas](../backend/routes/usuariosRoutes.js), [controller](../backend/controllers/usuariosController.js), [regras](../backend/services/usuariosService.js), [validação](../backend/utils/validacaoUsuarios.js).
- Correções: [detalhe e assinatura](../frontend/correcoes.js), [fila](../frontend/correcoesPendentes.js), [rotas das ocorrências](../backend/routes/ocorrenciasRoutes.js), [controller](../backend/controllers/correcoesController.js), [transações e snapshots](../backend/services/correcoesService.js), [validação](../backend/utils/validacaoCorrecao.js).
- [Roteiro da apresentação](DEMONSTRACAO.md).
