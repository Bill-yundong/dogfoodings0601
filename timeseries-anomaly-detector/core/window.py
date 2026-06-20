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

            window_labels = self._detect_series_two_pass(series, threshold)
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

    @staticmethod
    def _rough_outlier_mask(series, iqr_factor=3.0, mad_factor=6.0):
        q1 = np.percentile(series, 25)
        q3 = np.percentile(series, 75)
        iqr = q3 - q1
        if iqr > 0:
            lower = q1 - iqr_factor * iqr
            upper = q3 + iqr_factor * iqr
            mask = (series < lower) | (series > upper)
            return mask

        med = np.median(series)
        mad = np.median(np.abs(series - med))
        if mad == 0:
            return np.zeros(len(series), dtype=bool)
        sigma_equiv = 1.4826 * mad
        scores = np.abs(series - med) / sigma_equiv
        return scores > mad_factor

    @staticmethod
    def _iterative_clean_stats(window, outlier_mask, fallback_center, fallback_spread,
                               threshold=2.8, max_iter=5):
        mask = ~outlier_mask
        if np.sum(mask) < 3:
            return fallback_center, fallback_spread, np.zeros(len(window), dtype=bool)

        for _ in range(max_iter):
            if np.sum(mask) < 3:
                return fallback_center, fallback_spread, np.zeros(len(window), dtype=bool)
            vals = window[mask]
            mean = float(np.mean(vals))
            std = float(np.std(vals))
            if std == 0:
                return fallback_center, fallback_spread, mask.copy()
            changed = False
            for j in range(len(window)):
                if not mask[j]:
                    continue
                score = abs(window[j] - mean) / std
                if score > threshold:
                    mask[j] = False
                    changed = True
            if not changed:
                return mean, std, mask.copy()

        if np.sum(mask) >= 2:
            vals = window[mask]
            return float(np.mean(vals)), float(np.std(vals)), mask.copy()
        return fallback_center, fallback_spread, mask.copy()

    def _detect_series_two_pass(self, series, threshold):
        n = len(series)
        labels = np.zeros(n, dtype=bool)

        if n <= self.window_size:
            return labels

        rough_mask = self._rough_outlier_mask(series)
        global_center, global_spread = self._global_robust_baseline(series)

        for i in range(self.window_size, n, self.window_step):
            window_start = i - self.window_size
            window_end = i
            window = series[window_start:window_end]
            window_outliers = rough_mask[window_start:window_end]

            win_inlier_frac = 1.0 - (np.sum(window_outliers) / len(window))

            if win_inlier_frac >= 0.4:
                mean, std, _ = self._iterative_clean_stats(
                    window, window_outliers, global_center, global_spread
                )
            else:
                mean, std = global_center, global_spread

            if std == 0:
                continue

            point_idx = i
            z_score = abs(series[point_idx] - mean) / std

            if z_score > threshold:
                labels[point_idx] = True

        return labels

    def _get_window_details(self, series, timestamps, threshold, labels):
        windows = []
        n = len(series)

        if n <= self.window_size:
            return windows

        rough_mask = self._rough_outlier_mask(series)
        global_center, global_spread = self._global_robust_baseline(series)

        for i in range(self.window_size, n, self.window_step):
            window_start = i - self.window_size
            window_end = i
            window = series[window_start:window_end]
            window_outliers = rough_mask[window_start:window_end]

            win_inlier_frac = 1.0 - (np.sum(window_outliers) / len(window))

            if win_inlier_frac >= 0.4:
                mean, std, clean_mask = self._iterative_clean_stats(
                    window, window_outliers, global_center, global_spread
                )
                clean_count = int(np.sum(clean_mask)) if np.any(clean_mask) else 0
            else:
                mean, std = global_center, global_spread
                clean_count = 0

            point_idx = i
            value = float(series[point_idx])
            z_score = abs(value - mean) / std if std > 0 else 0.0
            is_anomaly = bool(labels[point_idx])

            windows.append({
                'window_start_idx': window_start,
                'window_end_idx': window_end,
                'point_timestamp': str(timestamps[point_idx]),
                'point_value': value,
                'window_mean': mean,
                'window_std': std,
                'window_clean_count': clean_count,
                'used_global_baseline': win_inlier_frac < 0.4,
                'z_score': z_score,
                'is_anomaly': is_anomaly,
                'point_idx': point_idx
            })

        return windows
