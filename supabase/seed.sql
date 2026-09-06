-- ====================================================================
-- BANCOAGRÍCOLA ENTROPYHACK — SEED DATA (3 PERFILES DE PRUEBA)
-- ====================================================================

-- 1. Cliente en Riesgo Moderado-Alto (Requiere Prevención Empática)
INSERT INTO public.customers (id, dui_masked, full_name, email, phone, department, tenure_months)
VALUES (
    'a1111111-1111-1111-1111-111111111111',
    '••••••84-2',
    'Carlos Eduardo Rivas',
    'carlos.rivas@ejemplo.sv',
    '+503 7123-4567',
    'San Salvador',
    36
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.credit_accounts (id, customer_id, product_type, account_number_masked, credit_limit, current_balance, minimum_payment, next_due_date, has_auto_debit, status)
VALUES (
    'b1111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    'TARJETA_CREDITO',
    '•••• •••• •••• 4591',
    2500.00,
    2150.00,
    145.00,
    CURRENT_DATE + INTERVAL '12 days',
    false,
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.financial_metrics (customer_id, monthly_income, debt_to_income, credit_utilization, savings_drop_pct, late_payments_last_6m, expense_volatility)
VALUES (
    'a1111111-1111-1111-1111-111111111111',
    850.00,
    0.480,
    0.860,
    0.450,
    1,
    0.350
);

INSERT INTO public.risk_assessments (customer_id, risk_score, risk_level, default_probability, top_risk_factors)
VALUES (
    'a1111111-1111-1111-1111-111111111111',
    76,
    'MODERATE_HIGH',
    0.7620,
    '[
        {"factor": "Utilización del 86% de tarjeta de crédito", "impact": "+32%"},
        {"factor": "Disminución del 45% en saldo de cuenta de ahorro", "impact": "+24%"},
        {"factor": "Ratio cuota/ingreso en nivel crítico (48%)", "impact": "+18%"}
    ]'::jsonb
);

INSERT INTO public.empathic_interventions (customer_id, credit_account_id, intervention_type, proposal_details, empathetic_message, channel, status)
VALUES (
    'a1111111-1111-1111-1111-111111111111',
    'b1111111-1111-1111-1111-111111111111',
    'SPLIT_PAYMENT',
    '{"option_type": "DIVIDE_EN_DOS", "first_payment": 72.50, "second_payment": 72.50, "days_interval": 15, "interest_forgiveness": true}'::jsonb,
    'Hola Carlos, notamos que este mes tus gastos han subido. En Bancoagrícola queremos ser tu aliado para cuidar tu récord crediticio: si deseas, puedes dividir tu cuota de $145 en dos pagos de $72.50 sin recargos.',
    'APP_NOTIFICATION',
    'PENDING'
);

-- 2. Cliente Saludable (Riesgo Bajo / Monitoreo)
INSERT INTO public.customers (id, dui_masked, full_name, email, phone, department, tenure_months)
VALUES (
    'a2222222-2222-2222-2222-222222222222',
    '••••••19-7',
    'Ana Marcela Gómez',
    'ana.gomez@ejemplo.sv',
    '+503 7890-1234',
    'Santa Ana',
    60
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.credit_accounts (id, customer_id, product_type, account_number_masked, credit_limit, current_balance, minimum_payment, next_due_date, has_auto_debit, status)
VALUES (
    'b2222222-2222-2222-2222-222222222222',
    'a2222222-2222-2222-2222-222222222222',
    'CREDITO_PERSONAL',
    '•••• •••• •••• 9812',
    5000.00,
    1200.00,
    85.00,
    CURRENT_DATE + INTERVAL '22 days',
    true,
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.financial_metrics (customer_id, monthly_income, debt_to_income, credit_utilization, savings_drop_pct, late_payments_last_6m, expense_volatility)
VALUES (
    'a2222222-2222-2222-2222-222222222222',
    1400.00,
    0.180,
    0.240,
    -0.050,
    0,
    0.080
);

INSERT INTO public.risk_assessments (customer_id, risk_score, risk_level, default_probability, top_risk_factors)
VALUES (
    'a2222222-2222-2222-2222-222222222222',
    12,
    'LOW',
    0.1240,
    '[
        {"factor": "Excelente puntualidad con débito automático", "impact": "-25%"},
        {"factor": "Baja utilización de línea crediticia (24%)", "impact": "-20%"}
    ]'::jsonb
);
