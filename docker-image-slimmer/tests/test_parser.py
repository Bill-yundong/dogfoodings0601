import sys
import os
import json
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from parser import (
    parse_image_meta,
    analyze_layer_relationships,
    _is_subpath,
    LayerInfo,
    ImageMetadata,
)


SAMPLE_IMAGE_DATA = {
    'Id': 'sha256:test123',
    'RepoTags': ['test:latest'],
    'Created': '2024-01-15T10:30:00Z',
    'Size': 123456789,
    'VirtualSize': 123456789,
    'Architecture': 'amd64',
    'Os': 'linux',
    'Config': {},
    'History': [
        {
            'created': '2024-01-01T00:00:00Z',
            'created_by': '/bin/sh -c #(nop) ADD file:base in /',
            'empty_layer': False,
            'size': 75123456,
        },
        {
            'created': '2024-01-02T00:00:00Z',
            'created_by': '/bin/sh -c #(nop) COPY dir:source in /app',
            'empty_layer': False,
            'size': 12345678,
        },
    ],
}


class TestIsSubpath:
    def test_exact_match(self):
        assert _is_subpath('/app', '/app') is True
        assert _is_subpath('/app/', '/app') is True
        assert _is_subpath('/app', '/app/') is True
        assert _is_subpath('/app/', '/app/') is True

    def test_parent_child_relationship(self):
        assert _is_subpath('/app/config', '/app') is True
        assert _is_subpath('/app/config/config.json', '/app') is True
        assert _is_subpath('/app/config/subdir/file.txt', '/app') is True
        assert _is_subpath('/usr/local/bin', '/usr') is True

    def test_not_subpath_with_trailing_slashes(self):
        assert _is_subpath('/app/config/', '/app/') is True
        assert _is_subpath('/app/config/config.json', '/app/') is True

    def test_unrelated_paths(self):
        assert _is_subpath('/app', '/etc') is False
        assert _is_subpath('/app/config', '/application') is False
        assert _is_subpath('/usr/local', '/usr/lib') is False

    def test_partial_match_not_subpath(self):
        assert _is_subpath('/application', '/app') is False
        assert _is_subpath('/app2', '/app') is False
        assert _is_subpath('/app-config', '/app') is False

    def test_child_is_parent_reversed(self):
        assert _is_subpath('/app', '/app/config') is False
        assert _is_subpath('/app', '/app/config/config.json') is False

    def test_empty_paths(self):
        assert _is_subpath('/', '/') is True
        assert _is_subpath('/app', '/') is True
        assert _is_subpath('/', '/app') is False


