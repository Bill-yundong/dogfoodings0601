import type { ClothingItem, Product } from '../types';
import { allColors } from './colorDatabase';
import { materialDatabase } from './materialDatabase';

const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const clothingNames: Record<ClothingItem['category'], string[]> = {
  top: [
    '白色纯棉T恤',
    '蓝色条纹衬衫',
    '黑色针织毛衣',
    '粉色真丝 blouse',
    '灰色连帽卫衣',
    '米色亚麻衬衫',
    '红色圆领针织衫',
    '牛仔外套',
    '黑色西装外套',
    '印花雪纺上衣',
  ],
  bottom: [
    '蓝色经典牛仔裤',
    '黑色西装裤',
    '卡其色休闲裤',
    '米色亚麻阔腿裤',
    '黑色皮质短裙',
    '灰色针织运动裤',
    '碎花雪纺长裙',
    '白色百褶裙',
    '红色缎面半裙',
    '藏青色直筒裤',
  ],
  outerwear: [
    '黑色皮革夹克',
    '驼色毛呢大衣',
    '灰色连帽风衣',
    '白色羽绒服',
    '蓝色牛仔外套',
    '米色针织开衫',
    '黑色西装外套',
    '军绿色工装外套',
  ],
  dress: [
    '红色真丝连衣裙',
    '黑色针织连衣裙',
    '碎花雪纺长裙',
    '白色亚麻吊带裙',
    '蓝色牛仔连衣裙',
    '黑色缎面晚礼服',
    '粉色针织连衣裙',
    '格纹羊毛连衣裙',
  ],
  shoes: [
    '白色运动鞋',
    '黑色高跟鞋',
    '棕色皮革乐福鞋',
    '米色平底凉鞋',
    '黑色短靴',
    '白色帆布鞋',
    '红色缎面高跟鞋',
    '灰色休闲鞋',
  ],
  accessory: [
    '金色项链',
    '皮革手提包',
    '丝绸围巾',
    '羊毛针织帽',
    '银色耳环',
    '帆布双肩包',
    '真丝发带',
    '皮质腰带',
  ],
};

export const generateMockWardrobe = (count: number = 30): ClothingItem[] => {
  const categories: ClothingItem['category'][] = [
    'top',
    'bottom',
    'outerwear',
    'dress',
    'shoes',
    'accessory',
  ];
  const styles: ClothingItem['style'][] = [
    'casual',
    'formal',
    'business',
    'sporty',
    'elegant',
    'bohemian',
    'minimalist',
    'streetwear',
  ];
  const seasons: ('spring' | 'summer' | 'autumn' | 'winter')[] = [
    'spring',
    'summer',
    'autumn',
    'winter',
  ];
  const occasions = ['daily', 'work', 'party', 'travel', 'date', 'formal'];

  const items: ClothingItem[] = [];

  for (let i = 0; i < count; i++) {
    const category = getRandomItem(categories);
    const nameList = clothingNames[category];
    const name = nameList[i % nameList.length] || `${category} ${i + 1}`;
    const color = getRandomItem(allColors);
    const material = getRandomItem(materialDatabase);
    const seasonCount = Math.floor(Math.random() * 2) + 1;
    const itemSeasons = [...new Set(Array.from({ length: seasonCount }, () => getRandomItem(seasons)))];
    const occasionCount = Math.floor(Math.random() * 3) + 1;
    const itemOccasions = [...new Set(Array.from({ length: occasionCount }, () => getRandomItem(occasions)))];

    items.push({
      id: generateId(),
      name,
      category,
      style: getRandomItem(styles),
      color,
      material,
      size: getRandomItem(['XS', 'S', 'M', 'L', 'XL', 'XXL']),
      brand: ['ZARA', 'H&M', 'UNIQLO', 'GUCCI', 'CHANEL', 'NIKE', 'ADIDAS'][Math.floor(Math.random() * 7)],
      imageUrl: `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(`fashion ${category} ${name} ${color.name} ${material.name} clothing product photo, white background, high quality`)}&image_size=square_hd`,
      description: `高品质${material.name}${name}，${color.description}`,
      seasonality: itemSeasons,
      occasions: itemOccasions,
      price: Math.floor(Math.random() * 1000) + 100,
      isOwned: true,
      purchasedAt: Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000),
      addedToWardrobeAt: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
      lastWornAt: Math.random() > 0.3
        ? Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
        : undefined,
      wearCount: Math.floor(Math.random() * 50),
      tags: [category, material.category, color.seasonalType, ...itemOccasions],
    });
  }

  return items;
};

