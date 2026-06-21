from utils import format_size


SEVERITY_SYMBOLS = {
    'high': '🔴',
    'medium': '🟡',
    'low': '🟢',
}

CATEGORY_NAMES = {
    'redundant_copy': '重复 COPY/ADD',
    'package_cache': '包管理器缓存',
    'build_toolchain': '构建工具链残留',
    'debug_tools': '调试工具',
    'chown_optimization': 'chown 优化',
    'npm_optimization': 'npm 优化',
}


def generate_report(image_meta, layer_analysis, detection_result):
    report_parts = []

    report_parts.append(_generate_header(image_meta))
    report_parts.append('')
    report_parts.append('=' * 70)
    report_parts.append('')

    report_parts.append(_generate_layer_summary(image_meta, layer_analysis))
    report_parts.append('')
    report_parts.append('-' * 70)
    report_parts.append('')

    report_parts.append(_generate_layer_details(image_meta))
    report_parts.append('')
    report_parts.append('-' * 70)
    report_parts.append('')

    report_parts.append(_generate_optimization_summary(detection_result, image_meta.total_size))
    report_parts.append('')
    report_parts.append('-' * 70)
    report_parts.append('')

    report_parts.append(_generate_optimization_details(detection_result))

    report_parts.append('')
    report_parts.append('=' * 70)
    report_parts.append('')
    report_parts.append(_generate_dockerfile_snippets(detection_result))

    return '\n'.join(report_parts)


def _generate_header(image_meta):
    lines = []
    lines.append('=' * 70)
    lines.append('  Docker 镜像层分析与瘦身建议报告')
    lines.append('=' * 70)
    lines.append('')
    lines.append(f'  镜像 ID:      {image_meta.id[:24]}...')
    lines.append(f'  镜像标签:      {", ".join(image_meta.tags) if image_meta.tags else "N/A"}')
    lines.append(f'  创建时间:      {image_meta.created}')
    lines.append(f'  架构:         {image_meta.architecture}/{image_meta.os}')
    lines.append(f'  总大小:       {format_size(image_meta.total_size)}')
    return '\n'.join(lines)


def _generate_layer_summary(image_meta, layer_analysis):
    lines = []
    lines.append('📊 镜像层概览')
    lines.append('')
    lines.append(f'  总层数:         {len(image_meta.layers)} 层')
    lines.append(f'  有效层(非空):   {layer_analysis["non_empty_layer_count"]} 层')
    lines.append(f'  COPY 层数:      {layer_analysis["copy_layer_count"]} 层')
    lines.append(f'  ADD 层数:       {layer_analysis["add_layer_count"]} 层')
    lines.append(f'  RUN 层数:       {layer_analysis["run_layer_count"]} 层')
    lines.append(f'  路径重叠数:     {layer_analysis["overlapping_path_count"]} 处')
    lines.append(f'  总大小:         {layer_analysis["total_size_formatted"]}')
    return '\n'.join(lines)


def _generate_layer_details(image_meta):
    lines = []
    lines.append('📋 各层详细信息')
    lines.append('')

    header = f'  {"层号":<4} {"类型":<8} {"大小":<12} {"指令"}'
    lines.append(header)
    lines.append('  ' + '-' * 66)

    for layer in image_meta.layers:
        if layer.empty_layer:
            size_str = '  (空层)'
        else:
            size_str = format_size(layer.size)

        instruction_short = layer.instruction
        args_short = layer.args[:50] + '...' if len(layer.args) > 50 else layer.args

        line = f'  {layer.index:<4} {instruction_short:<8} {size_str:<12} {args_short}'
        lines.append(line)

    return '\n'.join(lines)


