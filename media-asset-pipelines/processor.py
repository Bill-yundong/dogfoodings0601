import os
from PIL import Image
from typing import Dict
from collector import Asset


class ImageProcessor:
    def __init__(self, variants_config: Dict, output_base_dir: str):
        self.variants = variants_config
        self.output_base_dir = os.path.abspath(output_base_dir)

    def _crop_center(self, img: Image.Image, target_w: int, target_h: int) -> Image.Image:
        src_w, src_h = img.size
        src_ratio = src_w / src_h
        target_ratio = target_w / target_h

        if src_ratio > target_ratio:
            new_h = src_h
            new_w = int(new_h * target_ratio)
            left = (src_w - new_w) // 2
            top = 0
        else:
            new_w = src_w
            new_h = int(new_w / target_ratio)
            left = 0
            top = (src_h - new_h) // 2

        img_cropped = img.crop((left, top, left + new_w, top + new_h))
        return img_cropped.resize((target_w, target_h), Image.LANCZOS)

    def _get_output_path(self, asset: Asset, variant_name: str) -> str:
        basename = os.path.basename(asset.file_path)
        name, ext = os.path.splitext(basename)
        if ext.lower() in ('.jpg', '.jpeg'):
            out_ext = '.jpg'
        else:
            out_ext = ext.lower()

        variant_dir = os.path.join(self.output_base_dir, variant_name)
        os.makedirs(variant_dir, exist_ok=True)
        return os.path.join(variant_dir, f"{name}_{asset.content_hash[:8]}{out_ext}")

    def process_asset(self, asset: Asset) -> Dict[str, str]:
        results: Dict[str, str] = {}

        with Image.open(asset.file_path) as img:
            img.load()
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')

            for variant_name, cfg in self.variants.items():
                try:
                    width = int(cfg['width'])
                    height = int(cfg['height'])
                    quality = int(cfg.get('quality', 85))

                    processed = self._crop_center(img, width, height)
                    out_path = self._get_output_path(asset, variant_name)

                    save_kwargs = {}
                    ext = os.path.splitext(out_path)[1].lower()
                    if ext in ('.jpg', '.jpeg'):
                        if processed.mode == 'RGBA':
                            background = Image.new('RGB', processed.size, (255, 255, 255))
                            background.paste(processed, mask=processed.split()[3])
                            processed = background
                        save_kwargs['quality'] = quality
                        save_kwargs['optimize'] = True
                    elif ext == '.png':
                        save_kwargs['optimize'] = True
                    elif ext == '.webp':
                        save_kwargs['quality'] = quality

                    processed.save(out_path, **save_kwargs)
                    results[variant_name] = out_path
                except Exception as e:
                    raise RuntimeError(
                        f"Failed to process variant '{variant_name}': {e}"
                    ) from e

        return results
