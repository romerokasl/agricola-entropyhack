"""
Generador de datos sintéticos de pre-mora crediticia para Bancoagrícola EntropyHack.
Simula patrones de estrés financiero 15-45 días antes de la fecha de corte.
"""

import argparse
import numpy as np
import pandas as pd


def generate_synthetic_credit_data(n_samples: int = 50000, random_state: int = 42) -> pd.DataFrame:
    """
    Genera un DataFrame realista con métricas de comportamiento crediticio.
    """
    np.random.seed(random_state)

    # 1. Ingreso mensual (USD en El Salvador: mediana aprox $600 - $1200 con cola alta)
    monthly_income = np.random.lognormal(mean=6.7, sigma=0.6, size=n_samples)
    monthly_income = np.clip(monthly_income, 300.0, 6000.0).round(2)

    # 2. Ratio deuda sobre ingreso (DTI)
    debt_to_income = np.random.beta(a=2.5, b=4.0, size=n_samples) * 0.9
    debt_to_income = np.clip(debt_to_income, 0.05, 0.85).round(3)

    # 3. Utilización de línea de crédito (0% a 100%+)
    credit_utilization = np.random.beta(a=2.0, b=2.5, size=n_samples) * 1.15
    credit_utilization = np.clip(credit_utilization, 0.02, 1.25).round(3)

    # 4. Caída en saldo de ahorros en los últimos 3 meses (0.0 = estable, 1.0 = vaciado)
    savings_drop = np.random.normal(loc=0.20, scale=0.30, size=n_samples)
    savings_drop = np.clip(savings_drop, -0.30, 0.95).round(3)

    # 5. Pagos atrasados en los últimos 6 meses (0 a 4)
    late_payments = np.random.choice(
        [0, 1, 2, 3, 4],
        size=n_samples,
        p=[0.72, 0.16, 0.07, 0.03, 0.02]
    )

    # 6. Volatilidad de gastos en últimos 60 días (desviación vs promedio normal)
    expense_volatility = np.random.gamma(shape=2.0, scale=0.10, size=n_samples)
    expense_volatility = np.clip(expense_volatility, 0.02, 0.70).round(3)

    # 7. Días restantes para el próximo pago (1 a 30 días)
    days_to_payment = np.random.randint(1, 31, size=n_samples)

    # 8. Débito automático activado (1 = sí, 0 = no)
    has_auto_debit = np.random.choice([1, 0], size=n_samples, p=[0.45, 0.55])

    # 9. Antigüedad del cliente en el banco (meses, 3 a 180)
    customer_tenure_months = np.random.randint(3, 181, size=n_samples)

    # --- Función de probabilidad latente de mora (Logit) ---
    # Factores de riesgo empíricos:
    # + Alta utilización de crédito
    # + Alto DTI
    # + Caída súbita en ahorros
    # + Historial reciente de atrasos
    # - Mayor ingreso y antigüedad reducen riesgo
    # - Débito automático reduce fricción
    log_odds = (
        -3.2
        + 3.1 * credit_utilization
        + 2.6 * debt_to_income
        + 2.2 * np.maximum(0, savings_drop)
        + 0.9 * late_payments
        + 1.5 * expense_volatility
        - 0.0003 * monthly_income
        - 0.005 * customer_tenure_months
        - 0.6 * has_auto_debit
    )

    probabilities = 1.0 / (1.0 + np.exp(-log_odds))
    # Ruido estocástico
    target_default = (probabilities > np.random.uniform(0.1, 0.9, size=n_samples)).astype(int)

    df = pd.DataFrame({
        "customer_id": [f"CUST_{i:07d}" for i in range(1, n_samples + 1)],
        "monthly_income": monthly_income,
        "debt_to_income": debt_to_income,
        "credit_utilization": credit_utilization,
        "savings_drop": savings_drop,
        "late_payments_last_6m": late_payments,
        "expense_volatility": expense_volatility,
        "days_to_payment": days_to_payment,
        "has_auto_debit": has_auto_debit,
        "customer_tenure_months": customer_tenure_months,
        "target_default": target_default,
    })

    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generar dataset sintético para Bancoagrícola")
    parser.add_argument("--rows", type=int, default=50000, help="Número de registros a generar (default: 50,000)")
    parser.add_argument("--output", type=str, default="synthetic_credit_data.csv", help="Ruta de guardado")
    args = parser.parse_args()

    print(f"Generando {args.rows:,} registros sintéticos...")
    data = generate_synthetic_credit_data(n_samples=args.rows)
    data.to_csv(args.output, index=False)
    default_rate = data["target_default"].mean() * 100
    print(f"Dataset guardado en '{args.output}' con éxito.")
    print(f"Tasa de mora simulada: {default_rate:.2f}% ({data['target_default'].sum():,} casos)")
