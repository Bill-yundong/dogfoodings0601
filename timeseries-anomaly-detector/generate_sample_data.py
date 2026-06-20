#!/usr/bin/env python3
import pandas as pd
import numpy as np
import os


def generate_cpu_data():
    np.random.seed(42)
    n = 120
    timestamps = pd.date_range('2024-01-01 00:00:00', periods=n, freq='1min')

    values = 50 + np.random.normal(0, 1, n)

    values[20:28] += 40
    values[50] += 30
    values[70:90] += 50
    values[100] += 35

    df = pd.DataFrame({
        'timestamp': timestamps,
        'value': values
    })
    return df


def generate_memory_data():
    np.random.seed(123)
    n = 120
    timestamps = pd.date_range('2024-01-01 00:00:00', periods=n, freq='1min')

    values = 60 + np.random.normal(0, 0.8, n)

    values[25:45] += 20
    values[80] -= 15

    df = pd.DataFrame({
        'timestamp': timestamps,
        'value': values
    })
    return df


def generate_latency_data():
    np.random.seed(456)
    n = 120
    timestamps = pd.date_range('2024-01-01 00:00:00', periods=n, freq='1min')

    values = 100 + np.random.normal(0, 2, n)

    values[15] += 80
    values[55:80] += 120
    values[95:110] += 100

    df = pd.DataFrame({
        'timestamp': timestamps,
        'value': values
    })
    return df


def main():
    output_dir = os.path.join(os.path.dirname(__file__), 'metrics')
    os.makedirs(output_dir, exist_ok=True)

    cpu_df = generate_cpu_data()
    cpu_df.to_csv(os.path.join(output_dir, 'cpu.csv'), index=False)
    print(f"Generated cpu.csv with {len(cpu_df)} rows")

    memory_df = generate_memory_data()
    memory_df.to_csv(os.path.join(output_dir, 'memory.csv'), index=False)
    print(f"Generated memory.csv with {len(memory_df)} rows")

    latency_df = generate_latency_data()
    latency_df.to_csv(os.path.join(output_dir, 'latency.csv'), index=False)
    print(f"Generated latency.csv with {len(latency_df)} rows")

    print("\nData files generated in", output_dir)


if __name__ == '__main__':
    main()
