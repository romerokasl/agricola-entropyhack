-- ====================================================================
-- BANCOAGRÍCOLA ENTROPYHACK — PRE-MORA & EMPATHETIC PREVENTION SCHEMA
-- ====================================================================

-- 1. Tabla de Clientes
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dui_masked TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    department TEXT DEFAULT 'San Salvador',
    tenure_months INT DEFAULT 24,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Cuentas de Crédito y Productos Activos
CREATE TABLE IF NOT EXISTS public.credit_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    product_type TEXT NOT NULL CHECK (product_type IN ('TARJETA_CREDITO', 'CREDITO_PERSONAL', 'EXTRAFINANCIAMIENTO', 'HIPOTECARIO')),
    account_number_masked TEXT NOT NULL,
    credit_limit NUMERIC(12, 2) NOT NULL,
    current_balance NUMERIC(12, 2) NOT NULL,
    minimum_payment NUMERIC(12, 2) NOT NULL,
    next_due_date DATE NOT NULL,
    has_auto_debit BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'SETTLED')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Métricas Financieras y Comportamiento Reciente
CREATE TABLE IF NOT EXISTS public.financial_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    monthly_income NUMERIC(12, 2) NOT NULL,
    debt_to_income NUMERIC(5, 3) NOT NULL,
    credit_utilization NUMERIC(5, 3) NOT NULL,
    savings_drop_pct NUMERIC(5, 3) DEFAULT 0.0,
    late_payments_last_6m INT DEFAULT 0,
    expense_volatility NUMERIC(5, 3) DEFAULT 0.1,
    calculated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Evaluaciones de Riesgo del Modelo (Inferencia)
CREATE TABLE IF NOT EXISTS public.risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    risk_score INT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MODERATE', 'MODERATE_HIGH', 'CRITICAL')),
    default_probability NUMERIC(6, 4) NOT NULL,
    top_risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    model_version TEXT DEFAULT 'v1.0.0',
    assessed_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Intervenciones Empáticas Preventivas
CREATE TABLE IF NOT EXISTS public.empathic_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    credit_account_id UUID REFERENCES public.credit_accounts(id) ON DELETE SET NULL,
    intervention_type TEXT NOT NULL CHECK (intervention_type IN ('FRIENDLY_REMINDER', 'SPLIT_PAYMENT', 'RESTRUCTURING_OFFER', 'DUE_DATE_EXTENSION', 'FINANCIAL_COACHING')),
    proposal_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    empathetic_message TEXT NOT NULL,
    channel TEXT DEFAULT 'APP_NOTIFICATION' CHECK (channel IN ('APP_NOTIFICATION', 'WHATSAPP', 'EMAIL', 'SMS')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VIEWED', 'ACCEPTED', 'CUSTOMIZED', 'DECLINED')),
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ====================================================================
-- HABILITACIÓN DE ROW LEVEL SECURITY (RLS)
-- ====================================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empathic_interventions ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública/autenticada para la demo del hackathon
CREATE POLICY "Allow read access to public demo profiles" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Allow read access to credit accounts" ON public.credit_accounts FOR SELECT USING (true);
CREATE POLICY "Allow read access to financial metrics" ON public.financial_metrics FOR SELECT USING (true);
CREATE POLICY "Allow read access to risk assessments" ON public.risk_assessments FOR SELECT USING (true);
CREATE POLICY "Allow read/update on interventions" ON public.empathic_interventions FOR ALL USING (true);

-- Índices para consultas de alta velocidad
CREATE INDEX IF NOT EXISTS idx_credit_accounts_customer ON public.credit_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_financial_metrics_customer ON public.financial_metrics(customer_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_customer ON public.risk_assessments(customer_id);
CREATE INDEX IF NOT EXISTS idx_interventions_customer ON public.empathic_interventions(customer_id);
