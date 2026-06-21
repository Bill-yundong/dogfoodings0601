import re
from utils import format_size


class OptimizationSuggestion:
    def __init__(self, category, title, description, estimated_savings,
                 severity='medium', dockerfile_suggestion='',
                 affected_layers=None):
        self.category = category
        self.title = title
        self.description = description
        self.estimated_savings = estimated_savings
        self.severity = severity
        self.dockerfile_suggestion = dockerfile_suggestion
        self.affected_layers = affected_layers or []

    def to_dict(self):
        return {
            'category': self.category,
            'title': self.title,
            'description': self.description,
            'estimated_savings': self.estimated_savings,
            'estimated_savings_formatted': format_size(self.estimated_savings),
            'severity': self.severity,
            'dockerfile_suggestion': self.dockerfile_suggestion,
            'affected_layers': [l.to_dict() for l in self.affected_layers],
            'affected_layer_indices': [l.index for l in self.affected_layers],
        }


BUILD_TOOLS_PATTERN = re.compile(
    r'\b(build-essential|gcc|g\+\+|make|cmake|autoconf|automake|'
    r'libtool|pkg-config|python3-dev|python-dev|musl-dev|'
    r'linux-headers|kernel-headers|glibc-dev)\b',
    re.IGNORECASE
)

PACKAGE_MANAGER_CACHE_PATTERNS = {
    'apt': {
        'install': re.compile(r'apt-get\s+install|apt\s+install', re.IGNORECASE),
        'update': re.compile(r'apt-get\s+update|apt\s+update', re.IGNORECASE),
        'clean': re.compile(r'apt-get\s+(clean|autoremove|purge)|rm\s+-rf\s+/var/lib/apt/lists|rm\s+-rf\s+/var/cache/apt', re.IGNORECASE),
        'cache_path': '/var/lib/apt/lists and /var/cache/apt/archives',
        'estimated_size_percent': 0.15,
    },
    'yum': {
        'install': re.compile(r'yum\s+install|dnf\s+install', re.IGNORECASE),
        'clean': re.compile(r'yum\s+clean|dnf\s+clean|rm\s+-rf\s+/var/cache/yum', re.IGNORECASE),
        'cache_path': '/var/cache/yum',
        'estimated_size_percent': 0.1,
    },
    'pip': {
        'install': re.compile(r'pip\s+install|pip3\s+install', re.IGNORECASE),
        'no_cache': re.compile(r'--no-cache-dir', re.IGNORECASE),
        'cache_path': 'pip cache',
        'estimated_size_percent': 0.1,
    },
    'npm': {
        'install': re.compile(r'npm\s+install', re.IGNORECASE),
        'clean': re.compile(r'npm\s+cache\s+clean|rm\s+-rf\s+node_modules/.cache', re.IGNORECASE),
        'cache_path': 'npm cache',
        'estimated_size_percent': 0.05,
    },
}

DEBUG_TOOLS_PATTERN = re.compile(
    r'\b(vim|nano|emacs|curl|wget|netcat|nc|telnet|strace|lsof|tcpdump|'
    r'gdb|valgrind|htop|iotop|iftop)\b',
    re.IGNORECASE
)


def detect_redundant_copy_layers(layers):
    suggestions = []
    non_empty_layers = [l for l in layers if not l.empty_layer]

    path_layers = {}
    for layer in non_empty_layers:
        if layer.instruction in ('COPY', 'ADD'):
            for path in layer.paths:
                if path not in path_layers:
                    path_layers[path] = []
                path_layers[path].append(layer)

    for path, layer_list in path_layers.items():
        if len(layer_list) >= 2:
            prev_sizes = sum(l.size for l in layer_list[:-1])
            suggestion = OptimizationSuggestion(
                category='redundant_copy',
                title=f'多次 {layer_list[0].instruction} 覆盖同一路径: {path}',
                description=(
                    f'在路径 {path} 上发现 {len(layer_list)} 次 {layer_list[0].instruction} 操作，'
                    f'前 {len(layer_list) - 1} 次的内容被后续层覆盖，造成空间浪费。'
                    f'涉及的层: {", ".join(str(l.index) for l in layer_list)}'
                ),
                estimated_savings=prev_sizes,
                severity='high' if prev_sizes > 10 * 1024 * 1024 else 'medium',
                dockerfile_suggestion=(
                    f'# 优化前（分层 COPY）\n'
                    f'COPY source1 {path}\n'
                    f'COPY source2 {path}\n\n'
                    f'# 优化后（合并为单次 COPY，或使用多阶段构建）\n'
                    f'COPY combined {path}\n'
                    f'# 或者使用多阶段构建复制最终产物'
                ),
                affected_layers=layer_list,
            )
            suggestions.append(suggestion)

    return suggestions


