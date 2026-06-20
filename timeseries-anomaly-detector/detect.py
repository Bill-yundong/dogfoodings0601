#!/usr/bin/env python3
import argparse
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.config import Config
from core.collector import DataCollector
from core.window import SlidingWindowDetector
from core.alarm import AlarmDebouncer


def main():
    parser = argparse.ArgumentParser(description='Time Series Anomaly Detector with Alarm Debounce')
    parser.add_argument('--config', type=str, required=True, help='Path to rules.yaml config file')
    parser.add_argument('--data', type=str, required=True, help='Path to metrics data directory')
    parser.add_argument('--output', type=str, default=None, help='Path to output JSON file (default: stdout)')
    args = parser.parse_args()

    config = Config(args.config)

    collector = DataCollector(args.data, config.timestamp_column)
    merged_df, metric_names = collector.load_all_csv()

    if len(metric_names) == 0:
        print("Error: No metrics found in data directory", file=sys.stderr)
        sys.exit(1)

    print(f"Loaded {len(merged_df)} data points, {len(metric_names)} metrics")
    print(f"Metrics: {', '.join(metric_names)}")
    print(f"Time range: {merged_df[config.timestamp_column].min()} ~ {merged_df[config.timestamp_column].max()}")
    print()

    detector = SlidingWindowDetector(
        window_size=config.window_size,
        window_step=config.window_step,
        sigma_threshold=config.sigma_threshold,
        timestamp_column=config.timestamp_column
    )

    detection_results = detector.detect_anomalies(merged_df, metric_names)

    debouncer = AlarmDebouncer(
        min_alarm_windows=config.min_alarm_windows,
        recovery_windows=config.recovery_windows
    )

    alarm_results = debouncer.process_all(detection_results)

    output = format_output(alarm_results, detection_results, config)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False, default=str)
        print(f"\nResults saved to {args.output}")
    else:
        print(json.dumps(output, indent=2, ensure_ascii=False, default=str))

    print_summary(alarm_results)


def format_output(alarm_results, detection_results, config):
    output = {
        'config': {
            'window_size': config.window_size,
            'window_step': config.window_step,
            'sigma_threshold': config.sigma_threshold,
            'min_alarm_windows': config.min_alarm_windows,
            'recovery_windows': config.recovery_windows
        },
        'summary': {
            'total_metrics': len(alarm_results),
            'metrics_with_alarms': 0,
            'total_alarm_events': 0
        },
        'metrics': {}
    }

    for metric, result in alarm_results.items():
        metric_out = {
            'final_state': result['final_state'],
            'alarm_events': result['alarm_events'],
            'anomaly_intervals': result['anomaly_intervals'],
            'total_anomaly_candidates': sum(
                1 for w in detection_results[metric]['windows'] if w['is_anomaly']
            ),
            'total_windows': len(detection_results[metric]['windows'])
        }

        output['metrics'][metric] = metric_out

        if len(result['alarm_events']) > 0:
            output['summary']['metrics_with_alarms'] += 1
            output['summary']['total_alarm_events'] += len(result['alarm_events'])

    return output


def print_summary(alarm_results):
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    total_alarms = 0
    metrics_with_alarms = []

    for metric, result in alarm_results.items():
        if len(result['alarm_events']) > 0:
            metrics_with_alarms.append(metric)
            total_alarms += sum(1 for e in result['alarm_events'] if e['type'] == 'ALARM_TRIGGERED')

    print(f"Total metrics: {len(alarm_results)}")
    print(f"Metrics with alarms: {len(metrics_with_alarms)}")
    print(f"Total alarm triggers: {total_alarms}")

    if metrics_with_alarms:
        print(f"\nMetrics with alarms: {', '.join(metrics_with_alarms)}")

    for metric, result in alarm_results.items():
        print(f"\n--- {metric} ---")
        print(f"  Final state: {result['final_state']}")
        print(f"  Anomaly intervals: {len(result['anomaly_intervals'])}")

        for interval in result['anomaly_intervals']:
            ongoing = " (ongoing)" if interval.get('ongoing', False) else ""
            print(f"    - {interval['start']} ~ {interval['end']} [{interval['duration_windows']} windows]{ongoing}")

        print(f"  Alarm events: {len(result['alarm_events'])}")
        for event in result['alarm_events']:
            if event['type'] == 'ALARM_TRIGGERED':
                print(f"    [TRIGGER] {event['timestamp']} value={event['value']:.4f} z={event['z_score']:.2f}")
            else:
                print(f"    [CLEAR]   {event['timestamp']} value={event['value']:.4f}")


if __name__ == '__main__':
    main()
