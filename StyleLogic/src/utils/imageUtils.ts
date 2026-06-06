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
  const catName = categoryNames[category] || category;
  const prompt = `${color.name}${material.name}${catName},${name},时尚产品摄影,纯白背景,高清,影棚灯光,${color.hex}`;

  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=square_hd`;
};

const generateCategoryShape = (category: string, hex: string): string => {
  const darker = adjustColorBrightness(hex, -15);
  const lighter = adjustColorBrightness(hex, 20);
  
  switch (category) {
    case 'top':
      return `
        <path d="M-80,-80 L-60,-100 L60,-100 L80,-80 L65,-60 L65,60 L-65,60 L-65,-60 Z" 
              fill="url(#productGradient)" stroke="#${darker}" stroke-width="2"/>
        <path d="M-30,-80 L0,-50 L30,-80" fill="none" stroke="#${darker}" stroke-width="2"/>
      `;
    case 'bottom':
      return `
        <path d="M-70,-80 L70,-80 L60,80 L10,80 L0,-20 L-10,80 L-60,80 Z" 
              fill="url(#productGradient)" stroke="#${darker}" stroke-width="2"/>
        <line x1="0" y1="-80" x2="0" y2="-20" stroke="#${darker}" stroke-width="1"/>
      `;
    case 'outerwear':
      return `
        <path d="M-90,-70 L-70,-90 L70,-90 L90,-70 L75,-50 L75,70 L-75,70 L-75,-50 Z" 
              fill="url(#productGradient)" stroke="#${darker}" stroke-width="2"/>
        <path d="M-20,-70 L0,-40 L20,-70" fill="none" stroke="#${darker}" stroke-width="2"/>
        <line x1="0" y1="-40" x2="0" y2="70" stroke="#${darker}" stroke-width="1"/>
        <circle cx="-55" cy="-30" r="4" fill="#${darker}"/>
        <circle cx="-55" cy="0" r="4" fill="#${darker}"/>
        <circle cx="-55" cy="30" r="4" fill="#${darker}"/>
      `;
    case 'dress':
      return `
        <path d="M-50,-80 L-30,-95 L30,-95 L50,-80 L45,-60 L70,80 L-70,80 L-45,-60 Z" 
              fill="url(#productGradient)" stroke="#${darker}" stroke-width="2"/>
        <path d="M-15,-80 L0,-60 L15,-80" fill="none" stroke="#${darker}" stroke-width="2"/>
        <path d="M-60,0 Q0,20 60,0" fill="none" stroke="#${lighter}" stroke-width="2" opacity="0.5"/>
      `;
    case 'shoes':
      return `
        <path d="M-70,20 Q-70,-10 -40,-20 L-20,-40 L40,-40 L60,-20 Q75,-10 75,20 L75,40 L-75,40 Z" 
              fill="url(#productGradient)" stroke="#${darker}" stroke-width="2"/>
        <ellipse cx="0" cy="40" rx="75" ry="8" fill="#${darker}"/>
        <line x1="-30" y1="-20" x2="-30" y2="20" stroke="#${darker}" stroke-width="1"/>
        <line x1="0" y1="-30" x2="0" y2="20" stroke="#${darker}" stroke-width="1"/>
        <line x1="30" y1="-20" x2="30" y2="20" stroke="#${darker}" stroke-width="1"/>
      `;
    case 'accessory':
      return `
        <ellipse cx="0" cy="0" rx="80" ry="60" fill="url(#productGradient)" stroke="#${darker}" stroke-width="2"/>
        <ellipse cx="0" cy="0" rx="50" ry="35" fill="none" stroke="#${lighter}" stroke-width="2" opacity="0.6"/>
        <circle cx="0" cy="-55" r="8" fill="#${darker}"/>
        <path d="M-70,0 Q-70,-30 -40,-40" fill="none" stroke="#${darker}" stroke-width="3"/>
        <path d="M70,0 Q70,-30 40,-40" fill="none" stroke="#${darker}" stroke-width="3"/>
      `;
    default:
      return `<rect x="-75" y="-75" width="150" height="150" rx="15" fill="url(#productGradient)" stroke="#${darker}" stroke-width="2"/>`;
  }
};

export const generatePlaceholderSVG = (
  color: ColorData,
  material: MaterialData,
  category: string,
  name: string,
): string => {
  const emoji = categoryEmojis[category] || '👔';
  const catName = categoryNames[category] || category;
  const hex = color.hex.replace('#', '');
  const darkerHex = adjustColorBrightness(hex, -25);
  const lighterHex = adjustColorBrightness(hex, 35);
  const midHex = adjustColorBrightness(hex, 10);

  const texturePattern = generateMaterialTexture(material);
  const categoryShape = generateCategoryShape(category, hex);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff" />
          <stop offset="100%" style="stop-color:#f8f9fa" />
        </linearGradient>
        <linearGradient id="productGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#${lighterHex}" />
          <stop offset="50%" style="stop-color:#${midHex}" />
          <stop offset="100%" style="stop-color:#${darkerHex}" />
        </linearGradient>
        <radialGradient id="highlight" cx="30%" cy="30%" r="70%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.5" />
          <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0" />
        </radialGradient>
        <filter id="productShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#${hex}" flood-opacity="0.25"/>
        </filter>
        <filter id="softShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.15"/>
        </filter>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        ${texturePattern}
      </defs>
      
      <rect width="400" height="400" fill="url(#bgGradient)"/>
      
      <g transform="translate(200, 170)">
        <g filter="url(#productShadow)">
          ${categoryShape}
          <g opacity="0.4">
            ${categoryShape.replace(/fill="url\(#productGradient\)"/g, 'fill="url(#texturePattern)"')}
          </g>
          <g opacity="0.3">
            ${categoryShape.replace(/fill="url\(#productGradient\)"/g, 'fill="url(#highlight)"')}
          </g>
        </g>
        
        <g filter="url(#glow)" transform="translate(0, -5)">
          <text x="0" y="15" text-anchor="middle" font-size="56" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.25))">${emoji}</text>
        </g>
      </g>
      
      <g transform="translate(200, 300)">
        <rect x="-140" y="-28" width="280" height="56" rx="28" fill="rgba(255,255,255,0.98)" filter="url(#softShadow)"/>
        <text x="0" y="-2" text-anchor="middle" font-size="11" font-weight="500" fill="#6b7280" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">${name}</text>
        <text x="0" y="16" text-anchor="middle" font-size="13" font-weight="600" fill="#1f2937" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">${color.name} · ${material.name}</text>
      </g>
      
      <g transform="translate(200, 365)">
        <circle cx="-70" cy="0" r="15" fill="#${hex}" stroke="white" stroke-width="3" filter="url(#softShadow)"/>
        <text x="-45" y="5" text-anchor="start" font-size="11" font-weight="600" fill="#374151" font-family="-apple-system, sans-serif">#${hex.toUpperCase()}</text>
        <rect x="25" y="-13" width="80" height="26" rx="13" fill="#${lighterHex}" opacity="0.3"/>
        <text x="65" y="5" text-anchor="middle" font-size="11" font-weight="600" fill="#1f2937" font-family="-apple-system, sans-serif">${catName}</text>
      </g>
      
      <g transform="translate(20, 20)">
        <rect width="60" height="24" rx="12" fill="rgba(255,255,255,0.9)" filter="url(#softShadow)"/>
        <text x="30" y="16" text-anchor="middle" font-size="10" font-weight="600" fill="#6b7280" font-family="-apple-system, sans-serif">StyleLogic</text>
      </g>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const generateMaterialTexture = (material: MaterialData): string => {
  const textureId = 'texturePattern';
  
  switch (material.name) {
    case '牛仔布':
      return `
        <pattern id="${textureId}" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="transparent"/>
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
          <line x1="0" y1="0" x2="8" y2="0" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>
        </pattern>
      `;
    case '针织':
    case '羊毛':
      return `
        <pattern id="${textureId}" patternUnits="userSpaceOnUse" width="6" height="6">
          <rect width="6" height="6" fill="transparent"/>
          <circle cx="3" cy="3" r="1" fill="rgba(255,255,255,0.2)"/>
        </pattern>
      `;
    case '亚麻':
    case '纯棉':
      return `
        <pattern id="${textureId}" patternUnits="userSpaceOnUse" width="4" height="4">
          <rect width="4" height="4" fill="transparent"/>
          <line x1="0" y1="0" x2="4" y2="4" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
        </pattern>
      `;
    case '真丝':
    case '雪纺':
    case '缎面':
      return `
        <linearGradient id="${textureId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgba(255,255,255,0.3)" />
          <stop offset="50%" style="stop-color:rgba(255,255,255,0)" />
          <stop offset="100%" style="stop-color:rgba(255,255,255,0.2)" />
        </linearGradient>
      `;
    case '皮革':
      return `
        <pattern id="${textureId}" patternUnits="userSpaceOnUse" width="10" height="10">
          <rect width="10" height="10" fill="transparent"/>
          <circle cx="2" cy="2" r="0.5" fill="rgba(0,0,0,0.15)"/>
          <circle cx="7" cy="5" r="0.4" fill="rgba(0,0,0,0.1)"/>
          <circle cx="4" cy="8" r="0.3" fill="rgba(0,0,0,0.12)"/>
        </pattern>
      `;
    default:
      return `
        <pattern id="${textureId}" patternUnits="userSpaceOnUse" width="1" height="1">
          <rect width="1" height="1" fill="transparent"/>
        </pattern>
      `;
  }
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