def detect_package_manager_cache(layers):
    suggestions = []
    non_empty_layers = [l for l in layers if not l.empty_layer]

    for pm_name, patterns in PACKAGE_MANAGER_CACHE_PATTERNS.items():
        install_layers = []
        has_clean = False

        for layer in non_empty_layers:
            if layer.instruction == 'RUN':
                args = layer.args
                if patterns['install'].search(args):
                    install_layers.append(layer)
                    if 'clean' in patterns and patterns['clean'].search(args):
                        has_clean = True
                    if pm_name == 'pip' and patterns['no_cache'].search(args):
                        has_clean = True

        if install_layers and not has_clean:
            total_install_size = sum(l.size for l in install_layers)
            estimated_savings = int(total_install_size * patterns['estimated_size_percent'])

            suggestion = OptimizationSuggestion(
                category='package_cache',
                title=f'{pm_name.upper()} 包管理器缓存未清理',
                description=(
                    f'检测到 {pm_name} 安装操作但未发现缓存清理步骤。'
                    f'包管理器缓存会占用额外空间，建议在同一 RUN 指令中清理缓存。'
                    f'涉及 {len(install_layers)} 个安装层。'
                ),
                estimated_savings=estimated_savings,
                severity='medium',
                dockerfile_suggestion=_get_cache_clean_suggestion(pm_name),
                affected_layers=install_layers,
            )
            suggestions.append(suggestion)

    return suggestions


def _get_cache_clean_suggestion(pm_name):
    if pm_name == 'apt':
        return (
            '# 优化前（未清理缓存）\n'
            'RUN apt-get update && \\\n'
            '    apt-get install -y package1 package2\n\n'
            '# 优化后（清理缓存）\n'
            'RUN apt-get update && \\\n'
            '    apt-get install -y package1 package2 && \\\n'
            '    rm -rf /var/lib/apt/lists/* && \\\n'
            '    apt-get clean'
        )
    elif pm_name == 'yum':
        return (
            '# 优化前（未清理缓存）\n'
            'RUN yum install -y package1 package2\n\n'
            '# 优化后（清理缓存）\n'
            'RUN yum install -y package1 package2 && \\\n'
            '    yum clean all && \\\n'
            '    rm -rf /var/cache/yum'
        )
    elif pm_name == 'pip':
        return (
            '# 优化前（有缓存）\n'
            'RUN pip install -r requirements.txt\n\n'
            '# 优化后（禁用缓存）\n'
            'RUN pip install --no-cache-dir -r requirements.txt'
        )
    elif pm_name == 'npm':
        return (
            '# 优化前（有缓存）\n'
            'RUN npm install\n\n'
            '# 优化后（清理缓存）\n'
            'RUN npm install && npm cache clean --force'
        )
    return ''