class TestParseImageMeta:
    def test_json_array_format(self, tmp_path):
        json_file = tmp_path / 'array.json'
        json_file.write_text(json.dumps([SAMPLE_IMAGE_DATA]))

        meta = parse_image_meta(str(json_file))

        assert meta.id == 'sha256:test123'
        assert meta.tags == ['test:latest']
        assert meta.total_size == 123456789
        assert len(meta.layers) == 2
        assert meta.layers[0].instruction == 'ADD'
        assert meta.layers[1].instruction == 'COPY'

    def test_json_single_object_format(self, tmp_path):
        json_file = tmp_path / 'single.json'
        json_file.write_text(json.dumps(SAMPLE_IMAGE_DATA))

        meta = parse_image_meta(str(json_file))

        assert meta.id == 'sha256:test123'
        assert meta.tags == ['test:latest']
        assert meta.total_size == 123456789
        assert len(meta.layers) == 2

    def test_file_not_found(self, tmp_path):
        non_existent = tmp_path / 'nonexistent.json'

        with pytest.raises(FileNotFoundError) as exc_info:
            parse_image_meta(str(non_existent))

        assert 'Image metadata file not found' in str(exc_info.value)

    def test_empty_json_array(self, tmp_path):
        json_file = tmp_path / 'empty.json'
        json_file.write_text('[]')

        with pytest.raises(ValueError) as exc_info:
            parse_image_meta(str(json_file))

        assert 'Empty image metadata file' in str(exc_info.value)

    def test_parse_layer_info(self, tmp_path):
        json_file = tmp_path / 'test.json'
        json_file.write_text(json.dumps([SAMPLE_IMAGE_DATA]))

        meta = parse_image_meta(str(json_file))

        layer0 = meta.layers[0]
        assert layer0.index == 0
        assert layer0.instruction == 'ADD'
        assert layer0.size == 75123456
        assert layer0.empty_layer is False
        assert '/' in layer0.paths

        layer1 = meta.layers[1]
        assert layer1.index == 1
        assert layer1.instruction == 'COPY'
        assert '/app' in layer1.paths

    def test_parse_empty_layer(self, tmp_path):
        data = dict(SAMPLE_IMAGE_DATA)
        data['History'] = [
            {
                'created': '2024-01-01T00:00:00Z',
                'created_by': '/bin/sh -c #(nop) ENV VERSION=1.0',
                'empty_layer': True,
                'size': 0,
            }
        ]
        json_file = tmp_path / 'empty_layer.json'
        json_file.write_text(json.dumps([data]))

        meta = parse_image_meta(str(json_file))

        assert len(meta.layers) == 1
        assert meta.layers[0].empty_layer is True
        assert meta.layers[0].instruction == 'ENV'


class TestAnalyzeLayerRelationships:
    def test_overlapping_paths_exact_match(self):
        layers = [
            LayerInfo(
                index=0,
                created='2024-01-01',
                created_by='/bin/sh -c #(nop) COPY dir:v1 in /app',
                size=1024,
                empty_layer=False,
            ),
            LayerInfo(
                index=1,
                created='2024-01-02',
                created_by='/bin/sh -c #(nop) COPY dir:v2 in /app',
                size=2048,
                empty_layer=False,
            ),
        ]

        result = analyze_layer_relationships(layers)

        assert result['overlapping_path_count'] >= 1
        assert '/app' in str(result['overlapping_paths'])

    def test_overlapping_paths_parent_child(self):
        layers = [
            LayerInfo(
                index=0,
                created='2024-01-01',
                created_by='/bin/sh -c #(nop) COPY dir:app in /app',
                size=1024,
                empty_layer=False,
            ),
            LayerInfo(
                index=1,
                created='2024-01-02',
                created_by='/bin/sh -c #(nop) COPY file:conf in /app/config/config.json',
                size=512,
                empty_layer=False,
            ),
        ]

        result = analyze_layer_relationships(layers)

        assert result['overlapping_path_count'] >= 1
        has_parent_child = any(
            '覆盖子路径' in key for key in result['overlapping_paths'].keys()
        )
        assert has_parent_child is True

    def test_no_overlapping_paths(self):
        layers = [
            LayerInfo(
                index=0,
                created='2024-01-01',
                created_by='/bin/sh -c #(nop) COPY dir:app in /app',
                size=1024,
                empty_layer=False,
            ),
            LayerInfo(
                index=1,
                created='2024-01-02',
                created_by='/bin/sh -c #(nop) COPY dir:etc in /etc/config',
                size=512,
                empty_layer=False,
            ),
        ]

        result = analyze_layer_relationships(layers)

        assert result['overlapping_path_count'] == 0

    def test_empty_layers_are_ignored(self):
        layers = [
            LayerInfo(
                index=0,
                created='2024-01-01',
                created_by='/bin/sh -c #(nop) COPY dir:app in /app',
                size=1024,
                empty_layer=False,
            ),
            LayerInfo(
                index=1,
                created='2024-01-02',
                created_by='/bin/sh -c #(nop) ENV VERSION=1.0',
                size=0,
                empty_layer=True,
            ),
        ]

        result = analyze_layer_relationships(layers)

        assert result['non_empty_layer_count'] == 1
        assert result['total_size'] == 1024
