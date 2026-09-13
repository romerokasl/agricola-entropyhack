-- Esquema del agente conversacional de cobranza preventiva.
--
-- Cuatro tablas: clientes, conversaciones, turnos, acuerdos.
-- `turnos` es la transcripción y `acuerdos` el resultado registrado — las dos
-- evidencias que el banco pide textualmente.
--
-- Nombres de dominio en español (decisión del equipo). El UML.md de la raíz describe
-- el dominio pre-pivote y NO es el esquema vigente del agente.

create table clientes (
  id                       uuid primary key default gen_random_uuid(),
  slug                     text not null unique,
  nombre                   text not null,
  edad                     int,
  distrito                 text not null,
  segmento                 text not null,

  -- Cuándo entra la plata. Es lo que permite detectar la desalineación de calendario.
  tipo_ingreso             text not null check (tipo_ingreso in ('quincenal', 'mensual', 'irregular')),
  dia_ingreso_1            int  not null check (dia_ingreso_1 between 1 and 31),
  dia_ingreso_2            int check (dia_ingreso_2 between 1 and 31),
  dia_remesa               int check (dia_remesa between 1 and 31),

  -- La obligación de la que se va a hablar.
  producto                 text not null,
  cuota                    numeric(12, 2) not null check (cuota > 0),
  saldo                    numeric(12, 2) not null check (saldo >= 0),
  dia_pago                 int not null check (dia_pago between 1 and 31),
  dias_atraso              int not null default 0 check (dias_atraso >= 0),
  tiene_debito_automatico  boolean not null default false,

  -- Salida del scorer (ml/). Interno: nunca se le muestra al cliente.
  riesgo_score             int check (riesgo_score between 0 and 100),
  riesgo_banda             text check (riesgo_banda in ('LOW', 'MODERATE', 'MODERATE_HIGH', 'CRITICAL')),

  creado_en                timestamptz not null default now()
);

comment on column clientes.riesgo_banda is
  'Interno. Decide a quién contactar; su texto nunca llega al cliente.';

create table conversaciones (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references clientes (id) on delete cascade,

  canal        text not null check (canal in ('texto', 'voz')),
  -- Solo aplica cuando canal = 'voz'. Permite comparar los dos enfoques de voz
  -- sin confundir "conversación de texto" con "dato faltante".
  modo_voz     text check (modo_voz in ('pipeline', 's2s')),

  apertura     text not null check (apertura in ('agente', 'cliente')),
  estado       text not null default 'abierta'
                 check (estado in ('abierta', 'cerrada_con_acuerdo', 'cerrada_sin_acuerdo', 'escalada_humano')),

  iniciada_en  timestamptz not null default now(),
  cerrada_en   timestamptz,

  constraint modo_voz_solo_en_canal_voz check (
    (canal = 'texto' and modo_voz is null) or
    (canal = 'voz'   and modo_voz is not null)
  )
);

create index conversaciones_cliente_idx on conversaciones (cliente_id);

create table turnos (
  id                uuid primary key default gen_random_uuid(),
  conversacion_id   uuid not null references conversaciones (id) on delete cascade,
  indice            int  not null check (indice >= 0),

  rol               text not null check (rol in ('agente', 'cliente', 'sistema')),
  texto             text not null,
  creado_en         timestamptz not null default now(),

  -- Métricas por turno. Alimentan el dashboard (p50/p95, costo en tokens,
  -- tasa de intervención del validador).
  latencia_ms       int check (latencia_ms >= 0),
  tokens_in         int check (tokens_in >= 0),
  tokens_out        int check (tokens_out >= 0),
  validador_ok      boolean,
  validador_motivo  text,
  modelo_version    text,

  unique (conversacion_id, indice)
);

create index turnos_conversacion_idx on turnos (conversacion_id, indice);

create table acuerdos (
  id                 uuid primary key default gen_random_uuid(),
  conversacion_id    uuid not null unique references conversaciones (id) on delete cascade,

  -- Escalón de la escalera de opciones (1-8). La fuente autoritativa de la escalera
  -- es docs/contexto/01-reglas-del-agente.md §2, implementada en lib/agent/ladder.ts.
  escalon            int check (escalon between 1 and 8),
  tipo               text,
  monto              numeric(12, 2) check (monto >= 0),
  fecha_acordada     date,

  motivo_no_acuerdo  text,
  creado_en          timestamptz not null default now(),

  -- O hubo acuerdo (con escalón y tipo), o hay un motivo de por qué no. Nunca ambos,
  -- nunca ninguno: "una conversación amable que no cierra en nada es una conversación
  -- fallida", y aun así tiene que quedar registrada.
  constraint acuerdo_o_motivo check (
    (escalon is not null and tipo is not null and motivo_no_acuerdo is null) or
    (escalon is null     and tipo is null     and motivo_no_acuerdo is not null)
  )
);

-- RLS activado sin políticas permisivas: el cliente anónimo no lee nada y toda
-- escritura pasa por Route Handlers con service role (que omite RLS por diseño).
alter table clientes       enable row level security;
alter table conversaciones enable row level security;
alter table turnos         enable row level security;
alter table acuerdos       enable row level security;
