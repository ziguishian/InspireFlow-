/**
 * IndexedDB 存储工具
 * 用于存储模型的 baseURL 和 API key 配置
 */

const DB_NAME = 'mxinspireFlows';
const DB_VERSION = 1;
const STORE_NAME = 'modelConfigs';

interface ModelConfig {
  baseURL: string;
  apiKey: string;
}

interface StoredModelConfig {
  model: string;
  config: ModelConfig;
  updatedAt: string;
}

class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * 初始化数据库
   */
  private async init(): Promise<void> {
    if (this.db) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB 打开失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建对象存储
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'model' });
          objectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * 保存模型配置
   */
  async saveModelConfig(model: string, config: ModelConfig): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const data: StoredModelConfig = {
        model,
        config,
        updatedAt: new Date().toISOString(),
      };

      const request = store.put(data);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('保存模型配置失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取模型配置
   */
  async getModelConfig(model: string): Promise<ModelConfig | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(model);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.config) {
          resolve(result.config);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('获取模型配置失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有模型配置
   */
  async getAllModelConfigs(): Promise<Record<string, ModelConfig>> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as StoredModelConfig[];
        const configs: Record<string, ModelConfig> = {};

        results.forEach((item) => {
          if (item.config) {
            configs[item.model] = item.config;
          }
        });

        resolve(configs);
      };

      request.onerror = () => {
        console.error('获取所有模型配置失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 删除模型配置
   */
  async deleteModelConfig(model: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(model);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('删除模型配置失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 清空所有模型配置
   */
  async clearAllModelConfigs(): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('清空模型配置失败:', request.error);
        reject(request.error);
      };
    });
  }
}

// 导出单例实例
export const indexedDBStorage = new IndexedDBStorage();
