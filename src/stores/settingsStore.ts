import { create } from 'zustand';
import { ModelConfigs, UnifiedConfigSwitches } from '@/types';
import { loadHistoryFromFiles, clearFileSystemHistory } from '@/utils/fileSave';
import { database } from '@/utils/database';

export type GenerationHistoryItem = {
  id: string;
  type: 'text' | 'image' | 'video' | '3d';
  url: string;
  content?: string; // 文本内容（仅文本类型）
  filePath?: string; // 文件路径
  createdAt: string;
  workflowId?: string;
  nodeId?: string;
  nodeType?: string;
  label?: string;
};

interface SettingsStore {
  modelConfigs: ModelConfigs;
  unifiedConfigSwitches: UnifiedConfigSwitches; // 统一配置开关状态
  setModelConfig: (model: string, config: { baseURL: string; apiKey: string; modelName?: string }) => Promise<void>;
  getModelConfig: (model: string) => { baseURL: string; apiKey: string } | null;
  getModelConfigFromDB: (model: string) => Promise<{ baseURL: string; apiKey: string } | null>;
  setUnifiedConfigSwitch: (providerId: string, enabled: boolean) => Promise<void>;
  getUnifiedConfigSwitch: (providerId: string) => boolean;
  saveConfig: {
    enabled: boolean;
    useRelativePath: boolean;
    path: string;
  };
  setSaveConfig: (config: SettingsStore['saveConfig']) => void;
  appearanceConfig: {
    canvasBackgroundImage: string; // data URL 或空字符串，唯一个性化
  };
  setAppearanceConfig: (config: Partial<SettingsStore['appearanceConfig']>) => void;
  generationHistory: GenerationHistoryItem[];
  addGenerationHistory: (item: Omit<GenerationHistoryItem, 'id' | 'createdAt'>) => Promise<void>;
  deleteGenerationHistoryItem: (id: string) => Promise<void>;
  clearGenerationHistory: () => Promise<void>;
  loadSettings: () => Promise<void>;
  saveSettings: () => void;
}

const defaultModelConfigs: ModelConfigs = {};

const defaultSaveConfig: SettingsStore['saveConfig'] = {
  enabled: false,
  useRelativePath: true,
  path: 'outputs',
};

