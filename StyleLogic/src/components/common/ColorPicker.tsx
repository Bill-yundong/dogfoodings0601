import type { RGB } from '../../types';
import { hexToRgb } from '../../utils/colorUtils';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (hex: string, rgb: RGB) => void;
  presetColors?: string[];
}

const defaultPresets = [
  '#F5DEB3', '#DEB887', '#D2B48C', '#BC8F5F', '#8B7355', '#5C4033',
  '#FAEBD7', '#FFE4C4', '#FFDAB9', '#FFE4B5', '#FFEFD5', '#FFF8DC',
];

export const ColorPicker = ({
  label,
  value,
  onChange,
  presetColors = defaultPresets,
}: ColorPickerProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    onChange(hex, hexToRgb(hex));
  };

  const handlePresetClick = (hex: string) => {
    onChange(hex, hexToRgb(hex));
  };

  return (
    <div className="color-picker">
      <label className="color-picker__label">{label}</label>
      <div className="color-picker__main">
        <div
          className="color-picker__preview"
          style={{ backgroundColor: value }}
        />
        <input
          type="color"
          value={value}
          onChange={handleChange}
          className="color-picker__input"
        />
        <span className="color-picker__hex">{value.toUpperCase()}</span>
      </div>
      <div className="color-picker__presets">
        {presetColors.map((color) => (
          <button
            key={color}
            type="button"
            className={`color-picker__preset ${value.toLowerCase() === color.toLowerCase() ? 'color-picker__preset--active' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => handlePresetClick(color)}
          />
        ))}
      </div>
    </div>
  );
};
