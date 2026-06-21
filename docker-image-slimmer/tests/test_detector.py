import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from detector import (
    detect_debug_tools,
    detect_package_manager_cache,
    _extract_installed_packages,
    DEBUG_TOOLS_PATTERN,
)
from parser import LayerInfo


def make_run_layer(index, command, size=1024):
    return LayerInfo(
        index=index,
        created='2024-01-01',
        created_by=f'/bin/sh -c {command}',
        size=size,
        empty_layer=False,
    )


class TestExtractInstalledPackages:
    def test_extract_simple_packages(self):
        cmd = 'apt-get install -y vim curl wget'
        pkgs = _extract_installed_packages(cmd)
        assert pkgs == ['vim', 'curl', 'wget']

    def test_extract_with_options(self):
        cmd = 'apt-get install -y --no-install-recommends vim curl'
        pkgs = _extract_installed_packages(cmd)
        assert pkgs == ['vim', 'curl']

    def test_extract_with_update_and_install(self):
        cmd = 'apt-get update && apt-get install -y vim curl'
        pkgs = _extract_installed_packages(cmd)
        assert pkgs == ['vim', 'curl']

    def test_extract_with_pipe_before_install(self):
        cmd = 'curl -fsSL https://example.com/setup.sh | bash - && apt-get install -y nodejs'
        pkgs = _extract_installed_packages(cmd)
        assert pkgs == ['nodejs']

    def test_extract_with_multiple_commands(self):
        cmd = 'apt-get install -y vim && apt-get install -y curl wget'
        pkgs = _extract_installed_packages(cmd)
        assert pkgs == ['vim', 'curl', 'wget']

    def test_extract_yum_packages(self):
        cmd = 'yum install -y vim curl'
        pkgs = _extract_installed_packages(cmd)
        assert pkgs == ['vim', 'curl']

    def test_extract_no_install(self):
        cmd = 'curl -fsSL https://example.com/file.tar.gz | tar xz'
        pkgs = _extract_installed_packages(cmd)
        assert pkgs == []

    def test_extract_with_version_suffix(self):
        cmd = 'apt-get install -y nodejs=18.17.0 npm'
        pkgs = _extract_installed_packages(cmd)
        assert pkgs == ['nodejs=18.17.0', 'npm']


class TestDebugToolsPattern:
    def test_pattern_matches_vim(self):
        assert DEBUG_TOOLS_PATTERN.fullmatch('vim') is not None
        assert DEBUG_TOOLS_PATTERN.fullmatch('VIM') is not None

    def test_pattern_matches_curl(self):
        assert DEBUG_TOOLS_PATTERN.fullmatch('curl') is not None

    def test_pattern_does_not_match_nodejs(self):
        assert DEBUG_TOOLS_PATTERN.fullmatch('nodejs') is None

    def test_pattern_does_not_match_substring(self):
        assert DEBUG_TOOLS_PATTERN.fullmatch('curlftpfs') is None
        assert DEBUG_TOOLS_PATTERN.fullmatch('vim-tiny') is None


class TestDetectDebugTools:
    def test_curl_download_not_reported(self):
        layers = [
            make_run_layer(
                0,
                'curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && apt-get install -y nodejs',
                size=89123456,
            ),
        ]

        suggestions = detect_debug_tools(layers)

        assert len(suggestions) == 0

    def test_apt_install_debug_tools_reported(self):
        layers = [
            make_run_layer(
                0,
                'apt-get install -y vim curl wget telnet',
                size=23456789,
            ),
        ]

        suggestions = detect_debug_tools(layers)

        assert len(suggestions) == 1
        assert suggestions[0].category == 'debug_tools'
        assert 'vim' in suggestions[0].description
        assert 'curl' in suggestions[0].description
        assert 'telnet' in suggestions[0].description
        assert 0 in [l.index for l in suggestions[0].affected_layers]

    def test_mixed_layers_only_reports_installed(self):
        layers = [
            make_run_layer(
                0,
                'curl -fsSL https://example.com/setup.sh | bash - && apt-get install -y nodejs',
                size=89123456,
            ),
            make_run_layer(
                1,
                'apt-get install -y vim curl',
                size=12345678,
            ),
        ]

        suggestions = detect_debug_tools(layers)

        assert len(suggestions) == 1
        assert suggestions[0].estimated_savings == 12345678
        assert 0 not in [l.index for l in suggestions[0].affected_layers]
        assert 1 in [l.index for l in suggestions[0].affected_layers]

    def test_no_debug_tools_no_suggestion(self):
        layers = [
            make_run_layer(
                0,
                'apt-get install -y nodejs python3',
                size=50000000,
            ),
        ]

        suggestions = detect_debug_tools(layers)

        assert len(suggestions) == 0

    def test_empty_layers_ignored(self):
        empty_layer = LayerInfo(
            index=0,
            created='2024-01-01',
            created_by='/bin/sh -c #(nop) ENV VERSION=1.0',
            size=0,
            empty_layer=True,
        )
        debug_layer = make_run_layer(
            1,
            'apt-get install -y vim',
            size=1024,
        )

        suggestions = detect_debug_tools([empty_layer, debug_layer])

        assert len(suggestions) == 1
        assert 1 in [l.index for l in suggestions[0].affected_layers]


