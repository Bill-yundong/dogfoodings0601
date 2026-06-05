import { create } from 'zustand';
import {
  Transaction,
  Category,
  Asset,
  AppSettings,
  SimulationConfig,
  SimulationResult,
} from '../types';
import { db } from '../utils/database';

interface FinanceState {
  transactions: Transaction[];
  categories: Category[];
  assets: Asset[];
  settings: AppSettings;
  simulationConfigs: SimulationConfig[];
  simulationResults: SimulationResult[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  encryptionEnabled: boolean;

  init: () => Promise<void>;
  loadData: () => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (cat: Omit<Category, 'id'>) => Promise<void>;
  addAsset: (asset: Omit<Asset, 'id'>) => Promise<void>;
  updateAsset: (asset: Asset) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  addSimulationConfig: (config: Omit<SimulationConfig, 'id' | 'createdAt'>) => Promise<void>;
  addSimulationResult: (result: Omit<SimulationResult, 'id' | 'createdAt'>) => Promise<void>;
  exportData: () => Promise<string>;
  importData: (jsonString: string) => Promise<void>;
  clearAllData: () => Promise<void>;
  enableEncryption: (password: string) => Promise<void>;
  disableEncryption: (password: string) => Promise<void>;
  clearError: () => void;
}

const defaultCategories: Omit<Category, 'id'>[] = [
  { name: '工资', type: 'income', icon: 'Wallet', color: '#10B981' },
  { name: '奖金', type: 'income', icon: 'Gift', color: '#F59E0B' },
  { name: '投资收益', type: 'income', icon: 'TrendingUp', color: '#3B82F6' },
  { name: '兼职', type: 'income', icon: 'Briefcase', color: '#8B5CF6' },
  { name: '其他收入', type: 'income', icon: 'Plus', color: '#64748B' },
  { name: '餐饮', type: 'expense', icon: 'Coffee', color: '#F59E0B' },
  { name: '交通', type: 'expense', icon: 'Car', color: '#3B82F6' },
  { name: '购物', type: 'expense', icon: 'ShoppingBag', color: '#EC4899' },
  { name: '住房', type: 'expense', icon: 'Home', color: '#8B5CF6' },
  { name: '娱乐', type: 'expense', icon: 'Gamepad2', color: '#06B6D4' },
  { name: '医疗', type: 'expense', icon: 'Heart', color: '#EF4444' },
  { name: '教育', type: 'expense', icon: 'GraduationCap', color: '#14B8A6' },
  { name: '其他支出', type: 'expense', icon: 'MoreHorizontal', color: '#64748B' },
];

export const useFinanceStore = create<FinanceState>((set, get) => ({
  transactions: [],
  categories: [],
  assets: [],
  settings: {
    currency: 'CNY',
    theme: 'dark',
    encryptionEnabled: false,
    autoBackup: true,
  },
  simulationConfigs: [],
  simulationResults: [],
  isLoading: false,
  isInitialized: false,
  error: null,
  encryptionEnabled: false,

  init: async () => {
    set({ isLoading: true, error: null });
    try {
      await db.init();
      
      const settings = await db.getSettings();
      const categories = await db.getCategories();
      
      if (categories.length === 0) {
        for (const cat of defaultCategories) {
          await db.saveCategory(cat);
        }
      }

      await get().loadData();
      set({ isInitialized: true, settings, encryptionEnabled: settings.encryptionEnabled });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '初始化失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadData: async () => {
    try {
      const [transactions, categories, assets, configs, results, settings] = await Promise.all([
        db.getTransactions(),
        db.getCategories(),
        db.getAssets(),
        db.getSimulationConfigs(),
        db.getSimulationResults(),
        db.getSettings(),
      ]);

      set({
        transactions,
        categories,
        assets,
        simulationConfigs: configs,
        simulationResults: results,
        settings,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载数据失败' });
    }
  },

  addTransaction: async (tx) => {
    try {
      await db.saveTransaction(tx);
      await get().loadData();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '添加交易失败' });
    }
  },

  updateTransaction: async (tx) => {
    try {
      await db.updateTransaction(tx);
      await get().loadData();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '更新交易失败' });
    }
  },

  deleteTransaction: async (id) => {
    try {
      await db.deleteTransaction(id);
      await get().loadData();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '删除交易失败' });
    }
  },

  addCategory: async (cat) => {
    try {
      await db.saveCategory(cat);
      await get().loadData();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '添加分类失败' });
    }
  },

  addAsset: async (asset) => {
    try {
      await db.saveAsset(asset);
      await get().loadData();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '添加资产失败' });
    }
  },

  updateAsset: async (asset) => {
    try {
      await db.updateAsset(asset);
      await get().loadData();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '更新资产失败' });
    }
  },

  deleteAsset: async (id) => {
    try {
      await db.deleteAsset(id);
      await get().loadData();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '删除资产失败' });
    }
  },

  updateSettings: async (newSettings) => {
    try {
      const current = get().settings;
      const updated = { ...current, ...newSettings };
      await db.saveSettings(updated);
      set({ settings: updated });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '更新设置失败' });
    }
  },

  addSimulationConfig: async (config) => {
    try {
      await db.saveSimulationConfig(config);
      await get().loadData();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '保存配置失败' });
    }
  },

  addSimulationResult: async (result) => {
    try {
      await db.saveSimulationResult(result);
      await get().loadData();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '保存结果失败' });
    }
  },

  exportData: async () => {
    try {
      return await db.exportAllData();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '导出失败' });
      return '';
    }
  },

  importData: async (jsonString) => {
    try {
      await db.importAllData(jsonString);
      await get().loadData();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '导入失败' });
    }
  },

  clearAllData: async () => {
    try {
      await db.clearAllData();
      await get().loadData();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '清空数据失败' });
    }
  },

  enableEncryption: async (password) => {
    try {
      await db.enableEncryption(password);
      const settings = await db.getSettings();
      set({ encryptionEnabled: true, settings });
    } catch (error) {
      throw error;
    }
  },

  disableEncryption: async (password) => {
    try {
      await db.disableEncryption(password);
      const settings = await db.getSettings();
      set({ encryptionEnabled: false, settings });
    } catch (error) {
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
