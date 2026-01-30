/**
 * 统一的 IndexedDB 数据库管理系统
 * 应用所有持久化数据均通过本模块写入 IndexedDB，不再使用 localStorage。
 * 存储内容：工作流(workflows)、设置(settings)、模型配置(modelConfigs)、输出历史(outputHistory)。
 * 工作流相关：workflowStore 读写本库；当前活动工作流 ID 存于 settings 的 workflow 键下。
 * 设置与语言：settingsStore 与 LanguageContext 读写本库；仅首次加载时从 localStorage 一次性迁移旧数据并清除。
 */

const DB_NAME = 'mxinspireFlows';
const DB_VERSION = 2; // 升级版本以支持新的存储结构

// 对象存储名称
const STORES = {
  MODEL_CONFIGS: 'modelConfigs',
  WORKFLOWS: 'workflows',
  SETTINGS: 'settings',
  OUTPUT_HISTORY: 'outputHistory',
} as const;

export interface ModelConfig {
  baseURL: string;
  apiKey: string;
  modelName?: string; // 可选：如 Ollama 的模型名称
}

export interface StoredModelConfig {
  model: string;
  config: ModelConfig;
  updatedAt: string;
}

export interface WorkflowData {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  unsaved?: boolean;
  lastSavedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppSettings {
  saveConfig: {
    enabled: boolean;
    useRelativePath: boolean;
    path: string;
  };
  theme?: 'dark' | 'light';
  language?: 'zh-CN' | 'en-US';
  [key: string]: any;
}

export interface OutputHistoryItem {
  id: string;
  type: 'text' | 'image' | 'video' | '3d';
  url: string;
  filePath?: string; // 文件路径（Electron）或 IndexedDB key（浏览器）
  content?: string; // 文本内容（仅文本类型）
  createdAt: string;
  workflowId?: string;
  nodeId?: string;
  nodeType?: string;
  label?: string;
  metadata?: Record<string, any>;
}

class Database {
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

