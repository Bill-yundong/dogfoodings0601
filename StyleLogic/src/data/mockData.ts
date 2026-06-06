import type { ClothingItem, Product, ColorData, MaterialData } from '../types';
import { allColors } from './colorDatabase';
import { materialDatabase } from './materialDatabase';
import { generateProductImageUrl } from '../utils/imageUtils';

const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const colorKeywords: Record<string, string[]> = {
  黑色: ['黑色', '黑', '炭黑', '纯黑', '玄色', '深色'],
  白色: ['白色', '白', '米白', '象牙白', '本白', '米', '米色'],
  米色: ['米色', '米', '卡其', '杏色', '驼色', '燕麦色', '浅棕', '卡其色'],
  灰色: ['灰色', '灰', '银灰', '炭灰', '烟灰', '雾霾', '雾霾蓝'],
  蓝色: ['蓝色', '蓝', '藏蓝', '海蓝', '牛仔蓝', '雾霾蓝', '海军蓝', '湖蓝', '宝石蓝', '孔雀蓝', '青色'],
  红色: ['红色', '红', '正红', '酒红', '枣红', '橘红', '土橘', '橙色', '珊瑚橙'],
  粉色: ['粉色', '粉', '樱花粉', '桃粉', '冰粉', '芭比粉', '亮粉', '桃色'],
  绿色: ['绿色', '绿', '军绿', '墨绿', '草绿', '薄荷绿', '青色'],
  棕色: ['棕色', '棕', '咖啡', '焦糖', '巧克力', '深棕', '浅棕', '驼色'],
  紫色: ['紫色', '紫', '薰衣紫', '葡萄紫', '藕荷色', '香芋'],
  黄色: ['黄色', '黄', '鹅黄', '金黄', '柠檬黄', '芥末黄', '金色'],
  橙色: ['橙色', '橙', '橘色', '南瓜橙', '珊瑚橙', '土橘', '橘红'],
  青色: ['青色', '青', '湖蓝', '宝石蓝', '孔雀蓝', '薄荷'],
};

const materialKeywords: Record<string, string[]> = {
  纯棉: ['棉', '纯棉', '全棉', '精梳棉', 'T恤', '衬衫', '休闲裤', '运动裤', '修身'],
  真丝: ['真丝', '丝绸', '丝', '缎面', '绸缎', '桑蚕丝', '发带', '丝巾', '吊带', '半身裙'],
  羊毛: ['羊毛', '毛呢', '羊绒', '呢子', '羊羔毛', '毛织', '针织', '毛衣', '风衣', '大衣', '外套', '开衫', '针织衫', '针织帽'],
  亚麻: ['亚麻', '麻', '苎麻', '棉麻', '西装'],
  牛仔布: ['牛仔', '丹宁'],
  皮革: ['皮革', '皮', '真皮', '牛皮', '羊皮', '人造革', 'PU', '机车', '乐福', '短靴', '高跟鞋', '手提包', '腰带', '夹克'],
  雪纺: ['雪纺', '乔其纱', '碎花', '长裙', '飘逸'],
  针织: ['针织', '毛衣', '线衫', '毛织', '运动裤', '修身'],
  聚酯纤维: ['聚酯纤维', '涤纶', '化纤', '项链', '耳环', '装饰', '帆布', '双肩包', '休闲鞋', '运动鞋'],
};

const findColorFromName = (name: string): ColorData => {
  for (const [colorName, keywords] of Object.entries(colorKeywords)) {
    for (const keyword of keywords) {
      if (name.includes(keyword)) {
        const matchedColor = allColors.find(c => c.name === colorName);
        if (matchedColor) return matchedColor;
      }
    }
  }
  return getRandomItem(allColors);
};

const findMaterialFromName = (name: string): MaterialData => {
  for (const [materialName, keywords] of Object.entries(materialKeywords)) {
    for (const keyword of keywords) {
      if (name.includes(keyword)) {
        const matchedMaterial = materialDatabase.find(m => m.name === materialName);
        if (matchedMaterial) return matchedMaterial;
      }
    }
  }
  return getRandomItem(materialDatabase);
};

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
    const color = findColorFromName(name);
    const material = findMaterialFromName(name);
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
      imageUrl: generateProductImageUrl(color, material, category, name),
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
    const primaryColor = findColorFromName(name);
    const primaryMaterial = findMaterialFromName(name);
    const colorCount = Math.floor(Math.random() * 2) + 1;
    const otherColors = allColors.filter(c => c.id !== primaryColor.id);
    const colors = [primaryColor, ...Array.from({ length: colorCount - 1 }, () => getRandomItem(otherColors))];
    const materialCount = Math.floor(Math.random() * 2);
    const otherMaterials = materialDatabase.filter(m => m.id !== primaryMaterial.id);
    const materials = [primaryMaterial, ...Array.from({ length: materialCount }, () => getRandomItem(otherMaterials))];
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
      images: colors[0] && materials[0]
        ? Array.from({ length: 4 }, (_, idx) => generateProductImageUrl(colors[0], materials[0], 'dress', `${name} angle ${idx + 1}`))
        : [],
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
