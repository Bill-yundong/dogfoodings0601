import pandas as pd
import numpy as np


class SlidingWindowDetector:
    def __init__(self, window_size=10, window_step=1, sigma_threshold=3, timestamp_column='timestamp'):
        self.window_size = window_size
        self.window_step = window_step
        self.sigma_threshold = sigma_threshold
        self.timestamp_column = timestamp_column

    def detect_anomalies(self, df, metric_names, metric_thresholds=None):
        results = {}

        for metric in metric_names:
            if metric not in df.columns:
                continue

            series = df[metric].values
            timestamps = df[self.timestamp_column].values

            threshold = self.sigma_threshold
            if metric_thresholds and metric in metric_thresholds:
                threshold = metric_thresholds[metric]

            window_labels = self._detect_series(series, threshold)
            windows = self._get_window_details(series, timestamps, threshold, window_labels)

            results[metric] = {
                'timestamps': timestamps,
                'values': series,
                'is_anomaly': window_labels,
                'windows': windows,
                'sigma_threshold': threshold
            }

        return results

    @staticmethod
    def _global_robust_baseline(series):
        median = float(np.median(series))
        mad = float(np.median(np.abs(series - median)))
        sigma_equiv = 1.4826 * mad
        if sigma_equiv == 0:
            q1 = float(np.percentile(series, 25))
            q3 = float(np.percentile(series, 75))
            sigma_equiv = 0.7413 * (q3 - q1)
            if sigma_equiv == 0:
                sigma_equiv = float(np.std(series))
        return median, sigma_equiv

    def _detect_series(self, series, threshold):
        n = len(series)
        labels = np.zeros(n, dtype=bool)

        if n <= self.window_size:
            return labels

        center, spread = self._global_robust_baseline(series)

        if spread == 0:
            return labels

        for i in range(self.window_size, n, self.window_step):
            z_score = abs(series[i] - center) / spread
            if z_score > threshold:
                labels[i] = True

        return labels

    def _get_window_details(self, series, timestamps, threshold, labels):
        windows = []
        n = len(series)

        if n <= self.window_size:
            return windows

        center, spread = self._global_robust_baseline(series)

        for i in range(self.window_size, n, self.window_step):
            window_start = i - self.window_size
            window_end = i
            point_idx = i
            value = float(series[point_idx])
            z_score = abs(value - center) / spread if spread > 0 else 0.0
            is_anomaly = bool(labels[point_idx])

            windows.append({
                'window_start_idx': window_start,
                'window_end_idx': window_end,
                'point_timestamp': str(timestamps[point_idx]),
                'point_value': value,
                'window_mean': center,
                'window_std': spread,
                'baseline_source': 'global_robust',
                'z_score': z_score,
                'is_anomaly': is_anomaly,
                'point_idx': point_idx
            })

        return windows
