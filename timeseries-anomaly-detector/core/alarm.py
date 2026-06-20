from enum import Enum


class AlarmState(Enum):
    NORMAL = "NORMAL"
    PENDING = "PENDING"
    ALARM = "ALARM"
    RECOVERING = "RECOVERING"


class AlarmStateMachine:
    def __init__(self, min_alarm_windows=3, recovery_windows=5):
        self.min_alarm_windows = min_alarm_windows
        self.recovery_windows = recovery_windows
        self.state = AlarmState.NORMAL
        self.anomaly_count = 0
        self.normal_count = 0

    def reset(self):
        self.state = AlarmState.NORMAL
        self.anomaly_count = 0
        self.normal_count = 0

    def process(self, is_anomaly):
        prev_state = self.state

        if self.state == AlarmState.NORMAL:
            if is_anomaly:
                self.anomaly_count = 1
                self.state = AlarmState.PENDING
            else:
                pass

        elif self.state == AlarmState.PENDING:
            if is_anomaly:
                self.anomaly_count += 1
                if self.anomaly_count >= self.min_alarm_windows:
                    self.state = AlarmState.ALARM
            else:
                self.anomaly_count = 0
                self.state = AlarmState.NORMAL

        elif self.state == AlarmState.ALARM:
            if not is_anomaly:
                self.normal_count = 1
                self.state = AlarmState.RECOVERING
            else:
                pass

        elif self.state == AlarmState.RECOVERING:
            if not is_anomaly:
                self.normal_count += 1
                if self.normal_count >= self.recovery_windows:
                    self.state = AlarmState.NORMAL
                    self.normal_count = 0
            else:
                self.normal_count = 0
                self.state = AlarmState.ALARM

        state_changed = prev_state != self.state
        triggered_alarm = state_changed and self.state == AlarmState.ALARM
        cleared_alarm = state_changed and self.state == AlarmState.NORMAL and prev_state == AlarmState.RECOVERING

        return {
            'state': self.state.value,
            'state_changed': state_changed,
            'triggered_alarm': triggered_alarm,
            'cleared_alarm': cleared_alarm
        }


class AlarmDebouncer:
    def __init__(self, min_alarm_windows=3, recovery_windows=5):
        self.min_alarm_windows = min_alarm_windows
        self.recovery_windows = recovery_windows

    def process_metric(self, window_results):
        state_machine = AlarmStateMachine(self.min_alarm_windows, self.recovery_windows)

        alarm_events = []
        anomaly_intervals = []
        state_history = []

        current_alarm_start = None

        for i, window in enumerate(window_results):
            is_anomaly = window['is_anomaly']
            result = state_machine.process(is_anomaly)

            state_history.append({
                'window_idx': i,
                'timestamp': window['point_timestamp'],
                'value': window['point_value'],
                'state': result['state'],
                'is_anomaly_candidate': is_anomaly
            })

            if result['triggered_alarm']:
                current_alarm_start = window['point_timestamp']
                alarm_events.append({
                    'type': 'ALARM_TRIGGERED',
                    'timestamp': window['point_timestamp'],
                    'window_idx': i,
                    'value': window['point_value'],
                    'z_score': window['z_score']
                })

            if result['cleared_alarm'] and current_alarm_start is not None:
                anomaly_intervals.append({
                    'start': current_alarm_start,
                    'end': window['point_timestamp'],
                    'duration_windows': i - state_history.index(
                        next(s for s in state_history if s['timestamp'] == current_alarm_start)
                    )
                })
                alarm_events.append({
                    'type': 'ALARM_CLEARED',
                    'timestamp': window['point_timestamp'],
                    'window_idx': i,
                    'value': window['point_value']
                })
                current_alarm_start = None

        if current_alarm_start is not None:
            last_window = window_results[-1]
            anomaly_intervals.append({
                'start': current_alarm_start,
                'end': last_window['point_timestamp'],
                'duration_windows': len(window_results) - next(
                    i for i, s in enumerate(state_history) if s['timestamp'] == current_alarm_start
                ),
                'ongoing': True
            })

        return {
            'alarm_events': alarm_events,
            'anomaly_intervals': anomaly_intervals,
            'state_history': state_history,
            'final_state': state_machine.state.value
        }

    def process_all(self, detection_results):
        all_alarms = {}

        for metric, metric_data in detection_results.items():
            windows = metric_data['windows']
            result = self.process_metric(windows)
            all_alarms[metric] = result

        return all_alarms
