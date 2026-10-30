-- Executar somente em desenvolvimento, após banco.sql.
-- Não insere contas válidas para login. Tudo é revertido, inclusive no erro.
USE controle_frotas;
DELIMITER //
CREATE PROCEDURE verificar_regras_frotas()
BEGIN
  DECLARE v_admin INT UNSIGNED;
  DECLARE v_driver INT UNSIGNED;
  DECLARE v_driver2 INT UNSIGNED;
  DECLARE v_veiculo INT UNSIGNED;
  DECLARE v_veiculo2 INT UNSIGNED;
  DECLARE v_setor INT UNSIGNED;
  DECLARE v_ocorrencia INT UNSIGNED;
  DECLARE v_correcao INT UNSIGNED;
  DECLARE v_bloqueou BOOLEAN DEFAULT FALSE;
  DECLARE v_distancia DECIMAL(10,1);
  DECLARE v_sufixo VARCHAR(36);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  START TRANSACTION;
  SET v_sufixo = UUID();
  INSERT INTO usuarios (nome, email, senha_hash, perfil, status)
    VALUES ('Admin teste SQL', CONCAT(v_sufixo, '-admin@example.invalid'), 'HASH_INVALIDO_APENAS_TESTE_ROLLBACK', 'admin', 'active');
  SET v_admin = LAST_INSERT_ID();
  INSERT INTO usuarios (nome, email, senha_hash, status)
    VALUES ('Condutor teste SQL', CONCAT(v_sufixo, '-driver@example.invalid'), 'HASH_INVALIDO_APENAS_TESTE_ROLLBACK', 'active');
  SET v_driver = LAST_INSERT_ID();
  INSERT INTO usuarios (nome, email, senha_hash, status)
    VALUES ('Condutor 2 teste SQL', CONCAT(v_sufixo, '-driver2@example.invalid'), 'HASH_INVALIDO_APENAS_TESTE_ROLLBACK', 'active');
  SET v_driver2 = LAST_INSERT_ID();
  INSERT INTO veiculos (marca, modelo, placa) VALUES ('Teste', 'Teste SQL 1', LEFT(REPLACE(v_sufixo, '-', ''), 7));
  SET v_veiculo = LAST_INSERT_ID();
  INSERT INTO veiculos (marca, modelo, placa) VALUES ('Teste', 'Teste SQL 2', RIGHT(REPLACE(v_sufixo, '-', ''), 7));
  SET v_veiculo2 = LAST_INSERT_ID();
  INSERT INTO setores (nome) VALUES (CONCAT('Teste SQL ', v_sufixo));
  SET v_setor = LAST_INSERT_ID();
  INSERT INTO ocorrencias (veiculo_id, condutor_id, setor_id, criado_por, saida_em, km_inicial, itinerario)
    VALUES (v_veiculo, v_driver, v_setor, v_driver, '2026-10-29 02:00:00', 100, 'Teste de meia-noite');
  SET v_ocorrencia = LAST_INSERT_ID();

  -- Mesmo veículo, outro condutor: deve falhar por UNIQUE.
  SET v_bloqueou = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 1062 SET v_bloqueou = TRUE;
    INSERT INTO ocorrencias (veiculo_id, condutor_id, setor_id, criado_por, saida_em, km_inicial, itinerario)
      VALUES (v_veiculo, v_driver2, v_setor, v_driver2, '2026-10-29 02:00:00', 100, 'Duplicidade veículo');
  END;
  IF NOT v_bloqueou THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALHA: veículo duplicado permitido'; END IF;

  -- Outro veículo, mesmo condutor: também deve falhar.
  SET v_bloqueou = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 1062 SET v_bloqueou = TRUE;
    INSERT INTO ocorrencias (veiculo_id, condutor_id, setor_id, criado_por, saida_em, km_inicial, itinerario)
      VALUES (v_veiculo2, v_driver, v_setor, v_driver, '2026-10-29 02:00:00', 100, 'Duplicidade condutor');
  END;
  IF NOT v_bloqueou THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALHA: condutor duplicado permitido'; END IF;

  SET v_bloqueou = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 3819 SET v_bloqueou = TRUE;
    UPDATE ocorrencias SET chegada_em = '2026-10-29 04:00:00', km_final = 99 WHERE id = v_ocorrencia;
  END;
  IF NOT v_bloqueou THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALHA: km final inferior permitido'; END IF;

  SET v_bloqueou = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 3819 SET v_bloqueou = TRUE;
    UPDATE ocorrencias SET chegada_em = '2026-10-29 01:00:00', km_final = 120 WHERE id = v_ocorrencia;
  END;
  IF NOT v_bloqueou THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALHA: chegada anterior permitida'; END IF;

  UPDATE ocorrencias SET chegada_em = '2026-10-29 04:00:00', km_final = 120 WHERE id = v_ocorrencia;
  SET v_bloqueou = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 3819 SET v_bloqueou = TRUE;
    UPDATE ocorrencias SET status = 'completed' WHERE id = v_ocorrencia;
  END;
  IF NOT v_bloqueou THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALHA: conclusão sem assinatura permitida'; END IF;

  -- BLOB de teste, não é PNG válido: formato da imagem é responsabilidade da API.
  UPDATE ocorrencias SET status = 'completed', assinatura_condutor = X'01',
    assinado_por = v_driver, assinado_em = '2026-10-29 04:01:00' WHERE id = v_ocorrencia;
  SELECT distancia_km INTO v_distancia FROM ocorrencias WHERE id = v_ocorrencia;
  IF v_distancia <> 20 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALHA: distância incorreta'; END IF;

  -- A conclusão libera veículo e condutor para a próxima viagem.
  INSERT INTO ocorrencias (veiculo_id, condutor_id, setor_id, criado_por, saida_em, km_inicial, itinerario)
    VALUES (v_veiculo, v_driver, v_setor, v_driver, '2026-10-29 05:00:00', 120, 'Próxima viagem');

  INSERT INTO correcoes_ocorrencia (ocorrencia_id, revisao_base, administrador_id, condutor_id,
    justificativa, dados_anteriores, dados_propostos, conteudo_sha256)
    VALUES (v_ocorrencia, 1, v_admin, v_driver, 'Ajuste teste SQL',
      JSON_OBJECT('km_final', 120), JSON_OBJECT('km_final', 121), SHA2('teste', 256));
  SET v_correcao = LAST_INSERT_ID();
  SET v_bloqueou = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 3819 SET v_bloqueou = TRUE;
    UPDATE correcoes_ocorrencia SET status = 'applied', aplicado_em = '2026-10-29 06:00:00'
      WHERE id = v_correcao;
  END;
  IF NOT v_bloqueou THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALHA: correção sem assinaturas permitida'; END IF;

  UPDATE correcoes_ocorrencia SET assinatura_administrador = X'02', administrador_assinou_em = '2026-10-29 06:00:00'
    WHERE id = v_correcao;
  SET v_bloqueou = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 3819 SET v_bloqueou = TRUE;
    UPDATE correcoes_ocorrencia SET status = 'applied', aplicado_em = '2026-10-29 06:01:00'
      WHERE id = v_correcao;
  END;
  IF NOT v_bloqueou THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALHA: correção com só uma assinatura permitida'; END IF;

  -- Verifica apenas o CHECK de duas assinaturas; a aplicação transacional será testada na API.
  UPDATE correcoes_ocorrencia SET assinatura_condutor = X'03', condutor_assinou_em = '2026-10-29 06:02:00',
    status = 'applied', aplicado_em = '2026-10-29 06:02:00' WHERE id = v_correcao;
  ROLLBACK;
  SELECT 'OK: regras estruturais verificadas; dados de teste revertidos' AS resultado;
END//
DELIMITER ;
CALL verificar_regras_frotas();
DROP PROCEDURE verificar_regras_frotas;
