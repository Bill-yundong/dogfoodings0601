#!/usr/bin/env python3
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parser import parse_image_meta, analyze_layer_relationships
from detector import run_all_detections
from report import generate_report, generate_json_report


def main():
    parser = argparse.ArgumentParser(
        description='Docker 镜像层分析与瘦身建议工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  python analyze.py --image-meta ./image-inspect.json
  python analyze.py --image-meta ./image-inspect.json --json
  python analyze.py --image-meta ./image-inspect.json --output report.txt
        '''
    )

    parser.add_argument(
        '--image-meta',
        type=str,
        required=True,
        help='docker inspect 导出的镜像元数据 JSON 文件路径',
    )

    parser.add_argument(
        '--json',
        action='store_true',
        help='以 JSON 格式输出报告',
    )

    parser.add_argument(
        '--output', '-o',
        type=str,
        default=None,
        help='将报告输出到指定文件 (默认输出到控制台)',
    )

    args = parser.parse_args()

    try:
        image_meta = parse_image_meta(args.image_meta)
    except FileNotFoundError as e:
        print(f'错误: {e}', file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(f'错误: {e}', file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f'解析镜像元数据失败: {e}', file=sys.stderr)
        sys.exit(1)

    layer_analysis = analyze_layer_relationships(image_meta.layers)
    detection_result = run_all_detections(image_meta.layers)

    if args.json:
        report_content = generate_json_report(image_meta, layer_analysis, detection_result)
    else:
        report_content = generate_report(image_meta, layer_analysis, detection_result)

    if args.output:
        try:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(report_content)
            print(f'报告已保存到: {args.output}')
        except IOError as e:
            print(f'写入文件失败: {e}', file=sys.stderr)
            sys.exit(1)
    else:
        print(report_content)


if __name__ == '__main__':
    main()
