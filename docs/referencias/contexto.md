Desenvolvimento do MVP — Sistema de Ocorrências Diárias de Transporte

1. Contexto do projeto

Desenvolva um sistema web interno para gerenciamento de ocorrências diárias de transporte de uma pequena frota empresarial.

O sistema surgiu a partir de um problema real: atualmente os condutores registram as viagens manualmente em uma folha física. Posteriormente, os dados dessa folha precisam ser transcritos manualmente para uma planilha Excel.

O objetivo do sistema é eliminar essa redigitação, mantendo a possibilidade de gerar e imprimir os registros para preservar o processo físico enquanto a solução é validada.

O sistema deve ser tratado como um MVP funcional e profissional, não como uma demonstração visual.

O foco principal é:

Registrar uma ocorrência uma única vez, armazená-la de forma estruturada e permitir posteriormente sua consulta, impressão e exportação para Excel.

Não implemente funcionalidades fora do escopo do MVP.

⸻

2. Processo atual

A empresa possui atualmente 3 veículos.

O condutor utiliza o veículo para atividades relacionadas ao trabalho, como:

* Visitas a empresas;
* Reportagens;
* Reuniões;
* Fechamento de contratos;
* Deslocamentos relacionados às atividades da empresa.

Durante cada viagem, o condutor registra na folha física:

* Data;
* Condutor;
* Passageiros;
* Horário de saída;
* Horário de chegada;
* Quilometragem inicial;
* Quilometragem final;
* Setor;
* Itinerário.

O condutor é responsável pelo preenchimento.

A assinatura é feita exclusivamente pelo condutor e é obrigatória em cada viagem.

Atualmente, os passageiros são registrados na folha física, mas não são transferidos para a planilha digital.

Depois de aproximadamente 1 a 2 semanas, os registros são transcritos manualmente para Excel.

Esse processo consome aproximadamente 40 minutos por carro por semana, considerando 3 veículos.

⸻

3. Objetivo do MVP

O MVP deve permitir que o condutor registre uma viagem em duas etapas:

Início da viagem

Registrar:

* Veículo;
* Condutor;
* Data;
* Horário de saída;
* Quilometragem inicial;
* Setor;
* Itinerário;
* Passageiros, opcionalmente.

Final da viagem

Registrar:

* Horário de chegada;
* Quilometragem final;
* Assinatura do condutor.

O sistema deve calcular automaticamente:

Quilometragem final - Quilometragem inicial = distância percorrida

Depois da assinatura, a ocorrência deve ser marcada como concluída.

⸻

5. Arquitetura

Organize o projeto de maneira modular e escalável.

Evite colocar toda a aplicação em poucos arquivos gigantes.

Sugestão de estrutura:

![
    
](image-1.png)


⸻


O código da ocorrência deve ser legível, por exemplo:

OC-000001
OC-000002
OC-000003

A distância deve ser calculada pelo sistema.

Nunca permita que o usuário informe manualmente a distância.

Validações:

* Km final não pode ser menor que Km inicial.
* Horário de chegada não pode ser anterior ao horário de saída.
* Ocorrência concluída precisa possuir assinatura.
* Veículo precisa existir e estar ativo.
* Condutor precisa estar ativo.
* Setor precisa existir.

⸻

passengers

Como os passageiros atualmente são registrados na folha física, mas não entram no Excel, eles devem ser opcionais no MVP.

Crie uma estrutura que permita associar passageiros a uma ocorrência sem tornar esse campo obrigatório.

Não transforme passageiros em usuários do sistema obrigatoriamente.

⸻


A assinatura deve estar vinculada à ocorrência.

⸻

7. Segurança


Regras mínimas:

Driver

Pode:

* visualizar seus próprios registros;
* criar ocorrências;
* finalizar suas próprias ocorrências;
* assinar suas próprias ocorrências.

Não pode:

* alterar veículos;
* alterar outros usuários;
* apagar ocorrências;
* acessar configurações administrativas.

Viewer

Pode:

* visualizar ocorrências;
* pesquisar;
* filtrar;
* visualizar documentos.

Não pode editar dados.

Admin

Pode:

* gerenciar veículos;
* gerenciar usuários;
* gerenciar setores;
* visualizar todas as ocorrências;
* corrigir registros quando necessário;
* exportar dados.

Toda operação sensível deve ser protegida também no backend/banco, não apenas escondendo botões no frontend.

⸻

8. Fluxo principal

Login

Tela simples de login.

Campos:

E-mail
Senha

Após autenticação:

Dashboard

⸻

9. Dashboard

Crie um dashboard simples e funcional.

Exibir:

Ocorrências hoje
Em andamento
Concluídas
Veículos ativos

Também mostrar as ocorrências mais recentes.

Exemplo:

OC-000127
SPIN • JBT6C96
João Silva
12/08/2026
13:42 → 15:18
36 km
Concluída

Não criar gráficos complexos no MVP.

⸻

10. Nova ocorrência

Criar uma tela clara chamada:

Nova ocorrência

Campos:

Veículo
Condutor
Data
Horário de saída
Km inicial
Setor
Itinerário
Passageiros

Data e horário devem possuir valores padrão adequados, mas permitir alteração quando necessário.

Para o condutor autenticado, preencher automaticamente o próprio usuário.

O veículo deve ser selecionado a partir dos veículos cadastrados.

Não permitir digitação manual da placa quando o veículo já estiver cadastrado.

⸻

11. Iniciar viagem

Ao clicar:

Iniciar viagem

o sistema deve:

1. Validar os dados.
2. Criar a ocorrência.
3. Gerar o código.
4. Definir status como in_progress.
5. Salvar no banco.
6. Redirecionar para a tela da ocorrência.

Mostrar confirmação:

Viagem iniciada com sucesso.

⸻

12. Finalizar viagem

Na tela de uma ocorrência em andamento:

Mostrar os dados registrados no início.

Adicionar:

Horário de chegada
Km final

Ao clicar em:

Finalizar viagem

validar:

Km final >= Km inicial
Horário de chegada >= horário de saída

Calcular:

distance = final_mileage - initial_mileage

Depois disso, direcionar para a assinatura.

⸻

13. Assinatura

Criar um campo de assinatura utilizando canvas ou biblioteca apropriada.

Interface:

Assine para confirmar a ocorrência
[ ÁREA DE ASSINATURA ]
[ Limpar ] [ Confirmar assinatura ]

A assinatura deve ser vinculada à ocorrência.

Após confirmar:

status = completed

Registrar:

signed_at
user_id

Não permitir finalizar uma ocorrência sem assinatura.

Importante: a assinatura digital no MVP deve ser considerada uma funcionalidade de protótipo. Não assumir que ela substitui juridicamente a assinatura física.

⸻

14. Histórico de ocorrências

Criar uma página:

Ocorrências

Tabela com:

Código
Data
Veículo
Condutor
Saída
Chegada
Distância
Setor
Status

Filtros:

Data inicial
Data final
Veículo
Condutor
Setor
Status

Adicionar pesquisa.

A tabela deve ser responsiva.

Em dispositivos menores, utilizar uma visualização adequada em cards ou tabela horizontalmente rolável.

⸻

15. Visualização de ocorrência

Ao abrir uma ocorrência:

Mostrar todas as informações de forma organizada.

Exemplo:

OC-000127
VEÍCULO
SPIN
JBT6C96
CONDUTOR
João Silva
DATA
12/08/2026
HORÁRIO
13:42 → 15:18
QUILOMETRAGEM
52.381 → 52.417
DISTÂNCIA
36 km
SETOR
Comercial
ITINERÁRIO
RBS → Centro → RBS
PASSAGEIROS
Maria Silva
Pedro Santos
ASSINATURA
[visualização]

Ações:

Gerar PDF
Imprimir

⸻

16. PDF

Criar um documento compatível com o modelo atual da empresa.

Título:

OCORRÊNCIAS DIÁRIAS DE TRANSPORTE

Informações do veículo:

Carro: SPIN
Placa: JBT6C96

Tabela:

Data
Condutor
Passageiros
Saída
Chegada
Km Inicial
Km Final
Setor
Itinerário

Incluir assinatura.

O PDF deve ser limpo e adequado para impressão em papel A4.

Não é necessário copiar exatamente o design da folha física, mas a informação deve ser equivalente.

⸻

17. Exportação para Excel

Criar uma função:

Exportar Excel

O arquivo deve conter as mesmas informações utilizadas na planilha atual:

Data
Condutor
Passageiros
Saída
Chegada
Km Inicial
Km Final
Setor
Itinerário

Permitir exportar:

* todas as ocorrências filtradas;
* ou um período específico.

O objetivo é demonstrar que a planilha atual pode ser alimentada automaticamente pelo sistema.

⸻

18. Gestão de veículos

Página:

Veículos

Permitir ao admin:

* visualizar;
* cadastrar;
* editar;
* ativar/desativar.

Campos:

Marca
Modelo
Placa
Número interno
Status

Os veículos iniciais podem ser cadastrados como dados de demonstração.

Utilize dados fictícios no ambiente de desenvolvimento.

⸻

19. Gestão de usuários

Página administrativa:

Usuários

Mostrar:

Nome
Matrícula
Função
Perfil
Status

Permitir ao admin ativar/desativar usuários.

Não permita que um usuário comum altere o próprio nível de acesso.


⸻

21. UX

Priorize simplicidade.

O condutor deve conseguir iniciar uma ocorrência em poucos passos.

Evite formulários gigantes.

Use:

* labels claros;
* placeholders úteis;
* validação imediata;
* mensagens de erro objetivas;
* estados de loading;
* confirmação de ações;
* feedback após salvar.

Nunca exiba erros técnicos diretamente para o usuário.

Por exemplo, não mostrar:

PostgrestError 23505

Mostrar:

Não foi possível salvar a ocorrência. Tente novamente.

Os erros técnicos devem permanecer disponíveis no console/log para desenvolvimento.

⸻

22. Responsividade

O sistema deve funcionar bem em:

* Desktop;
* Notebook;
* Tablet;
* Celular.

Prioridade de uso:

1. Desktop para administração;
2. Celular/tablet para condutores.

A tela de registro deve ser especialmente otimizada para dispositivos móveis.

⸻

23. Auditoria

Sempre que possível, registrar:

* criação;
* finalização;
* assinatura;
* alteração administrativa.

Nunca apagar uma ocorrência definitivamente no MVP.

Utilize status ou soft delete caso seja necessário remover algo da visualização.

Preserve o histórico.

⸻

24. Dados de demonstração

Criar seed/demo data para facilitar testes.

Criar:

3 veículos fictícios:

SPIN — JBT6C96
VEÍCULO DEMO 02
VEÍCULO DEMO 03

Criar alguns condutores fictícios.

Criar setores:

Comercial
Administrativo
Jornalismo
Financeiro
Operacional

Criar ocorrências em diferentes estados:

Em andamento
Concluída

Não utilizar dados reais da empresa no desenvolvimento.

⸻

25. Validações importantes

Implementar validação no frontend e backend.

Exemplos:

* Km final não pode ser menor que km inicial.
* Campos obrigatórios não podem ficar vazios.
* Condutor precisa estar ativo.
* Veículo precisa estar ativo.
* Não permitir finalizar ocorrência inexistente.
* Não permitir assinatura sem usuário autenticado.
* Não permitir acesso a ocorrências sem autorização.
* Não permitir que driver visualize ocorrências de outros condutores, salvo regra explicitamente definida.
* Não permitir duplicação acidental por múltiplos cliques.

Desabilitar botões durante requisições para evitar duplicidade.

⸻

26. Boas práticas de desenvolvimento

Utilize:


* Componentização;
* Tipagem dos dados;
* Variáveis de ambiente;
* .env.example;
* Tratamento de erros;
* Validação de formulários;
* Funções reutilizáveis;
* Código legível;
* Nomes descritivos;
* Separação de responsabilidades.

Não:

* colocar senhas ou chaves privadas no código;
* colocar service role key no frontend;
* duplicar lógica;
* utilizar dados mockados como substituição permanente do banco;
* criar componentes gigantes;
* criar funcionalidades sem relação com o MVP.

⸻

27. Segurança

Nunca expor:

Chaves API

no frontend.

Usar somente variáveis públicas apropriadas no cliente.

Configurar RLS corretamente.

Não confiar em permissões implementadas somente por elementos visuais.

Validar permissões no banco.

⸻

28. O que NÃO desenvolver

Não implementar neste MVP:

* GPS;
* rastreamento em tempo real;
* mapas;
* reconhecimento de escrita;
* OCR;
* inteligência artificial para interpretar folhas;
* controle de combustível;
* controle de manutenção;
* notificações;
* aplicativo nativo;
* chatbot;
* sistema de RH;
* integração com ERP;
* funcionalidades financeiras;
* analytics avançado.

Essas funcionalidades podem ser consideradas futuramente.

⸻

29. Critério de sucesso do MVP

O MVP será considerado funcional quando for possível executar o fluxo completo:

Login
↓
Selecionar veículo
↓
Criar ocorrência
↓
Registrar saída
↓
Salvar
↓
Retornar posteriormente
↓
Registrar chegada
↓
Registrar km final
↓
Calcular distância
↓
Assinar
↓
Concluir ocorrência
↓
Visualizar histórico
↓
Gerar PDF
↓
Imprimir
↓
Exportar para Excel

Esse fluxo deve funcionar utilizando dados reais do banco Supabase, e não apenas dados simulados no frontend.

⸻

30. Forma de desenvolvimento

Não gere toda a aplicação de uma vez.

Desenvolva em etapas:

Etapa 1

Configuração do projeto e design system.

Etapa 2

Supabase, banco de dados, migrations e RLS.

Etapa 3

Autenticação.

Etapa 4

Cadastro de veículos, usuários e setores.

Etapa 5

Criação e início de ocorrência.

Etapa 6

Finalização e assinatura.

Etapa 7

Histórico e filtros.

Etapa 8

PDF e impressão.

Etapa 9

Exportação Excel.

Etapa 10

Testes, correções, responsividade e refinamento visual.

Após cada etapa, verifique se o sistema continua funcionando antes de avançar.

Não reescreva partes funcionais sem necessidade.

⸻

31. Testes

Crie testes para os principais fluxos.

Testar:

* Login;
* Criação de ocorrência;
* Validação de quilometragem;
* Finalização;
* Assinatura;
* Permissões;
* Filtros;
* PDF;
* Exportação;
* Responsividade.

Também testar cenários inválidos.

Exemplo:

Km inicial: 52.500
Km final: 52.400

Deve impedir a finalização.

⸻

32. Resultado esperado

Ao final, entregar uma aplicação web funcional com:

* Interface profissional;
* Autenticação;
* Controle de acesso;
* Registro de ocorrências;
* Assinatura;
* Histórico;
* Filtros;
* PDF;
* Impressão;
* Exportação Excel;
* Responsividade;
* Dados de demonstração;
* Código organizado;
* README explicando instalação, configuração do Supabase e execução local.

O resultado deve ser adequado para ser apresentado como um protótipo funcional para avaliação interna da empresa.

Priorize primeiro a funcionalidade e a confiabilidade do fluxo principal. Depois refine o visual.

Não invente requisitos que não foram especificados. Quando existir alguma decisão de arquitetura que não esteja definida neste documento, escolha a solução mais simples, segura e sustentável para um MVP.

O projeto será desenvolvido com base nesses principais requisitos. Entao se o PDF que estiver anexo, priorize as informações do PDF, caso esteja pedindo algo diferente o PDF é SEMPRE a referencia.
