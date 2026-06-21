import json
import os
from utils import format_size, parse_dockerfile_instruction


class LayerInfo:
    def __init__(self, index, created, created_by, size, empty_layer=False):
        self.index = index
        self.created = created
        self.created_by = created_by
        self.size = size
        self.empty_layer = empty_layer
        self.instruction, self.args = parse_dockerfile_instruction(created_by)
        self.paths = self._extract_paths()

    def _extract_paths(self):
        paths = []
        if self.instruction == 'COPY' or self.instruction == 'ADD':
            args = self.args
            if 'in ' in args:
                parts = args.rsplit('in ', 1)
                if len(parts) == 2:
                    dest = parts[1].strip()
                    paths.append(dest)
            elif ' -> ' in args:
                parts = args.rsplit(' -> ', 1)
                if len(parts) == 2:
                    dest = parts[1].strip()
                    paths.append(dest)
        elif self.instruction == 'RUN':
            pass
        return paths

    def to_dict(self):
        return {
            'index': self.index,
            'instruction': self.instruction,
            'args': self.args,
            'size': self.size,
            'size_formatted': format_size(self.size),
            'created': self.created,
            'empty_layer': self.empty_layer,
            'paths': self.paths,
        }


class ImageMetadata:
    def __init__(self):
        self.id = ''
        self.tags = []
        self.created = ''
        self.total_size = 0
        self.virtual_size = 0
        self.layers = []
        self.architecture = ''
        self.os = ''
        self.config = {}

    def summary(self):
        return {
            'id': self.id,
            'tags': self.tags,
            'created': self.created,
            'total_size': self.total_size,
            'total_size_formatted': format_size(self.total_size),
            'virtual_size': self.virtual_size,
            'virtual_size_formatted': format_size(self.virtual_size),
            'layer_count': len(self.layers),
            'non_empty_layers': len([l for l in self.layers if not l.empty_layer]),
            'architecture': self.architecture,
            'os': self.os,
        }


def parse_image_meta(file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f'Image metadata file not found: {file_path}')

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if isinstance(data, list):
        if len(data) == 0:
            raise ValueError('Empty image metadata file')
        image_data = data[0]
    else:
        image_data = data

    meta = ImageMetadata()
    meta.id = image_data.get('Id', '')
    meta.tags = image_data.get('RepoTags', [])
    meta.created = image_data.get('Created', '')
    meta.total_size = image_data.get('Size', 0)
    meta.virtual_size = image_data.get('VirtualSize', 0)
    meta.architecture = image_data.get('Architecture', '')
    meta.os = image_data.get('Os', '')
    meta.config = image_data.get('Config', {})

    history = image_data.get('History', [])
    for idx, layer_data in enumerate(history):
        layer = LayerInfo(
            index=idx,
            created=layer_data.get('created', ''),
            created_by=layer_data.get('created_by', ''),
            size=layer_data.get('size', 0),
            empty_layer=layer_data.get('empty_layer', False),
        )
        meta.layers.append(layer)

    return meta


def analyze_layer_relationships(layers):
    non_empty_layers = [l for l in layers if not l.empty_layer]
    total_size = sum(l.size for l in non_empty_layers)

    copy_layers = []
    add_layers = []
    run_layers = []

    for layer in non_empty_layers:
        if layer.instruction == 'COPY':
            copy_layers.append(layer)
        elif layer.instruction == 'ADD':
            add_layers.append(layer)
        elif layer.instruction == 'RUN':
            run_layers.append(layer)

    path_coverage = {}
    for layer in non_empty_layers:
        for path in layer.paths:
            if path not in path_coverage:
                path_coverage[path] = []
            path_coverage[path].append(layer)

    overlapping_paths = {}
    for path, layer_list in path_coverage.items():
        if len(layer_list) > 1:
            overlapping_paths[path] = layer_list

    return {
        'total_size': total_size,
        'total_size_formatted': format_size(total_size),
        'non_empty_layer_count': len(non_empty_layers),
        'copy_layer_count': len(copy_layers),
        'add_layer_count': len(add_layers),
        'run_layer_count': len(run_layers),
        'copy_layers': [l.to_dict() for l in copy_layers],
        'overlapping_paths': {
            path: [l.to_dict() for l in layers]
            for path, layers in overlapping_paths.items()
        },
        'overlapping_path_count': len(overlapping_paths),
    }
