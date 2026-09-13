-- La señal de alerta temprana que abrió cada conversación.
--
-- Por qué vive en `conversaciones` y no en `clientes`: la columna `clientes.riesgo_score`
-- es el score de lote — una foto del cliente. Esto otro es la señal del MOMENTO en que
-- se abrió la conversación, con qué la produjo y por qué escalón se sugirió empezar.
-- Sin esto, el registro que el banco pide como evidencia no puede responder la pregunta
-- "¿por qué el sistema decidió hablarle a esta persona hoy?".
--
-- Es lo que le da al dashboard el cruce que importa: acuerdos cerrados por banda de
-- riesgo, y cuántas conversaciones las abrió el modelo contra cuántas las abrió el
-- calendario salvadoreño.
--
-- Idempotente a propósito: `npm run db:migrate` reejecuta todos los archivos en orden.

alter table conversaciones
  add column if not exists riesgo_score        int,
  add column if not exists riesgo_banda        text,
  add column if not exists riesgo_clase_ssf    text,
  add column if not exists riesgo_fuente       text,
  -- Las tres vistas se guardan por separado a propósito: la señal final es el máximo
  -- de las tres, y sin el desglose no se puede decir cuál la disparó.
  add column if not exists riesgo_componente_modelo_vivo int,
  add column if not exists riesgo_componente_registro    int,
  add column if not exists riesgo_componente_reglas      int,
  add column if not exists escalon_sugerido    int,
  add column if not exists riesgo_factores     jsonb,
  -- Por qué se abrió: el motivo que devolvió `diagnosticar`. Es la pregunta que el
  -- dashboard tiene que poder contestar por conversación, y hasta ahora no se guardaba.
  add column if not exists motivo_contacto     text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'conversaciones_riesgo_score_rango') then
    alter table conversaciones add constraint conversaciones_riesgo_score_rango
      check (riesgo_score is null or riesgo_score between 0 and 100);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'conversaciones_riesgo_banda_valida') then
    alter table conversaciones add constraint conversaciones_riesgo_banda_valida
      check (riesgo_banda is null or riesgo_banda in ('LOW', 'MODERATE', 'MODERATE_HIGH', 'CRITICAL'));
  end if;

  -- Clases de días de atraso de la NCB-022, tal como las predice ml/. Vocabulario
  -- regulatorio: vive acá y en la consola interna, nunca en la conversación.
  if not exists (select 1 from pg_constraint where conname = 'conversaciones_riesgo_clase_ssf_valida') then
    alter table conversaciones add constraint conversaciones_riesgo_clase_ssf_valida
      check (riesgo_clase_ssf is null or riesgo_clase_ssf in ('Healthy', 'A1', 'A2', 'B', 'C', 'D_E'));
  end if;

  -- `modelo_vivo` = el microservicio respondió. `score_registrado` = estaba caído y se
  -- usó el score de lote de la fila. `reglas` = ni uno ni otro, solo señales locales.
  if not exists (select 1 from pg_constraint where conname = 'conversaciones_riesgo_fuente_valida') then
    alter table conversaciones add constraint conversaciones_riesgo_fuente_valida
      check (riesgo_fuente is null or riesgo_fuente in ('modelo_vivo', 'score_registrado', 'reglas'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'conversaciones_escalon_sugerido_rango') then
    alter table conversaciones add constraint conversaciones_escalon_sugerido_rango
      check (escalon_sugerido is null or escalon_sugerido between 1 and 8);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'conversaciones_motivo_contacto_valido') then
    alter table conversaciones add constraint conversaciones_motivo_contacto_valido
      check (motivo_contacto is null or motivo_contacto in
        ('desalineacion_quincena', 'desalineacion_remesa', 'atraso', 'riesgo_alto'));
  end if;
end $$;

comment on column conversaciones.riesgo_fuente is
  'Cuál de las tres vistas produjo el score final: modelo_vivo | score_registrado | reglas.';
comment on column conversaciones.motivo_contacto is
  'Por qué el sistema abrió esta conversación. NULL cuando la abrió la persona.';
comment on column conversaciones.riesgo_factores is
  'Factores que explican la señal, con su origen (modelo o reglas). Interno: nunca se le muestra al cliente.';

create index if not exists conversaciones_riesgo_banda_idx on conversaciones (riesgo_banda);
create index if not exists conversaciones_motivo_contacto_idx on conversaciones (motivo_contacto);