        // 创建模型配置存储（兼容旧版本）
        if (!db.objectStoreNames.contains(STORES.MODEL_CONFIGS)) {
          const modelStore = db.createObjectStore(STORES.MODEL_CONFIGS, { keyPath: 'model' });
          modelStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 创建工作流存储
        if (!db.objectStoreNames.contains(STORES.WORKFLOWS)) {
          const workflowStore = db.createObjectStore(STORES.WORKFLOWS, { keyPath: 'id' });
          workflowStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          workflowStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 创建设置存储
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          const settingsStore = db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
          settingsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 创建输出历史存储
        if (!db.objectStoreNames.contains(STORES.OUTPUT_HISTORY)) {
          const historyStore = db.createObjectStore(STORES.OUTPUT_HISTORY, { keyPath: 'id' });
          historyStore.createIndex('type', 'type', { unique: false });
          historyStore.createIndex('createdAt', 'createdAt', { unique: false });
          historyStore.createIndex('workflowId', 'workflowId', { unique: false });
          historyStore.createIndex('nodeId', 'nodeId', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  // ==================== 模型配置 ====================

  async saveModelConfig(model: string, config: ModelConfig): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORES.MODEL_CONFIGS], 'readwrite');
      const store = transaction.objectStore(STORES.MODEL_CONFIGS);

      const data: StoredModelConfig = {
        model,
        config,
        updatedAt: new Date().toISOString(),
      };

      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('保存模型配置失败'));
    });
  }

  async getModelConfig(model: string): Promise<ModelConfig | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORES.MODEL_CONFIGS], 'readonly');
      const store = transaction.objectStore(STORES.MODEL_CONFIGS);
      const request = store.get(model);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result?.config || null);
      };

      request.onerror = () => reject(request.error || new Error('获取模型配置失败'));
    });
  }

  async getAllModelConfigs(): Promise<Record<string, ModelConfig>> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORES.MODEL_CONFIGS], 'readonly');
      const store = transaction.objectStore(STORES.MODEL_CONFIGS);
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

      request.onerror = () => reject(request.error || new Error('获取所有模型配置失败'));
    });
  }

  // ==================== 工作流 ====================

  async saveWorkflow(workflow: WorkflowData): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORES.WORKFLOWS], 'readwrite');
      const store = transaction.objectStore(STORES.WORKFLOWS);

      const data: WorkflowData = {
        ...workflow,
        updatedAt: new Date().toISOString(),
        createdAt: workflow.createdAt || new Date().toISOString(),
      };

      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('保存工作流失败'));
    });
  }

  async getWorkflow(workflowId: string): Promise<WorkflowData | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORES.WORKFLOWS], 'readonly');
      const store = transaction.objectStore(STORES.WORKFLOWS);
      const request = store.get(workflowId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => reject(request.error || new Error('获取工作流失败'));
    });
  }

  async getAllWorkflows(): Promise<Record<string, WorkflowData>> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORES.WORKFLOWS], 'readonly');
      const store = transaction.objectStore(STORES.WORKFLOWS);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as WorkflowData[];
        const workflows: Record<string, WorkflowData> = {};

        results.forEach((workflow) => {
          workflows[workflow.id] = workflow;
        });

        resolve(workflows);
      };

      request.onerror = () => reject(request.error || new Error('获取所有工作流失败'));
    });
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORES.WORKFLOWS], 'readwrite');
      const store = transaction.objectStore(STORES.WORKFLOWS);
      const request = store.delete(workflowId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('删除工作流失败'));
    });
  }

  // ==================== 设置 ====================

  async saveSettings(key: string, settings: Partial<AppSettings>): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORES.SETTINGS], 'readwrite');
      const store = transaction.objectStore(STORES.SETTINGS);

      const data = {
        key,
        value: settings,
        updatedAt: new Date().toISOString(),
      };

      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('保存设置失败'));
    });
  }

  async getSettings(key: string = 'main'): Promise<AppSettings | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORES.SETTINGS], 'readonly');
      const store = transaction.objectStore(STORES.SETTINGS);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result?.value || null);
      };

      request.onerror = () => reject(request.error || new Error('获取设置失败'));
    });
  }

  // ==================== 输出历史 ====================

  async saveOutputHistory(item: OutputHistoryItem): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORES.OUTPUT_HISTORY], 'readwrite');
      const store = transaction.objectStore(STORES.OUTPUT_HISTORY);

      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('保存输出历史失败'));
    });
  }

  async getOutputHistory(
    options: {
      type?: 'text' | 'image' | 'video' | '3d';
      workflowId?: string;
      nodeId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<OutputHistoryItem[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORES.OUTPUT_HISTORY], 'readonly');
      const store = transaction.objectStore(STORES.OUTPUT_HISTORY);

      let index: IDBIndex;
      let range: IDBKeyRange | null = null;

      // 根据选项选择索引
      if (options.type) {
        index = store.index('type');
        range = IDBKeyRange.only(options.type);
      } else if (options.workflowId) {
        index = store.index('workflowId');
        range = IDBKeyRange.only(options.workflowId);
      } else if (options.nodeId) {
        index = store.index('nodeId');
        range = IDBKeyRange.only(options.nodeId);
      } else {
        index = store.index('createdAt');
      }

      const request = index.openCursor(range, 'prev'); // 从新到旧
      const results: OutputHistoryItem[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          results.push(cursor.value);
          if (options.limit && results.length >= options.limit) {
            resolve(results);
          } else {
            cursor.continue();
          }
        } else {
          // 应用分页
          const start = options.offset || 0;
          const end = options.limit ? start + options.limit : undefined;
          resolve(results.slice(start, end));
        }
      };

      request.onerror = () => reject(request.error || new Error('获取输出历史失败'));
    });
  }

  async deleteOutputHistory(id: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORES.OUTPUT_HISTORY], 'readwrite');
      const store = transaction.objectStore(STORES.OUTPUT_HISTORY);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('删除输出历史失败'));
    });
  }

  async clearOutputHistory(
    options: {
      type?: 'text' | 'image' | 'video' | '3d';
      workflowId?: string;
    } = {}
  ): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      const transaction = this.db.transaction([STORES.OUTPUT_HISTORY], 'readwrite');
      const store = transaction.objectStore(STORES.OUTPUT_HISTORY);

      if (options.type) {
        const index = store.index('type');
        const range = IDBKeyRange.only(options.type);
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => reject(request.error || new Error('清空输出历史失败'));
      } else {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new Error('清空输出历史失败'));
      }
    });
  }
}

// 导出单例实例
export const database = new Database();