def detect_build_toolchain(layers):
    suggestions = []
    non_empty_layers = [l for l in layers if not l.empty_layer]

    build_tool_layers = []
    build_tools_found = set()

    for layer in non_empty_layers:
        if layer.instruction == 'RUN':
            args = layer.args
            if 'apt-get install' in args or 'apt install' in args or \
               'yum install' in args or 'dnf install' in args:
                matches = BUILD_TOOLS_PATTERN.findall(args)
                if matches:
                    build_tool_layers.append(layer)
                    build_tools_found.update(m.lower() for m in matches)

    if build_tool_layers:
        total_size = sum(l.size for l in build_tool_layers)
        estimated_savings = int(total_size * 0.6)

        suggestion = OptimizationSuggestion(
            category='build_toolchain',
            title='构建工具链残留 - 建议使用多阶段构建',
            description=(
                f'检测到构建工具链安装，包含: {", ".join(sorted(build_tools_found))}。'
                f'这些工具通常只在构建阶段需要，但最终镜像中会保留，增加镜像体积。'
                f'建议使用多阶段构建，在 builder 阶段编译，最终阶段只复制编译产物。'
            ),
            estimated_savings=estimated_savings,
            severity='high',
            dockerfile_suggestion=(
                '# 优化前（单阶段构建）\n'
                'FROM base-image\n'
                'RUN apt-get update && apt-get install -y build-essential gcc\n'
                'COPY . /app\n'
                'RUN make build\n'
                'CMD ["/app/app"]\n\n'
                '# 优化后（多阶段构建）\n'
                'FROM base-image AS builder\n'
                'RUN apt-get update && apt-get install -y build-essential gcc\n'
                'COPY . /app\n'
                'RUN make build\n\n'
                'FROM base-image AS final\n'
                'COPY --from=builder /app/app /app/app\n'
                'CMD ["/app/app"]'
            ),
            affected_layers=build_tool_layers,
        )
        suggestions.append(suggestion)

    return suggestions


def _extract_installed_packages(run_command):
    install_pattern = re.compile(
        r'(?:apt-get|apt|yum|dnf)\s+install\s+(?:-\S+\s+)*([^\n;&|]+)',
        re.IGNORECASE
    )

    packages = []
    for match in install_pattern.finditer(run_command):
        pkg_str = match.group(1).strip()
        for pkg in re.split(r'\s+', pkg_str):
            pkg = pkg.strip()
            if pkg and not pkg.startswith('-'):
                packages.append(pkg)
    return packages


def detect_debug_tools(layers):
    suggestions = []
    non_empty_layers = [l for l in layers if not l.empty_layer]

    debug_layers = []
    debug_tools_found = set()

    for layer in non_empty_layers:
        if layer.instruction == 'RUN':
            args = layer.args
            if 'apt-get install' in args or 'apt install' in args or \
               'yum install' in args or 'dnf install' in args:
                installed_packages = _extract_installed_packages(args)
                for pkg in installed_packages:
                    if DEBUG_TOOLS_PATTERN.fullmatch(pkg):
                        if layer not in debug_layers:
                            debug_layers.append(layer)
                        debug_tools_found.add(pkg.lower())

    if debug_layers:
        total_size = sum(l.size for l in debug_layers)
        estimated_savings = total_size

        suggestion = OptimizationSuggestion(
            category='debug_tools',
            title='生产镜像包含调试/诊断工具',
            description=(
                f'检测到生产镜像中安装了调试/诊断工具: {", ".join(sorted(debug_tools_found))}。'
                f'这些工具在生产环境中通常不需要，建议移除以减小镜像体积和攻击面。'
            ),
            estimated_savings=estimated_savings,
            severity='medium',
            dockerfile_suggestion=(
                '# 优化前（包含调试工具）\n'
                'RUN apt-get install -y vim curl wget telnet\n\n'
                '# 优化后（移除调试工具）\n'
                '# 如需调试可临时启动调试容器附加到目标容器'
            ),
            affected_layers=debug_layers,
        )
        suggestions.append(suggestion)

    return suggestions


