# Especificación y Diagramas UML del Dominio — Anticipa Bancoagrícola

> **Plataforma**: **Anticipa Bancoagrícola** — Motor Predictivo, Cobranza Empática y Rentabilidad Activa.
>
> Este documento especifica el modelo de datos relacional activo (PostgreSQL / Supabase), la arquitectura de clases del orquestador del agente y los diagramas de secuencia para los pipelines **Outbound** e **Inbound**.

---

## 1. Diagrama Entidad-Relación Activo (Supabase PostgreSQL)

El esquema de producción del sistema implementa las 4 tablas auditables que garantizan la trazabilidad total exigida por la Superintendencia del Sistema Financiero (SSF):

```mermaid
erDiagram
    CLIENTES ||--o{ CONVERSACIONES : "sostiene"
    CONVERSACIONES ||--o{ TURNOS : "contiene"
    CONVERSACIONES ||--o| ACUERDOS : "concluye_en"

    CLIENTES {
        UUID id PK "Identificador único"
        string slug UK "Identificador legible (karla, marta, etc.)"
        string nombre "Nombre del cliente"
        string segmento "asalariado, remesas, informal, joven, senior"
        string tipo_ingreso "quincenal, mensual, irregular"
        int dia_ingreso_1 "Primer día de cobro (ej. 15)"
        int dia_ingreso_2 "Segundo día de cobro (ej. 30)"
        int dia_remesa "Día del mes en que recibe remesa"
        string producto "tipo de obligación: tarjeta, personal, etc."
        decimal cuota "Monto de la cuota mensual en USD"
        decimal saldo "Saldo deudor total en USD"
        int dia_corte "Día del mes de corte"
        int dia_pago "Día del mes límite de pago"
        int dias_atraso "Días de mora de la cuota más antigua (NCB-022)"
        string categoria_ncb022 "A1, A2, B, C1, C2, D1, D2, E (point-in-time)"
        boolean tiene_debito_automatico "Indica si posee débito activo"
        string tipo_empleo "planillero_bancoagricola, externo, independiente"
        boolean tiene_cuenta_optima "Habilita Sobregiro Elite"
        int riesgo_score "Score predictivo del modelo (0-100)"
        string riesgo_banda "LOW, MODERATE, MODERATE_HIGH, CRITICAL"
        jsonb shap_explicacion "Top 3 factores de riesgo del modelo ML"
        string tier_operativo "TIER_A_PRIME, TIER_A_PREVENTIVO, TIER_B, TIER_C, TIER_D_E"
    }

    CONVERSACIONES {
        UUID id PK "Identificador único de la sesión"
        UUID cliente_id FK "Referencia a CLIENTES"
        string canal "texto o voz"
        string modo_voz "pipeline, s2s o NULL si canal=texto"
        string apertura "agente (outbound) o cliente (inbound)"
        string estado "activa, cerrada_con_acuerdo, cerrada_sin_acuerdo, transferida_humano"
        timestamp creada_en "Momento de inicio de la conversación"
        timestamp cerrada_en "Momento de finalización"
    }

    TURNOS {
        UUID id PK "Identificador del turno"
        UUID conversacion_id FK "Referencia a CONVERSACIONES"
        int indice_turno "Secuencia cronológica dentro de la sesión"
        string rol "user, assistant, tool"
        text contenido "Texto literal de la interacción (PII enmascarado)"
        int latencia_ms "Tiempo de respuesta del turno en milisegundos"
        int tokens_in "Tokens de entrada consumidos"
        int tokens_out "Tokens de salida generados"
        boolean validador_ok "Indica si superó el filtro determinista"
        string modelo_version "Identificador del LLM proveedor"
        timestamp creado_en "Marca de tiempo del turno"
    }

    ACUERDOS {
        UUID id PK "Identificador del resultado"
        UUID conversacion_id FK "Referencia única a CONVERSACIONES"
        int escalon "Nivel 1 al 8 de la escalera de opciones"
        string tipo "mover_fecha, abono_parcial, fraccionamiento, cross_sell, etc."
        decimal monto "Monto acordado en USD (si aplica)"
        date fecha_acordada "Fecha pactada de cumplimiento o cobro"
        string motivo_no_acuerdo "Razón tipada si no se formalizó acuerdo"
        timestamp registrado_en "Momento de persistencia atómica"
    }
```

---

## 2. Diagrama de Clases del Dominio y Orquestación

