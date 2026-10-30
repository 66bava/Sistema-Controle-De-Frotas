-- BANCO COMPLETO: CONTROLE DE FROTAS
-- Executar este arquivo no MySQL Workbench em banco de desenvolvimento novo.
-- Inclui estrutura, relacionamentos, restrições, dados fictícios e consultas de conferência.
-- Os testes de regras ficam separados e não fazem parte da instalação.

-- 1. ESTRUTURA DO BANCO

-- MySQL Server 8.0.16+; executar em uma conexão de desenvolvimento no Workbench.
-- Criação inicial. Não contém DROP, TRUNCATE nem dados reais.
-- Se as tabelas já existirem, interromper e usar uma migration incremental.
CREATE DATABASE IF NOT EXISTS controle_frotas
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE controle_frotas;
SET time_zone = '+00:00';

CREATE TABLE usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  matricula VARCHAR(50) NULL,
  funcao VARCHAR(100) NULL,
  perfil ENUM('driver', 'viewer', 'admin') NOT NULL DEFAULT 'driver',
  status ENUM('pending', 'active', 'inactive') NOT NULL DEFAULT 'pending',
  aprovado_por INT UNSIGNED NULL,
  aprovado_em DATETIME(3) NULL,
  criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_usuarios_email (email),
  UNIQUE KEY uq_usuarios_matricula (matricula),
  CONSTRAINT fk_usuarios_aprovador FOREIGN KEY (aprovado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT ck_usuarios_nome CHECK (CHAR_LENGTH(TRIM(nome)) > 0),
  CONSTRAINT ck_usuarios_email CHECK (CHAR_LENGTH(TRIM(email)) > 0),
  CONSTRAINT ck_usuarios_senha CHECK (CHAR_LENGTH(senha_hash) > 0),
  CONSTRAINT ck_usuarios_aprovacao CHECK (
    (aprovado_por IS NULL AND aprovado_em IS NULL) OR
    (aprovado_por IS NOT NULL AND aprovado_em IS NOT NULL)
  )
) ENGINE=InnoDB;

CREATE TABLE veiculos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  marca VARCHAR(80) NOT NULL,
  modelo VARCHAR(100) NOT NULL,
  placa CHAR(7) NOT NULL,
  numero_interno VARCHAR(50) NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  excluido_em DATETIME(3) NULL,
  criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_veiculos_placa (placa),
  UNIQUE KEY uq_veiculos_numero (numero_interno),
  CONSTRAINT ck_veiculos_marca CHECK (CHAR_LENGTH(TRIM(marca)) > 0),
  CONSTRAINT ck_veiculos_modelo CHECK (CHAR_LENGTH(TRIM(modelo)) > 0),
  CONSTRAINT ck_veiculos_placa CHECK (CHAR_LENGTH(TRIM(placa)) = 7),
  CONSTRAINT ck_veiculos_ativo CHECK (ativo IN (0, 1)),
  CONSTRAINT ck_veiculos_excluido CHECK (excluido_em IS NULL OR ativo = 0)
) ENGINE=InnoDB;

CREATE TABLE setores (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_setores_nome (nome),
  CONSTRAINT ck_setores_nome CHECK (CHAR_LENGTH(TRIM(nome)) > 0),
  CONSTRAINT ck_setores_ativo CHECK (ativo IN (0, 1))
) ENGINE=InnoDB;