def detect_chown_optimization(layers):
    suggestions = []
    non_empty_layers = [l for l in layers if not l.empty_layer]

    chown_layers = []
    for layer in non_empty_layers:
        if layer.instruction == 'RUN':
            args = layer.args
            if re.search(r'\bchown\s+-R\b', args):
                chown_layers.append(layer)

    if chown_layers:
        total_size = sum(l.size for l in chown_layers)
        estimated_savings = total_size

        suggestion = OptimizationSuggestion(
            category='chown_optimization',
            title='chown -R 产生额外层 - 建议使用 COPY --chown',
            description=(
                f'检测到使用 chown -R 修改文件权限的独立层。'
                f'chown -R 会复制所有文件并产生与原文件同样大小的新层，造成空间翻倍。'
                f'建议在 COPY 时直接使用 --chown 参数避免额外层。'
            ),
            estimated_savings=estimated_savings,
            severity='high',
            dockerfile_suggestion=(
                '# 优化前（chown 产生额外层）\n'
                'COPY . /app\n'
                'RUN chown -R node:node /app\n\n'
                '# 优化后（使用 COPY --chown）\n'
                'COPY --chown=node:node . /app'
            ),
            affected_layers=chown_layers,
        )
        suggestions.append(suggestion)

    return suggestions


def detect_npm_optimizations(layers):
    suggestions = []
    non_empty_layers = [l for l in layers if not l.empty_layer]

    npm_install_layers = []
    npm_build_layers = []
    has_node_modules_cleanup = False

    for layer in non_empty_layers:
        if layer.instruction == 'RUN':
            args = layer.args
            if re.search(r'\bnpm\s+install\b', args):
                npm_install_layers.append(layer)
            if re.search(r'\bnpm\s+run\s+build|\bnpm\s+build\b', args):
                npm_build_layers.append(layer)
            if re.search(r'rm\s+-rf\s+.*node_modules', args):
                has_node_modules_cleanup = True

    if npm_install_layers and not has_node_modules_cleanup:
        total_npm_size = sum(l.size for l in npm_install_layers)
        estimated_savings = int(total_npm_size * 0.5)

        suggestion = OptimizationSuggestion(
            category='npm_optimization',
            title='npm 依赖未清理 - 建议多阶段构建',
            description=(
                f'检测到 npm install 安装了大量依赖，但未发现 node_modules 清理或使用多阶段构建。'
                f'devDependencies 在生产环境中通常不需要，建议使用多阶段构建只保留生产依赖。'
            ),
            estimated_savings=estimated_savings,
            severity='high',
            dockerfile_suggestion=(
                '# 优化前（全部依赖保留）\n'
                'FROM node:18\n'
                'COPY . /app\n'
                'WORKDIR /app\n'
                'RUN npm install\n'
                'RUN npm run build\n'
                'CMD ["node", "dist/server.js"]\n\n'
                '# 优化后（多阶段构建 + 生产依赖）\n'
                'FROM node:18 AS builder\n'
                'COPY . /app\n'
                'WORKDIR /app\n'
                'RUN npm ci\n'
                'RUN npm run build\n\n'
                'FROM node:18-slim AS final\n'
                'COPY --from=builder /app/dist /app/dist\n'
                'COPY --from=builder /app/package.json /app/\n'
                'WORKDIR /app\n'
                'RUN npm ci --only=production\n'
                'CMD ["node", "dist/server.js"]'
            ),
            affected_layers=npm_install_layers + npm_build_layers,
        )
        suggestions.append(suggestion)

    return suggestions


def run_all_detections(layers):
    all_suggestions = []

    all_suggestions.extend(detect_redundant_copy_layers(layers))
    all_suggestions.extend(detect_package_manager_cache(layers))
    all_suggestions.extend(detect_build_toolchain(layers))
    all_suggestions.extend(detect_debug_tools(layers))
    all_suggestions.extend(detect_chown_optimization(layers))
    all_suggestions.extend(detect_npm_optimizations(layers))

    all_suggestions.sort(key=lambda s: s.estimated_savings, reverse=True)

    total_savings = sum(s.estimated_savings for s in all_suggestions)

    return {
        'suggestions': [s.to_dict() for s in all_suggestions],
        'suggestion_count': len(all_suggestions),
        'total_estimated_savings': total_savings,
        'total_estimated_savings_formatted': format_size(total_savings),
    }