```mermaid
classDiagram
    class Cliente {
        +UUID id
        +string nombre
        +decimal cuota
        +decimal saldo
        +int diasAtraso
        +CategoriaNCB022 categoria
        +TierOperativo tier
        +boolean isDeudaSaldada()
        +boolean isAtrasoActivo()
    }

    class MotorPredictivoML {
        +calcularProbabilidadMora(Cliente c) float
        +extraerFactoresSHAP(Cliente c) List~SHAPFactor~
        +clasificarTier(Cliente c, float probMora) TierOperativo
    }

    class OrquestadorPipeline {
        +ejecutarOutboundBatch(List~Cliente~ cartera) List~AccionProgramada~
        +procesarInbound(Cliente c, string mensajeInicial) SesionConversacion
        +aplicarSupresionReactiva(UUID clienteId) void
    }

    class AgenteConversacional {
        +procesarTurno(Conversacion conv, string input) TurnoRespuesta
        +consultarOpcionesValidas(Cliente c) List~OpcionElegible~
        +ejecutarTool(string toolName, JsonObject args) ToolResult
    }

    class ValidadorDeterminista {
        +validarTexto(string texto, Cliente c) ResultadoValidacion
        +contieneJergaProhibida(string texto) bool
        +montoEsValidoEnContexto(decimal monto, Cliente c) bool
        +excedeFrasesPermitidas(string texto) bool
    }

    class ModuloMonetizacion {
        +obtenerOfertasCrossSelling(Cliente c) List~ProductoOferta~
        +obtenerOfertasUpSelling(Cliente c) List~ProductoOferta~
    }

    OrquestadorPipeline --> MotorPredictivoML : consulta inferencia
    OrquestadorPipeline --> ModuloMonetizacion : activa en Tier A Prime
    OrquestadorPipeline --> AgenteConversacional : inicia sesión
    AgenteConversacional --> ValidadorDeterminista : audita cada turno
    AgenteConversacional ..> Cliente : lee perfil tipado
```

---

## 3. Diagramas de Secuencia Operativos

### A. Pipeline Outbound (Batch Diario + Supresión + Segmentación de Tiers)

```mermaid
sequenceDiagram
    autonumber
    participant Core as Core Bancario (EOD)
    participant Pipe as Orquestador Batch (03:00 AM)
    participant ML as Motor ML / SHAP
    participant DB as Supabase DB
    participant Monetiza as Módulo Monetización
    participant Agente as Agente Conversacional

    Core->>Pipe: Cierre contable consolidado
    Pipe->>DB: Consultar cartera con cuotas próximas o vencidas
    DB-->>Pipe: Lista de clientes

    loop Por cada cliente
        Pipe->>Pipe: Evaluar si deuda == saldada (0 días mora)
        alt Deuda Saldada / Cuota al día (Tier A Prime)
            Pipe->>Monetiza: Obtener oferta Cross-selling / Up-selling
            Monetiza-->>Pipe: Oferta elegible (Adelanto de Salario / Extrafinanciamiento)
            Pipe->>Agente: Programar notificación comercial sin cobranza
        else Cuota Pendiente
            Pipe->>ML: Inferencia de probabilidad de mora
            ML-->>Pipe: Score + Top 3 Factores SHAP
            alt Tier A Preventivo (0-14 días)
                Pipe->>Agente: Programar recordatorio amistoso / alineación quincena
            alt Tier B o C (14-120 días)
                Pipe->>Agente: Programar recordatorio prioritario + conversación empática
            else Tier D-E+ (120-365+ días)
                Pipe->>Agente: Programar contacto formal con bypass rápido a Humano
            end
        end
    end
```

### B. Pipeline Inbound (El Cliente se Comunica)

```mermaid
sequenceDiagram
    autonumber
    participant Cliente as Cliente (WhatsApp/Web/Voz)
    participant BFF as /api/chat
    participant DB as Supabase DB
    participant Agent as Agente LLM
    participant Val as Validador Determinista

    Cliente->>BFF: Inicia conversación ("Hola, tengo una duda con mi pago")
    BFF->>DB: Consultar perfil, predicción actual y reglas elegibles
    DB-->>BFF: Datos estructurados del cliente y categoría NCB-022
    BFF->>Agent: Prompt enriquecido (enfoque receptivo: responder necesidad)
    Agent->>BFF: Propuesta de respuesta
    BFF->>Val: Auditar respuesta (palabras prohibidas, montos, límites)
    alt Validación Exitosa
        Val-->>BFF: Aprobado
        BFF-->>Cliente: Mensaje empático y claro
    else Detección de Violación o Alucinación
        Val-->>BFF: Rechazado
        BFF->>Agent: Regenerar con instrucción correctiva
        Agent-->>BFF: Respuesta corregida
        BFF-->>Cliente: Mensaje seguro auditado
    end
```
