import os
import yaml
from PIL import Image
import pytest

from processor import ImageProcessor
from collector import Asset, Collector


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_resize_config():
    with open(os.path.join(PROJECT_ROOT, 'resize.yaml'), 'r') as f:
        return yaml.safe_load(f)


def make_image(path, size=(800, 600), color=(255, 0, 0)):
    img = Image.new('RGB', size, color)
    img.save(path, quality=95)


class TestProcessor:
    @pytest.fixture(autouse=True)
    def setup(self, tmp_path):
        self.tmp_path = tmp_path
        config = load_resize_config()
        self.variants = config['variants']
        self.processor = ImageProcessor(
            variants_config=self.variants,
            output_base_dir=str(tmp_path / "output")
        )

    def _make_asset(self, src_size, name, color=(255, 0, 0)):
        src_path = self.tmp_path / name
        make_image(src_path, size=src_size, color=color)
        content_hash = Collector.compute_hash(str(src_path))
        stat = os.stat(src_path)
        return Asset(
            file_path=str(src_path),
            content_hash=content_hash,
            file_size=stat.st_size,
            last_modified=stat.st_mtime
        )

    def test_landscape_source_three_variants_correct_size(self):
        asset = self._make_asset((3000, 2000), "landscape.jpg")
        results = self.processor.process_asset(asset)

        for vname, path in results.items():
            assert vname in self.variants
            with Image.open(path) as img:
                assert img.size == (self.variants[vname]['width'], self.variants[vname]['height'])

    def test_portrait_source_three_variants_correct_size(self):
        asset = self._make_asset((1200, 1800), "portrait.png")
        results = self.processor.process_asset(asset)

        for vname, path in results.items():
            assert vname in self.variants
            with Image.open(path) as img:
                assert img.size == (self.variants[vname]['width'], self.variants[vname]['height'])

    def test_square_source_three_variants_correct_size(self):
        asset = self._make_asset((1000, 1000), "square.webp")
        results = self.processor.process_asset(asset)

        for vname, path in results.items():
            assert vname in self.variants
            with Image.open(path) as img:
                assert img.size == (self.variants[vname]['width'], self.variants[vname]['height'])

    def test_variants_output_directory_structure(self):
        asset = self._make_asset((2000, 2000), "test.jpg")
        results = self.processor.process_asset(asset)

        for vname in self.variants:
            variant_dir = os.path.join(self.processor.output_base_dir, vname)
            assert os.path.isdir(variant_dir)

        assert os.path.basename(results['thumbnail']).endswith('.jpg')
        assert os.path.basename(results['medium']).endswith('.jpg')
        assert os.path.basename(results['large']).endswith('.jpg')

    def test_png_source_preserves_format(self):
        asset = self._make_asset((1000, 1000), "test.png")
        results = self.processor.process_asset(asset)

        for vname, path in results.items():
            assert path.endswith('.png')
            with Image.open(path) as img:
                assert img.format == 'PNG'

    def test_webp_source_preserves_format(self):
        asset = self._make_asset((1000, 1000), "test.webp")
        results = self.processor.process_asset(asset)

        for vname, path in results.items():
            assert path.endswith('.webp')

    def test_output_filename_includes_hash_prefix(self):
        asset = self._make_asset((1000, 1000), "mytest.jpg")
        results = self.processor.process_asset(asset)

        expected_suffix = f"_{asset.content_hash[:8]}.jpg"
        assert os.path.basename(results['thumbnail']).endswith(expected_suffix)
        assert os.path.basename(results['medium']).endswith(expected_suffix)
        assert os.path.basename(results['large']).endswith(expected_suffix)

    def test_all_expected_variants_present(self):
        asset = self._make_asset((1000, 1000), "test.jpg")
        results = self.processor.process_asset(asset)

        assert set(results.keys()) == {'thumbnail', 'medium', 'large'}

    def test_resize_yaml_specs_loaded(self):
        assert self.variants['thumbnail']['width'] == 150
        assert self.variants['thumbnail']['height'] == 150
        assert self.variants['medium']['width'] == 800
        assert self.variants['medium']['height'] == 600
        assert self.variants['large']['width'] == 1920
        assert self.variants['large']['height'] == 1080
