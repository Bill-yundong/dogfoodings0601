import { openDB, IDBPDatabase } from 'idb';
import {
  Transaction,
  Category,
  Asset,
  AssetType,
  TaxRecord,
  SimulationConfig,
  SimulationResult,
  AppSettings,
  EncryptionMeta,
} from '../types';
import { EncryptionUtils, generateId } from './encryption';

const DB_NAME = 'FinanceNexusDB';
const DB_VERSION = 1;

export interface EncryptedRecord {
  id: string;
  data: string;
  iv: string;
  updatedAt: number;
}

class DatabaseService {
  private db: IDBPDatabase | null = null;
  private encryptionEnabled = false;

  async init(encryptionEnabled = false, password?: string): Promise<void> {
    this.encryptionEnabled = encryptionEnabled;

    if (encryptionEnabled && password) {
      const meta = await this.getEncryptionMeta();
      if (meta) {
        await EncryptionUtils.init(password, meta.salt);
      } else {
        await EncryptionUtils.init(password);
        await this.saveEncryptionMeta();
      }
    }

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade: (db) => {
        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
          txStore.createIndex('date', 'date');
          txStore.createIndex('categoryId', 'categoryId');
          txStore.createIndex('type', 'type');
        }

        if (!db.objectStoreNames.contains('categories')) {
          const catStore = db.createObjectStore('categories', { keyPath: 'id' });
          catStore.createIndex('type', 'type');
        }

        if (!db.objectStoreNames.contains('assets')) {
          const assetStore = db.createObjectStore('assets', { keyPath: 'id' });
          assetStore.createIndex('typeId', 'typeId');
        }

        if (!db.objectStoreNames.contains('assetTypes')) {
          db.createObjectStore('assetTypes', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('taxRecords')) {
          const taxStore = db.createObjectStore('taxRecords', { keyPath: 'id' });
          taxStore.createIndex('period', 'period');
        }

        if (!db.objectStoreNames.contains('simulationConfigs')) {
          const simStore = db.createObjectStore('simulationConfigs', { keyPath: 'id' });
          simStore.createIndex('createdAt', 'createdAt');
        }

        if (!db.objectStoreNames.contains('simulationResults')) {
          const resultStore = db.createObjectStore('simulationResults', { keyPath: 'id' });
          resultStore.createIndex('configId', 'configId');
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('encryptionMeta')) {
          db.createObjectStore('encryptionMeta', { keyPath: 'id' });
        }
      },
    });
  }

  private async encryptData<T>(data: T): Promise<{ data: string; iv: string }> {
    if (this.encryptionEnabled && EncryptionUtils.isInitialized()) {
      const { encrypted, iv } = await EncryptionUtils.encryptObject(data);
      return { data: encrypted, iv };
    }
    return { data: JSON.stringify(data), iv: '' };
  }

  private async decryptData<T>(encrypted: string, iv: string): Promise<T> {
    if (this.encryptionEnabled && EncryptionUtils.isInitialized() && iv) {
      return EncryptionUtils.decryptObject<T>(encrypted, iv);
    }
    return JSON.parse(encrypted);
  }

  private async getEncryptionMeta(): Promise<EncryptionMeta | null> {
    const db = await this.getDB();
    const meta = await db.get('encryptionMeta', 'main');
    return meta || null;
  }

  private async saveEncryptionMeta(): Promise<void> {
    const db = await this.getDB();
    await db.put('encryptionMeta', {
      id: 'main',
      salt: EncryptionUtils.getSaltBase64(),
      createdAt: Date.now(),
    });
  }

  private async getDB(): Promise<IDBPDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.getDB();
    const records: EncryptedRecord[] = await db.getAll(storeName);
    
    return Promise.all(
      records.map(async (record) => {
        return this.decryptData<T>(record.data, record.iv);
      })
    );
  }

  async getById<T>(storeName: string, id: string): Promise<T | null> {
    const db = await this.getDB();
    const record: EncryptedRecord | undefined = await db.get(storeName, id);
    
    if (!record) return null;
    return this.decryptData<T>(record.data, record.iv);
  }

  async put<T extends { id: string }>(storeName: string, item: T): Promise<string> {
    const db = await this.getDB();
    const { data, iv } = await this.encryptData(item);
    
    const record: EncryptedRecord = {
      id: item.id,
      data,
      iv,
      updatedAt: Date.now(),
    };
    
    await db.put(storeName, record);
    return item.id;
  }

  async delete(storeName: string, id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete(storeName, id);
  }

  async clear(storeName: string): Promise<void> {
    const db = await this.getDB();
    await db.clear(storeName);
  }

  async getByIndex<T>(storeName: string, indexName: string, value: IDBKeyRange | IDBValidKey): Promise<T[]> {
    const db = await this.getDB();
    const records: EncryptedRecord[] = await db.getAllFromIndex(storeName, indexName, value);
    
    return Promise.all(
      records.map(async (record) => {
        return this.decryptData<T>(record.data, record.iv);
      })
    );
  }

  async getTransactions(): Promise<Transaction[]> {
    return this.getAll<Transaction>('transactions');
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    return this.getById<Transaction>('transactions', id);
  }

  async saveTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<string> {
    const tx: Transaction = {
      ...transaction,
      id: generateId(),
      createdAt: Date.now(),
    };
    return this.put('transactions', tx);
  }

  async updateTransaction(transaction: Transaction): Promise<string> {
    return this.put('transactions', transaction);
  }

  async deleteTransaction(id: string): Promise<void> {
    return this.delete('transactions', id);
  }

  async getCategories(): Promise<Category[]> {
    return this.getAll<Category>('categories');
  }

  async saveCategory(category: Omit<Category, 'id'>): Promise<string> {
    const cat: Category = {
      ...category,
      id: generateId(),
    };
    return this.put('categories', cat);
  }

  async getAssets(): Promise<Asset[]> {
    return this.getAll<Asset>('assets');
  }

  async saveAsset(asset: Omit<Asset, 'id'>): Promise<string> {
    const a: Asset = {
      ...asset,
      id: generateId(),
    };
    return this.put('assets', a);
  }

  async updateAsset(asset: Asset): Promise<string> {
    return this.put('assets', asset);
  }

  async deleteAsset(id: string): Promise<void> {
    return this.delete('assets', id);
  }

  async getAssetTypes(): Promise<AssetType[]> {
    return this.getAll<AssetType>('assetTypes');
  }

  async getTaxRecords(): Promise<TaxRecord[]> {
    return this.getAll<TaxRecord>('taxRecords');
  }

  async saveTaxRecord(record: Omit<TaxRecord, 'id' | 'createdAt'>): Promise<string> {
    const r: TaxRecord = {
      ...record,
      id: generateId(),
      createdAt: Date.now(),
    };
    return this.put('taxRecords', r);
  }

  async getSimulationConfigs(): Promise<SimulationConfig[]> {
    return this.getAll<SimulationConfig>('simulationConfigs');
  }

  async saveSimulationConfig(config: Omit<SimulationConfig, 'id' | 'createdAt'>): Promise<string> {
    const c: SimulationConfig = {
      ...config,
      id: generateId(),
      createdAt: Date.now(),
    };
    return this.put('simulationConfigs', c);
  }

  async getSimulationResults(): Promise<SimulationResult[]> {
    return this.getAll<SimulationResult>('simulationResults');
  }

  async saveSimulationResult(result: Omit<SimulationResult, 'id' | 'createdAt'>): Promise<string> {
    const r: SimulationResult = {
      ...result,
      id: generateId(),
      createdAt: Date.now(),
    };
    return this.put('simulationResults', r);
  }

  async getSettings(): Promise<AppSettings> {
    const db = await this.getDB();
    const record = await db.get('settings', 'app');
    if (record) {
      return this.decryptData<AppSettings>(record.data, record.iv);
    }
    return {
      currency: 'CNY',
      theme: 'dark',
      encryptionEnabled: false,
      autoBackup: true,
    };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const db = await this.getDB();
    const { data, iv } = await this.encryptData(settings);
    await db.put('settings', { key: 'app', data, iv, updatedAt: Date.now() });
  }

  async exportAllData(): Promise<string> {
    const [transactions, categories, assets, taxRecords, configs, results] = await Promise.all([
      this.getTransactions(),
      this.getCategories(),
      this.getAssets(),
      this.getTaxRecords(),
      this.getSimulationConfigs(),
      this.getSimulationResults(),
    ]);

    const exportData = {
      version: DB_VERSION,
      exportedAt: Date.now(),
      data: {
        transactions,
        categories,
        assets,
        taxRecords,
        simulationConfigs: configs,
        simulationResults: results,
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importAllData(jsonString: string): Promise<void> {
    const exportData = JSON.parse(jsonString);
    
    const { transactions, categories, assets, taxRecords, simulationConfigs, simulationResults } = exportData.data;

    for (const tx of transactions) {
      await this.put('transactions', tx);
    }
    for (const cat of categories) {
      await this.put('categories', cat);
    }
    for (const asset of assets) {
      await this.put('assets', asset);
    }
    for (const record of taxRecords) {
      await this.put('taxRecords', record);
    }
    for (const config of simulationConfigs) {
      await this.put('simulationConfigs', config);
    }
    for (const result of simulationResults) {
      await this.put('simulationResults', result);
    }
  }

  async clearAllData(): Promise<void> {
    const db = await this.getDB();
    const stores = [
      'transactions',
      'categories',
      'assets',
      'taxRecords',
      'simulationConfigs',
      'simulationResults',
    ];
    for (const store of stores) {
      await db.clear(store);
    }
  }

  async enableEncryption(password: string): Promise<void> {
    const allData = {
      transactions: await this.getTransactions(),
      categories: await this.getCategories(),
      assets: await this.getAssets(),
      taxRecords: await this.getTaxRecords(),
      simulationConfigs: await this.getSimulationConfigs(),
      simulationResults: await this.getSimulationResults(),
    };

    this.encryptionEnabled = true;
    await EncryptionUtils.init(password);
    await this.saveEncryptionMeta();

    for (const tx of allData.transactions) {
      await this.put('transactions', tx);
    }
    for (const cat of allData.categories) {
      await this.put('categories', cat);
    }
    for (const asset of allData.assets) {
      await this.put('assets', asset);
    }
    for (const record of allData.taxRecords) {
      await this.put('taxRecords', record);
    }
    for (const config of allData.simulationConfigs) {
      await this.put('simulationConfigs', config);
    }
    for (const result of allData.simulationResults) {
      await this.put('simulationResults', result);
    }

    const settings = await this.getSettings();
    settings.encryptionEnabled = true;
    await this.saveSettings(settings);
  }

  async disableEncryption(password: string): Promise<void> {
    const meta = await this.getEncryptionMeta();
    if (!meta) {
      throw new Error('Encryption not enabled');
    }

    try {
      await EncryptionUtils.init(password, meta.salt);
    } catch (e) {
      throw new Error('Invalid password');
    }

    const allData = {
      transactions: await this.getTransactions(),
      categories: await this.getCategories(),
      assets: await this.getAssets(),
      taxRecords: await this.getTaxRecords(),
      simulationConfigs: await this.getSimulationConfigs(),
      simulationResults: await this.getSimulationResults(),
    };

    this.encryptionEnabled = false;
    EncryptionUtils.clearKey();

    for (const tx of allData.transactions) {
      await this.put('transactions', tx);
    }
    for (const cat of allData.categories) {
      await this.put('categories', cat);
    }
    for (const asset of allData.assets) {
      await this.put('assets', asset);
    }
    for (const record of allData.taxRecords) {
      await this.put('taxRecords', record);
    }
    for (const config of allData.simulationConfigs) {
      await this.put('simulationConfigs', config);
    }
    for (const result of allData.simulationResults) {
      await this.put('simulationResults', result);
    }

    const db = await this.getDB();
    await db.delete('encryptionMeta', 'main');

    const settings = await this.getSettings();
    settings.encryptionEnabled = false;
    await this.saveSettings(settings);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const db = new DatabaseService();