const defaultAppearanceConfig: SettingsStore['appearanceConfig'] = {
  canvasBackgroundImage: '',
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  modelConfigs: defaultModelConfigs,
  unifiedConfigSwitches: {},
  saveConfig: defaultSaveConfig,
  appearanceConfig: defaultAppearanceConfig,
  generationHistory: [],

  setUnifiedConfigSwitch: async (providerId: string, enabled: boolean) => {
    const switches = { ...get().unifiedConfigSwitches, [providerId]: enabled };
    set({ unifiedConfigSwitches: switches });
    
    // 保存到数据库
    try {
      const settings = await database.getSettings('main') || {};
      await database.saveSettings('main', {
        ...settings,
        unifiedConfigSwitches: switches,
      });
    } catch (error) {
      console.error('保存统一配置开关到数据库失败:', error);
    }
    
    get().saveSettings();
  },

  getUnifiedConfigSwitch: (providerId: string) => {
    return get().unifiedConfigSwitches[providerId] ?? false; // 默认关闭
  },

  setModelConfig: async (model, config) => {
    // 完全使用数据库存储
    try {
      await database.saveModelConfig(model, config);
    } catch (error) {
      console.error('保存模型配置到数据库失败:', error);
      // 不再回退到 localStorage，只更新内存状态
    }
    
    set((state) => ({
      modelConfigs: {
        ...state.modelConfigs,
        [model]: config,
      },
    }));
    get().saveSettings();
  },

  getModelConfig: (model) => {
    const configs = get().modelConfigs;
    const config = configs[model as keyof ModelConfigs];
    
    // 如果没有配置，返回 null
    if (!config) {
      return null;
    }
    
    // 对于 Ollama，设置默认 API Key（用于通过验证，实际不会被使用）
    if (model.toLowerCase() === 'ollama') {
      return {
        ...config,
        apiKey: config.apiKey || 'ollama-no-key-needed', // 默认 API Key（实际不会被使用）
      };
    }
    
    return config;
  },

  // 从数据库异步获取模型配置
  getModelConfigFromDB: async (model: string) => {
    try {
      return await database.getModelConfig(model);
    } catch (error) {
      console.error('从数据库获取模型配置失败:', error);
      return null;
    }
  },

  setSaveConfig: (config) => {
    set({ saveConfig: config });
    get().saveSettings();
  },

  setAppearanceConfig: (config) => {
    set((state) => ({
      appearanceConfig: { ...state.appearanceConfig, ...config },
    }));
    get().saveSettings();
  },

  addGenerationHistory: async (item) => {
    const state = get();
    
    // 验证 URL 是否有效
    if (!item.url || (typeof item.url === 'string' && item.url.trim().length === 0)) {
      console.warn('[addGenerationHistory] 无效的 URL，跳过保存:', item);
      return;
    }
    
    // 总是创建新的历史记录，即使结果相同也不合并
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 11);
    const nextItem: GenerationHistoryItem = {
      id: `${timestamp}-${random}-${state.generationHistory.length}`,
      createdAt: new Date().toISOString(),
      ...item,
    };
    
    console.log(`[addGenerationHistory] 准备保存历史记录:`, {
      id: nextItem.id,
      type: nextItem.type,
      urlLength: nextItem.url?.length,
      urlPreview: typeof nextItem.url === 'string' ? nextItem.url.substring(0, 100) : nextItem.url,
      filePath: nextItem.filePath,
      saveConfigEnabled: state.saveConfig.enabled,
    });
    
    // 完全使用数据库存储，不再使用 localStorage
    try {
      await database.saveOutputHistory({
        id: nextItem.id,
        type: nextItem.type,
        url: nextItem.url,
        filePath: nextItem.filePath,
        content: nextItem.content,
        createdAt: nextItem.createdAt,
        workflowId: nextItem.workflowId,
        nodeId: nextItem.nodeId,
        nodeType: nextItem.nodeType,
        label: nextItem.label,
      });
      console.log(`[addGenerationHistory] 已成功保存到数据库: ${nextItem.id} (${nextItem.type})`);
    } catch (error) {
      console.error('[addGenerationHistory] 保存到数据库失败:', error);
      // 即使数据库保存失败，也继续添加到内存状态（用于 UI 显示）
    }
    
    // 更新内存状态（无论保存是否成功，都要更新 UI）
    set((state) => {
      const nextHistory = [nextItem, ...state.generationHistory].slice(0, 50);
      return { generationHistory: nextHistory };
    });
    
    console.log(`[addGenerationHistory] 已更新内存状态，当前历史记录数量: ${get().generationHistory.length}`);
  },

  deleteGenerationHistoryItem: async (id) => {
    console.log(`[deleteGenerationHistoryItem] 开始删除历史记录: ${id}`);
    
    // 1. 从数据库删除
    try {
      await database.deleteOutputHistory(id);
      console.log(`[deleteGenerationHistoryItem] 已从数据库删除: ${id}`);
    } catch (error) {
      console.error('[deleteGenerationHistoryItem] 从数据库删除失败:', error);
    }
    
    // 2. 从内存状态删除
    set((state) => {
      const nextHistory = state.generationHistory.filter((item) => item.id !== id);
      return { generationHistory: nextHistory };
    });
    
    console.log(`[deleteGenerationHistoryItem] 已从内存状态删除: ${id}`);
  },

  clearGenerationHistory: async () => {
    const state = get();
    
    console.log('[clearGenerationHistory] 开始清空历史记录...');
    
    // 1. 清除数据库中的历史记录
    try {
      await database.clearOutputHistory();
      console.log('[clearGenerationHistory] 已清除数据库历史记录');
    } catch (error) {
      console.error('[clearGenerationHistory] 清除数据库历史记录失败:', error);
    }
    
    // 2. 如果保存功能已启用，同时清除文件系统中的历史记录
    if (state.saveConfig.enabled) {
      try {
        await clearFileSystemHistory(state.saveConfig);
        console.log('[clearGenerationHistory] 已清除文件系统历史记录');
      } catch (error) {
        console.error('[clearGenerationHistory] 清除文件系统历史记录失败:', error);
      }
    }
    
    // 3. 清除内存状态
    set({ generationHistory: [] });
    console.log('[clearGenerationHistory] 已清除内存状态，历史记录清空完成');
  },

  loadSettings: async () => {
    // 完全使用数据库加载
    try {
      // 1. 加载模型配置
      let dbConfigs = (await database.getAllModelConfigs()) || {};
      // 迁移：Google/Gemini 合并为 google-gemini-unified
      if (!dbConfigs['google-gemini-unified'] && (dbConfigs['gemini-unified'] || dbConfigs['google-genai-unified'])) {
        dbConfigs = {
          ...dbConfigs,
          'google-gemini-unified': dbConfigs['gemini-unified'] || dbConfigs['google-genai-unified'],
        };
      }

      // 2. 加载设置（包括 saveConfig 和统一配置开关）
      const dbSettings = await database.getSettings('main');
      const saveConfig = dbSettings?.saveConfig || defaultSaveConfig;
      let unifiedConfigSwitches = dbSettings?.unifiedConfigSwitches || {};
      // 迁移：gemini / google-genai 合并为 google-gemini
      if (unifiedConfigSwitches['gemini'] !== undefined || unifiedConfigSwitches['google-genai'] !== undefined) {
        if (unifiedConfigSwitches['google-gemini'] === undefined) {
          unifiedConfigSwitches = {
            ...unifiedConfigSwitches,
            'google-gemini': unifiedConfigSwitches['google-genai'] ?? unifiedConfigSwitches['gemini'] ?? true,
          };
        }
      }

      const appearanceConfig = dbSettings?.appearanceConfig?.canvasBackgroundImage != null
        ? { canvasBackgroundImage: dbSettings.appearanceConfig.canvasBackgroundImage || '' }
        : defaultAppearanceConfig;

      set({
        modelConfigs: dbConfigs as ModelConfigs,
        saveConfig,
        unifiedConfigSwitches,
        appearanceConfig,
      });
      
      // 3. 加载历史记录（完全从数据库加载）
      try {
        const dbHistory = await database.getOutputHistory({ limit: 50 });
        if (dbHistory && dbHistory.length > 0) {
          // 按创建时间排序
          dbHistory.sort((a, b) => {
            const timeA = new Date(a.createdAt).getTime();
            const timeB = new Date(b.createdAt).getTime();
            return timeB - timeA;
          });
          set({ generationHistory: dbHistory.slice(0, 50) });
          console.log(`[loadSettings] 从数据库加载了 ${dbHistory.length} 条历史记录`);
        } else if (saveConfig.enabled) {
          // 如果数据库没有历史记录，尝试从文件系统加载
          try {
            const fileHistory = await loadHistoryFromFiles(saveConfig);
            if (fileHistory && fileHistory.length > 0) {
              // 按创建时间排序
              fileHistory.sort((a, b) => {
                const timeA = new Date(a.createdAt).getTime();
                const timeB = new Date(b.createdAt).getTime();
                return timeB - timeA;
              });
              set({ generationHistory: fileHistory.slice(0, 50) });
              console.log(`[loadSettings] 从文件系统加载了 ${fileHistory.length} 条历史记录`);
            }
          } catch (e) {
            console.error('从文件系统加载历史记录失败:', e);
          }
        }
      } catch (e) {
        console.error('从数据库加载历史记录失败:', e);
      }
      
      // 4. 尝试从 localStorage 迁移旧数据（一次性迁移）
      try {
        const saved = localStorage.getItem('matrixinspire-settings');
        if (saved) {
          const settings = JSON.parse(saved);
          // 迁移模型配置
          if (settings.modelConfigs && Object.keys(settings.modelConfigs).length > 0) {
            console.log('[loadSettings] 发现 localStorage 中的旧配置，迁移到数据库...');
            for (const [model, config] of Object.entries(settings.modelConfigs)) {
              if (config && typeof config === 'object' && 'baseURL' in config && 'apiKey' in config) {
                try {
                  await database.saveModelConfig(model, config as { baseURL: string; apiKey: string });
                } catch (e) {
                  console.error(`迁移模型配置 ${model} 失败:`, e);
                }
              }
            }
            // 迁移完成后清除 localStorage
            localStorage.removeItem('matrixinspire-settings');
            console.log('[loadSettings] 旧配置已迁移到数据库');
          }
        }
        
        // 迁移历史记录
        const historyRaw = localStorage.getItem('matrixinspire-history');
        if (historyRaw) {
          try {
            const history = JSON.parse(historyRaw);
            if (Array.isArray(history) && history.length > 0) {
              console.log(`[loadSettings] 发现 localStorage 中的 ${history.length} 条历史记录，迁移到数据库...`);
              for (const item of history) {
                try {
                  await database.saveOutputHistory(item);
                } catch (e) {
                  console.error(`迁移历史记录 ${item.id} 失败:`, e);
                }
              }
              // 迁移完成后清除 localStorage
              localStorage.removeItem('matrixinspire-history');
              console.log('[loadSettings] 旧历史记录已迁移到数据库');
              // 重新加载历史记录
              const dbHistory = await database.getOutputHistory({ limit: 50 });
              if (dbHistory && dbHistory.length > 0) {
                dbHistory.sort((a, b) => {
                  const timeA = new Date(a.createdAt).getTime();
                  const timeB = new Date(b.createdAt).getTime();
                  return timeB - timeA;
                });
                set({ generationHistory: dbHistory.slice(0, 50) });
              }
            }
          } catch (e) {
            console.error('迁移历史记录失败:', e);
          }
        }
      } catch (e) {
        // 迁移失败不影响正常使用
        console.warn('迁移 localStorage 数据失败:', e);
      }
    } catch (error) {
      console.error('从数据库加载设置失败:', error);
    }
  },

  saveSettings: async () => {
    const settings = {
      saveConfig: get().saveConfig,
      appearanceConfig: get().appearanceConfig,
      unifiedConfigSwitches: get().unifiedConfigSwitches,
    };
    
    // 完全使用数据库存储
    try {
      await database.saveSettings('main', settings);
    } catch (error) {
      console.error('保存设置到数据库失败:', error);
    }
  },
}));
