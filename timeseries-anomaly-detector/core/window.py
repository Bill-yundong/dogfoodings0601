import pandas as pd
import numpy as np


class SlidingWindowDetector:
    def __init__(self, window_size=10, window_step=1, sigma_threshold=3, timestamp_column='timestamp'):
        self.window_size = window_size
        self.window_step = window_step
        self.sigma_threshold = sigma_threshold
        self.timestamp_column = timestamp_column

    def detect_anomalies(self, df, metric_names):
        results = {}

        for metric in metric_names:
            if metric not in df.columns:
                continue

            series = df[metric].values
            timestamps = df[self.timestamp_column].values

            window_labels = self._detect_series(series)

            results[metric] = {
                'timestamps': timestamps,
                'values': series,
                'is_anomaly': window_labels,
                'windows': self._get_window_details(series, timestamps)
            }

        return results

    def _detect_series(self, series):
        n = len(series)
        labels = np.zeros(n, dtype=bool)

        if n <= self.window_size:
            return labels

        for i in range(self.window_size, n, self.window_step):
            window_start = i - self.window_size
            window_end = i
            window = series[window_start:window_end]

            mean = np.mean(window)
            std = np.std(window)

            if std == 0:
                continue

            point_idx = i
            z_score = abs(series[point_idx] - mean) / std

            if z_score > self.sigma_threshold:
                labels[point_idx] = True

        return labels

    def _get_window_details(self, series, timestamps):
        windows = []
        n = len(series)

        if n <= self.window_size:
            return windows

        for i in range(self.window_size, n, self.window_step):
            window_start = i - self.window_size
            window_end = i
            window = series[window_start:window_end]

            mean = float(np.mean(window))
            std = float(np.std(window))

            point_idx = i
            value = float(series[point_idx])
            z_score = abs(value - mean) / std if std > 0 else 0.0
            is_anomaly = z_score > self.sigma_threshold

            windows.append({
                'window_start_idx': window_start,
                'window_end_idx': window_end,
                'point_timestamp': str(timestamps[point_idx]),
                'point_value': value,
                'window_mean': mean,
                'window_std': std,
                'z_score': z_score,
                'is_anomaly': is_anomaly
            })

        return windows