class TestDetectPackageManagerCache:
    def test_apt_install_without_clean_triggers_alert(self):
        layers = [
            make_run_layer(
                0,
                'apt-get update && apt-get install -y package1 package2',
                size=100000000,
            ),
        ]

        suggestions = detect_package_manager_cache(layers)

        apt_suggestions = [s for s in suggestions if 'apt' in s.title.lower()]
        assert len(apt_suggestions) == 1
        assert apt_suggestions[0].category == 'package_cache'

    def test_apt_install_with_clean_in_same_run_no_alert(self):
        layers = [
            make_run_layer(
                0,
                'apt-get update && apt-get install -y package1 package2 && rm -rf /var/lib/apt/lists/* && apt-get clean',
                size=100000000,
            ),
        ]

        suggestions = detect_package_manager_cache(layers)

        apt_suggestions = [s for s in suggestions if 'apt' in s.title.lower()]
        assert len(apt_suggestions) == 0

    def test_apt_install_with_clean_in_separate_run_still_triggers(self):
        layers = [
            make_run_layer(
                0,
                'apt-get update && apt-get install -y package1',
                size=100000000,
            ),
            make_run_layer(
                1,
                'apt-get clean && rm -rf /var/lib/apt/lists/*',
                size=1024,
            ),
        ]

        suggestions = detect_package_manager_cache(layers)

        apt_suggestions = [s for s in suggestions if 'apt' in s.title.lower()]
        assert len(apt_suggestions) == 1

    def test_pip_install_with_no_cache_dir_no_alert(self):
        layers = [
            make_run_layer(
                0,
                'pip install --no-cache-dir -r requirements.txt',
                size=50000000,
            ),
        ]

        suggestions = detect_package_manager_cache(layers)

        pip_suggestions = [s for s in suggestions if 'pip' in s.title.lower()]
        assert len(pip_suggestions) == 0

    def test_pip_install_without_no_cache_triggers_alert(self):
        layers = [
            make_run_layer(
                0,
                'pip install -r requirements.txt',
                size=50000000,
            ),
        ]

        suggestions = detect_package_manager_cache(layers)

        pip_suggestions = [s for s in suggestions if 'pip' in s.title.lower()]
        assert len(pip_suggestions) == 1

    def test_npm_install_with_clean_no_alert(self):
        layers = [
            make_run_layer(
                0,
                'npm install && npm cache clean --force',
                size=200000000,
            ),
        ]

        suggestions = detect_package_manager_cache(layers)

        npm_suggestions = [s for s in suggestions if 'npm' in s.title.lower()]
        assert len(npm_suggestions) == 0

    def test_npm_install_without_clean_triggers_alert(self):
        layers = [
            make_run_layer(
                0,
                'npm install',
                size=200000000,
            ),
        ]

        suggestions = detect_package_manager_cache(layers)

        npm_suggestions = [s for s in suggestions if 'npm' in s.title.lower()]
        assert len(npm_suggestions) == 1

    def test_yum_install_with_clean_no_alert(self):
        layers = [
            make_run_layer(
                0,
                'yum install -y package1 && yum clean all && rm -rf /var/cache/yum',
                size=50000000,
            ),
        ]

        suggestions = detect_package_manager_cache(layers)

        yum_suggestions = [s for s in suggestions if 'yum' in s.title.lower()]
        assert len(yum_suggestions) == 0

    def test_estimated_savings_calculation(self):
        layers = [
            make_run_layer(
                0,
                'apt-get install -y package1',
                size=100000000,
            ),
        ]

        suggestions = detect_package_manager_cache(layers)

        apt_suggestions = [s for s in suggestions if 'apt' in s.title.lower()]
        assert len(apt_suggestions) == 1
        assert apt_suggestions[0].estimated_savings == int(100000000 * 0.15)
