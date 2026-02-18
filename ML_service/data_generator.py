import pandas as pd
import random
from datetime import datetime, timedelta

start_weight = 14.2
weight = start_weight
data = []

start_date = datetime(2025, 1, 1)

for day in range(120):
    date = start_date + timedelta(days=day)

    cooking_sessions = random.choice([1,2,2,3])
    base_usage = 0.25
    variation = random.uniform(-0.05, 0.08)
    daily_usage = max(0.1, base_usage + variation)

    weight = max(0, weight - daily_usage)
    gas_percent = (weight / start_weight) * 100

    data.append({
        "date": date.strftime("%Y-%m-%d"),
        "weight_kg": round(weight, 2),
        "gas_percent": round(gas_percent, 2),
        "daily_usage_kg": round(daily_usage, 3),
        "cooking_sessions": cooking_sessions
    })

df = pd.DataFrame(data)
df.to_csv("data/lpg_usage_data.csv", index=False)
print("Dataset generated")
