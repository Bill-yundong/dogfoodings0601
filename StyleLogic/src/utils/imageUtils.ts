import type { ColorData, MaterialData } from '../types';

const categoryEmojis: Record<string, string> = {
  top: '👕',
  bottom: '👖',
  outerwear: '🧥',
  dress: '👗',
  shoes: '👟',
  accessory: '👜',
};

const categoryNames: Record<string, string> = {
  top: '上衣',
  bottom: '下装',
  outerwear: '外套',
  dress: '连衣裙',
  shoes: '鞋履',
  accessory: '配饰',
};

export const generateProductImageUrl = (
  color: ColorData,
  material: MaterialData,
  category: string,
  name: string,
): string => {
  const prompt = [
    color.name,
    material.name,
    categoryNames[category] || category,
    name,
    '专业时尚产品摄影',
    '纯白色背景',
    '高清',
    '影棚灯光',
    color.description,
    material.description,
  ].join(', ');

  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=square_hd`;
};

export const generatePlaceholderSVG = (
  color: ColorData,
  material: MaterialData,
  category: string,
  _name: string,
): string => {
  const emoji = categoryEmojis[category] || '👔';
  const catName = categoryNames[category] || category;
  const hex = color.hex.replace('#', '');
  const darkerHex = adjustColorBrightness(hex, -30);
  const lighterHex = adjustColorBrightness(hex, 30);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#${lighterHex};stop-opacity:0.3" />
          <stop offset="50%" style="stop-color:#${hex};stop-opacity:0.15" />
          <stop offset="100%" style="stop-color:#${darkerHex};stop-opacity:0.3" />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.2"/>
        </filter>
      </defs>
      <rect width="400" height="400" fill="#fafafa"/>
      <rect width="400" height="400" fill="url(#bg)"/>
      <g filter="url(#shadow)" transform="translate(200, 160)">
        <text x="0" y="0" text-anchor="middle" font-size="80">${emoji}</text>
      </g>
      <g transform="translate(200, 260)">
        <rect x="-100" y="-15" width="200" height="30" rx="15" fill="rgba(255,255,255,0.9)"/>
        <text x="0" y="5" text-anchor="middle" font-size="14" font-weight="600" fill="#1f2937" font-family="-apple-system, sans-serif">${color.name} · ${material.name}</text>
      </g>
      <g transform="translate(200, 305)">
        <rect x="-60" y="-12" width="120" height="24" rx="12" fill="rgba(255,255,255,0.8)"/>
        <text x="0" y="4" text-anchor="middle" font-size="12" fill="#6b7280" font-family="-apple-system, sans-serif">${catName}</text>
      </g>
      <g transform="translate(200, 350)">
        <circle cx="-15" cy="0" r="12" fill="#${hex}" stroke="white" stroke-width="2"/>
        <text x="15" y="5" font-size="11" fill="#9ca3af" font-family="-apple-system, sans-serif">#${hex.toUpperCase()}</text>
      </g>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const adjustColorBrightness = (hex: string, percent: number): string => {
  const num = parseInt(hex, 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return (
    '000000' +
    ((R << 16) | (G << 8) | B).toString(16)
  ).slice(-6);
};

export const getCategoryEmoji = (category: string): string => {
  return categoryEmojis[category] || '👔';
};

export const getCategoryName = (category: string): string => {
  return categoryNames[category] || category;
};