def _generate_optimization_summary(detection_result, total_size):
    lines = []
    lines.append('💡 瘦身优化总结')
    lines.append('')

    total_savings = detection_result['total_estimated_savings']
    savings_percent = (total_savings / total_size * 100) if total_size > 0 else 0
    optimized_size = total_size - total_savings
    compression_ratio = (total_size / optimized_size) if optimized_size > 0 else 1
    remaining_percent = (optimized_size / total_size * 100) if total_size > 0 else 0

    lines.append(f'  发现优化点:     {detection_result["suggestion_count"]} 个')
    lines.append(f'  预估可节省:     {format_size(total_savings)} ({savings_percent:.2f}%)')
    lines.append(f'  优化后预估大小: {format_size(optimized_size)}')
    lines.append(f'  预估压缩比:     {compression_ratio:.2f}x (体积缩小为原来的 {remaining_percent:.1f}%)')

    category_stats = {}
    for s in detection_result['suggestions']:
        cat = s['category']
        if cat not in category_stats:
            category_stats[cat] = {'count': 0, 'savings': 0}
        category_stats[cat]['count'] += 1
        category_stats[cat]['savings'] += s['estimated_savings']

    if category_stats:
        lines.append('')
        lines.append('  按类别统计:')
        for cat, stats in sorted(category_stats.items(), key=lambda x: x[1]['savings'], reverse=True):
            cat_name = CATEGORY_NAMES.get(cat, cat)
            lines.append(
                f'    - {cat_name}: {stats["count"]} 个优化点, '
                f'可节省 {format_size(stats["savings"])}'
            )

    return '\n'.join(lines)


def _generate_optimization_details(detection_result):
    lines = []
    lines.append('📝 详细优化建议 (按节省空间排序)')
    lines.append('')

    for idx, suggestion in enumerate(detection_result['suggestions'], 1):
        severity_sym = SEVERITY_SYMBOLS.get(suggestion['severity'], '⚪')
        cat_name = CATEGORY_NAMES.get(suggestion['category'], suggestion['category'])

        lines.append(f'  {idx}. {severity_sym} [{cat_name}] {suggestion["title"]}')
        lines.append(f'     预估节省: {suggestion["estimated_savings_formatted"]}')
        lines.append(f'     严重程度: {suggestion["severity"]}')
        lines.append(f'     涉及层:   {", ".join(str(i) for i in suggestion["affected_layer_indices"])}')
        lines.append(f'     描述:     {suggestion["description"]}')
        lines.append('')

    return '\n'.join(lines)


def _generate_dockerfile_snippets(detection_result):
    lines = []
    lines.append('🔧 Dockerfile 优化建议片段')
    lines.append('')

    for idx, suggestion in enumerate(detection_result['suggestions'], 1):
        if suggestion['dockerfile_suggestion']:
            cat_name = CATEGORY_NAMES.get(suggestion['category'], suggestion['category'])
            lines.append(f'  [{idx}] {cat_name} - {suggestion["title"]}')
            lines.append('')
            lines.append('  ' + '~' * 66)

            for snippet_line in suggestion['dockerfile_suggestion'].split('\n'):
                lines.append(f'  {snippet_line}')

            lines.append('  ' + '~' * 66)
            lines.append('')

    return '\n'.join(lines)


def generate_json_report(image_meta, layer_analysis, detection_result):
    import json

    report = {
        'image': {
            'id': image_meta.id,
            'tags': image_meta.tags,
            'created': image_meta.created,
            'architecture': image_meta.architecture,
            'os': image_meta.os,
            'total_size': image_meta.total_size,
            'total_size_formatted': format_size(image_meta.total_size),
        },
        'layers': {
            'total_count': len(image_meta.layers),
            'non_empty_count': layer_analysis['non_empty_layer_count'],
            'details': [l.to_dict() for l in image_meta.layers],
        },
        'analysis': layer_analysis,
        'optimizations': detection_result,
        'summary': {
            'total_suggestions': detection_result['suggestion_count'],
            'total_estimated_savings': detection_result['total_estimated_savings'],
            'total_estimated_savings_formatted': detection_result['total_estimated_savings_formatted'],
            'savings_percent': (detection_result['total_estimated_savings'] / image_meta.total_size * 100)
                if image_meta.total_size > 0 else 0,
        }
    }

    return json.dumps(report, indent=2, ensure_ascii=False)
