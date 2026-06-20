import yaml
import os


class Config:
    def __init__(self, config_path):
        self.config_path = config_path
        self.config = self._load_config()

    def _load_config(self):
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Config file not found: {self.config_path}")
        with open(self.config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    @property
    def window_size(self):
        return self.config.get('window_size', 10)

    @property
    def window_step(self):
        return self.config.get('window_step', 1)

    @property
    def sigma_threshold(self):
        return self.config.get('sigma_threshold', 3)

    @property
    def min_alarm_windows(self):
        return self.config.get('min_alarm_windows', 3)

    @property
    def recovery_windows(self):
        return self.config.get('recovery_windows', 5)

    @property
    def timestamp_column(self):
        return self.config.get('timestamp_column', 'timestamp')

    @property
    def metrics(self):
        return self.config.get('metrics', [])

    def get_metric_config(self, metric_name):
        for m in self.metrics:
            if m.get('name') == metric_name:
                return m
        return None
