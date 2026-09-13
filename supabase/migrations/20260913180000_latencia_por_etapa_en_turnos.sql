-- Desglose de latencia por etapa del pipeline de voz (STT → LLM → validador → TTS).
--
-- Por qué no alcanza `turnos.latencia_ms`: el contrato de `voice/README.md` §3 obliga a
-- que los dos enfoques de voz reporten la misma métrica base (`latencia_ms`, el
-- round-trip) para que el dashboard los compare sin casos especiales, pero permite que
-- el pipeline **además** desglose por etapa. Ese desglose es el argumento técnico de la
-- cascada frente a S2S: en S2S la latencia es una caja negra de un solo número; acá se
-- puede decir qué etapa costó qué.
--
-- Todas nullable a propósito: el canal de texto no tiene etapas de audio y las deja
-- vacías. `latencia_ms` sigue siendo el único campo obligatorio y común a ambos enfoques.
--
-- Idempotente: `add column if not exists` y constraints guardados, igual que la
-- migración de señal de riesgo.

alter table turnos
  add column if not exists latencia_stt_ms        int,
  add column if not exists latencia_llm_ms        int,
  add column if not exists latencia_validador_ms  int,
  add column if not exists latencia_tts_ms        int;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'turnos_latencia_stt_no_negativa') then
    alter table turnos add constraint turnos_latencia_stt_no_negativa
      check (latencia_stt_ms is null or latencia_stt_ms >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'turnos_latencia_llm_no_negativa') then
    alter table turnos add constraint turnos_latencia_llm_no_negativa
      check (latencia_llm_ms is null or latencia_llm_ms >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'turnos_latencia_validador_no_negativa') then
    alter table turnos add constraint turnos_latencia_validador_no_negativa
      check (latencia_validador_ms is null or latencia_validador_ms >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'turnos_latencia_tts_no_negativa') then
    alter table turnos add constraint turnos_latencia_tts_no_negativa
      check (latencia_tts_ms is null or latencia_tts_ms >= 0);
  end if;
end $$;

comment on column turnos.latencia_stt_ms is
  'Solo en canal voz con modo_voz=pipeline. Transcribir el audio de la persona.';
comment on column turnos.latencia_llm_ms is
  'Generar la respuesta, incluyendo el ciclo de herramientas y el reintento correctivo.';
comment on column turnos.latencia_validador_ms is
  'Correr el validador determinista. Es el costo del guardrail que S2S no puede pagar.';
comment on column turnos.latencia_tts_ms is
  'Solo en canal voz con modo_voz=pipeline. Sintetizar el audio del agente.';