CREATE TABLE ocorrencias (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  veiculo_id INT UNSIGNED NOT NULL,
  condutor_id INT UNSIGNED NOT NULL,
  setor_id INT UNSIGNED NOT NULL,
  criado_por INT UNSIGNED NOT NULL,
  saida_em DATETIME(3) NOT NULL COMMENT 'Instante UTC; converter na API',
  chegada_em DATETIME(3) NULL COMMENT 'Inclui a data; admite chegada no dia seguinte',
  km_inicial DECIMAL(10,1) NOT NULL,
  km_final DECIMAL(10,1) NULL,
  distancia_km DECIMAL(10,1) GENERATED ALWAYS AS (km_final - km_inicial) STORED,
  itinerario VARCHAR(2000) NOT NULL,
  status ENUM('in_progress', 'completed') NOT NULL DEFAULT 'in_progress',
  assinatura_condutor MEDIUMBLOB NULL COMMENT 'PNG validado e limitado pela API',
  assinado_por INT UNSIGNED NULL,
  assinado_em DATETIME(3) NULL,
  revisao INT UNSIGNED NOT NULL DEFAULT 1,
  criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  -- NULL para viagens concluídas: o índice UNIQUE admite várias linhas NULL.
  veiculo_em_viagem INT UNSIGNED GENERATED ALWAYS AS
    (CASE WHEN status = 'in_progress' THEN veiculo_id ELSE NULL END) VIRTUAL,
  condutor_em_viagem INT UNSIGNED GENERATED ALWAYS AS
    (CASE WHEN status = 'in_progress' THEN condutor_id ELSE NULL END) VIRTUAL,
  UNIQUE KEY uq_ocorrencias_veiculo_em_viagem (veiculo_em_viagem),
  UNIQUE KEY uq_ocorrencias_condutor_em_viagem (condutor_em_viagem),
  KEY idx_ocorrencias_saida (saida_em),
  KEY idx_ocorrencias_condutor_saida (condutor_id, saida_em),
  KEY idx_ocorrencias_veiculo_saida (veiculo_id, saida_em),
  KEY idx_ocorrencias_setor_saida (setor_id, saida_em),
  CONSTRAINT fk_ocorrencias_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ocorrencias_condutor FOREIGN KEY (condutor_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ocorrencias_setor FOREIGN KEY (setor_id) REFERENCES setores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ocorrencias_criador FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ocorrencias_assinante FOREIGN KEY (assinado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT ck_ocorrencias_km CHECK (km_inicial >= 0 AND (km_final IS NULL OR km_final >= km_inicial)),
  CONSTRAINT ck_ocorrencias_horario CHECK (chegada_em IS NULL OR chegada_em >= saida_em),
  CONSTRAINT ck_ocorrencias_chegada CHECK (
    (chegada_em IS NULL AND km_final IS NULL) OR
    (chegada_em IS NOT NULL AND km_final IS NOT NULL)
  ),
  CONSTRAINT ck_ocorrencias_itinerario CHECK (CHAR_LENGTH(TRIM(itinerario)) > 0),
  CONSTRAINT ck_ocorrencias_revisao CHECK (revisao >= 1),
  CONSTRAINT ck_ocorrencias_conclusao CHECK (
    (status = 'in_progress' AND assinatura_condutor IS NULL AND assinado_por IS NULL AND assinado_em IS NULL) OR
    (status = 'completed' AND chegada_em IS NOT NULL AND km_final IS NOT NULL
      AND assinatura_condutor IS NOT NULL AND OCTET_LENGTH(assinatura_condutor) > 0
      AND assinado_por IS NOT NULL AND assinado_por = condutor_id AND assinado_em IS NOT NULL)
  )
) ENGINE=InnoDB;

-- O código OC-000001 será formatado pela API a partir do id, sem cortar IDs > 999999.
CREATE TABLE passageiros (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ocorrencia_id INT UNSIGNED NOT NULL,
  nome VARCHAR(150) NOT NULL,
  CONSTRAINT fk_passageiros_ocorrencia FOREIGN KEY (ocorrencia_id) REFERENCES ocorrencias(id) ON DELETE RESTRICT,
  CONSTRAINT ck_passageiros_nome CHECK (CHAR_LENGTH(TRIM(nome)) > 0)
) ENGINE=InnoDB;

CREATE TABLE correcoes_ocorrencia (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ocorrencia_id INT UNSIGNED NOT NULL,
  revisao_base INT UNSIGNED NOT NULL,
  administrador_id INT UNSIGNED NOT NULL,
  condutor_id INT UNSIGNED NOT NULL COMMENT 'Condutor da ocorrência na revisão original',
  justificativa VARCHAR(2000) NOT NULL,
  dados_anteriores JSON NOT NULL COMMENT 'Snapshot completo, incluindo passageiros e assinatura anterior em base64',
  dados_propostos JSON NOT NULL COMMENT 'Snapshot dos campos corrigidos; validado na API',
  conteudo_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
    COMMENT 'Hash canônico da proposta e justificativa assinadas; calculado pela API',
  assinatura_administrador MEDIUMBLOB NULL,
  administrador_assinou_em DATETIME(3) NULL,
  assinatura_condutor MEDIUMBLOB NULL,
  condutor_assinou_em DATETIME(3) NULL,
  status ENUM('pending', 'applied') NOT NULL DEFAULT 'pending',
  aplicado_em DATETIME(3) NULL,
  criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ocorrencia_pendente INT UNSIGNED GENERATED ALWAYS AS
    (CASE WHEN status = 'pending' THEN ocorrencia_id ELSE NULL END) VIRTUAL,
  UNIQUE KEY uq_correcoes_pendente (ocorrencia_pendente),
  KEY idx_correcoes_ocorrencia_revisao (ocorrencia_id, revisao_base),
  CONSTRAINT fk_correcoes_ocorrencia FOREIGN KEY (ocorrencia_id) REFERENCES ocorrencias(id) ON DELETE RESTRICT,
  CONSTRAINT fk_correcoes_administrador FOREIGN KEY (administrador_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_correcoes_condutor FOREIGN KEY (condutor_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT ck_correcoes_justificativa CHECK (CHAR_LENGTH(TRIM(justificativa)) > 0),
  CONSTRAINT ck_correcoes_partes CHECK (administrador_id <> condutor_id),
  CONSTRAINT ck_correcoes_revisao CHECK (revisao_base >= 1),
  CONSTRAINT ck_correcoes_snapshots CHECK (
    JSON_TYPE(dados_anteriores) = 'OBJECT' AND JSON_TYPE(dados_propostos) = 'OBJECT'
  ),
  CONSTRAINT ck_correcoes_hash CHECK (CHAR_LENGTH(conteudo_sha256) = 64),
  CONSTRAINT ck_correcoes_assinatura_admin CHECK (
    (assinatura_administrador IS NULL AND administrador_assinou_em IS NULL) OR
    (assinatura_administrador IS NOT NULL AND OCTET_LENGTH(assinatura_administrador) > 0 AND administrador_assinou_em IS NOT NULL)
  ),
  CONSTRAINT ck_correcoes_assinatura_condutor CHECK (
    (assinatura_condutor IS NULL AND condutor_assinou_em IS NULL) OR
    (assinatura_condutor IS NOT NULL AND OCTET_LENGTH(assinatura_condutor) > 0 AND condutor_assinou_em IS NOT NULL)
  ),
  CONSTRAINT ck_correcoes_aplicacao CHECK (
    (status = 'pending' AND aplicado_em IS NULL) OR
    (status = 'applied' AND aplicado_em IS NOT NULL
      AND assinatura_administrador IS NOT NULL AND administrador_assinou_em IS NOT NULL
      AND assinatura_condutor IS NOT NULL AND condutor_assinou_em IS NOT NULL)
  )
) ENGINE=InnoDB;

CREATE TABLE auditoria (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  ocorrencia_id INT UNSIGNED NULL,
  correcao_id INT UNSIGNED NULL,
  acao VARCHAR(80) NOT NULL,
  entidade VARCHAR(80) NOT NULL,
  entidade_id INT UNSIGNED NOT NULL,
  detalhes JSON NULL,
  criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_auditoria_ocorrencia (ocorrencia_id, criado_em),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_auditoria_ocorrencia FOREIGN KEY (ocorrencia_id) REFERENCES ocorrencias(id) ON DELETE RESTRICT,
  CONSTRAINT fk_auditoria_correcao FOREIGN KEY (correcao_id) REFERENCES correcoes_ocorrencia(id) ON DELETE RESTRICT,
  CONSTRAINT ck_auditoria_acao CHECK (CHAR_LENGTH(TRIM(acao)) > 0),
  CONSTRAINT ck_auditoria_entidade CHECK (CHAR_LENGTH(TRIM(entidade)) > 0)
) ENGINE=InnoDB;

-- 2. DADOS INICIAIS FICTÍCIOS

-- Dados fictícios de desenvolvimento; não cria contas nem senhas compartilhadas.
USE controle_frotas;
START TRANSACTION;
INSERT INTO setores (nome) VALUES
  ('Comercial'), ('Administrativo'), ('Jornalismo'), ('Financeiro'), ('Operacional')
ON DUPLICATE KEY UPDATE nome = setores.nome;
INSERT INTO veiculos (marca, modelo, placa, numero_interno) VALUES
  ('Chevrolet', 'Spin Demo', 'DEM1A01', 'DEMO-01'),
  ('Fiat', 'Argo Demo', 'DEM1A02', 'DEMO-02'),
  ('Volkswagen', 'Polo Demo', 'DEM1A03', 'DEMO-03')
ON DUPLICATE KEY UPDATE placa = veiculos.placa;
COMMIT;
-- Condutores e ocorrências demonstrativas serão criados pela API autenticada,
-- com hash real de senha e assinatura de teste, na etapa correspondente.

-- 3. CONFERÊNCIA DA INSTALAÇÃO

USE controle_frotas;
SELECT VERSION() AS versao_mysql;
SHOW TABLES;
SHOW CREATE TABLE ocorrencias;
SHOW CREATE TABLE correcoes_ocorrencia;
SHOW INDEX FROM ocorrencias;
SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, CONSTRAINT_TYPE;
SELECT id, marca, modelo, placa, ativo FROM veiculos ORDER BY id;
SELECT id, nome, ativo FROM setores ORDER BY id;