export const generateMockProducts = (count: number = 20): Product[] => {
  const categories = ['上衣', '下装', '外套', '连衣裙', '鞋履', '配饰'];
  const styles = ['休闲', '正式', '商务', '运动', '优雅', '波西米亚', '极简', '街头'];
  const brands = ['ZARA', 'H&M', 'UNIQLO', 'GUCCI', 'CHANEL', 'NIKE', 'ADIDAS', 'LV', 'DIOR'];
  const seasons = ['spring', 'summer', 'autumn', 'winter'];
  const occasions = ['daily', 'work', 'party', 'travel', 'date', 'formal'];

  const products: Product[] = [];

  const productNames = [
    '经典款棉质T恤',
    '真丝印花衬衫',
    '羊毛混纺针织衫',
    '亚麻休闲西装',
    '缎面吊带背心',
    '雪纺飘逸上衣',
    '皮革机车夹克',
    '毛呢修身大衣',
    '牛仔直筒裤',
    '西装阔腿裤',
    '针织休闲运动裤',
    '皮质铅笔裙',
    '雪纺碎花长裙',
    '缎面中长半身裙',
    '真丝连衣裙',
    '针织修身连衣裙',
    '牛仔吊带连衣裙',
    '羊毛格纹连衣裙',
    '真皮高跟鞋',
    '帆布运动鞋',
    '皮革乐福鞋',
    '绸缎平底凉鞋',
    '真皮短靴',
    '金色装饰项链',
    '真皮手提包',
    '真丝印花围巾',
    '羊毛针织帽',
    '银色垂坠耳环',
  ];

  for (let i = 0; i < count; i++) {
    const name = productNames[i % productNames.length];
    const colorCount = Math.floor(Math.random() * 3) + 1;
    const colors = [...new Set(Array.from({ length: colorCount }, () => getRandomItem(allColors)))];
    const materialCount = Math.floor(Math.random() * 2) + 1;
    const materials = [...new Set(Array.from({ length: materialCount }, () => getRandomItem(materialDatabase)))];
    const seasonCount = Math.floor(Math.random() * 2) + 1;
    const productSeasons = [...new Set(Array.from({ length: seasonCount }, () => getRandomItem(seasons)))];
    const occasionCount = Math.floor(Math.random() * 3) + 1;
    const productOccasions = [...new Set(Array.from({ length: occasionCount }, () => getRandomItem(occasions)))];
    const originalPrice = Math.floor(Math.random() * 2000) + 500;
    const hasDiscount = Math.random() > 0.5;

    products.push({
      id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description: `采用优质${materials.map((m) => m.name).join('、')}面料，${colors[0]?.description || ''}，适合多种场合穿着`,
      price: hasDiscount ? Math.floor(originalPrice * 0.7) : originalPrice,
      originalPrice: hasDiscount ? originalPrice : undefined,
      currency: 'CNY',
      images: Array.from({ length: 4 }, (_, idx) => `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(`fashion ${name} product photo, angle ${idx + 1}, white background, high quality, professional photography`)}&image_size=square_hd`),
      colors,
      materials,
      sizes: ['S', 'M', 'L', 'XL'],
      category: categories[i % categories.length],
      style: styles[Math.floor(Math.random() * styles.length)],
      brand: brands[Math.floor(Math.random() * brands.length)],
      stock: Math.floor(Math.random() * 100) + 10,
      rating: Math.floor(Math.random() * 20 + 30) / 10,
      reviewCount: Math.floor(Math.random() * 500) + 10,
      tags: [...productSeasons, ...productOccasions, ...materials.map((m) => m.category)],
      seasonality: productSeasons,
      occasions: productOccasions,
      createdAt: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
    });
  }

  return products;
};

export const mockWardrobe = generateMockWardrobe(30);
export const mockProducts = generateMockProducts(20);
