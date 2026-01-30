import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Save, Palette, Info, RefreshCw, History, Workflow } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { getAllModelOptions } from '@/nodes/modelOptions';
import { MODEL_PROVIDER_GROUPS } from '@/config/modelProviders';
import { APP_NAME, APP_SUBTITLE } from '@/config/appName';
import CustomSelect from '@/components/UI/CustomSelect';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsCategory = 'data' | 'models' | 'appearance' | 'about';

const INPUT_CLASS =
  'nodrag w-full glass px-3 py-2 rounded-lg text-diffusion-text-primary bg-diffusion-bg-tertiary/50 border border-diffusion-border focus:border-diffusion-glow-cyan focus:outline-none text-sm select-text';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t, setLanguage, language } = useLanguage();
  const saveConfig = useSettingsStore((s) => s.saveConfig);
  const setSaveConfig = useSettingsStore((s) => s.setSaveConfig);
  const appearanceConfig = useSettingsStore((s) => s.appearanceConfig);
  const setAppearanceConfig = useSettingsStore((s) => s.setAppearanceConfig);
  const setModelConfig = useSettingsStore((s) => s.setModelConfig);
  const modelConfigs = useSettingsStore((s) => s.modelConfigs);
  const setUnifiedConfigSwitch = useSettingsStore((s) => s.setUnifiedConfigSwitch);
  const getUnifiedConfigSwitch = useSettingsStore((s) => s.getUnifiedConfigSwitch);
  const generationHistory = useSettingsStore((s) => s.generationHistory);
  const workflows = useWorkflowStore((s) => s.workflows);

  const [localSaveConfig, setLocalSaveConfig] = useState(saveConfig);
  const [localModelConfigs, setLocalModelConfigs] = useState<
    Record<string, { baseURL: string; apiKey: string; modelName?: string }>
  >({});
  const [localUnifiedSwitches, setLocalUnifiedSwitches] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory>('data');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [localAppearance, setLocalAppearance] = useState(appearanceConfig);

  useEffect(() => {
    if (!isOpen) return;
    setLocalSaveConfig(saveConfig);
    setLocalAppearance(appearanceConfig);
    const switches: Record<string, boolean> = {};
    MODEL_PROVIDER_GROUPS.forEach((g) => {
      switches[g.id] = getUnifiedConfigSwitch(g.id);
    });
    setLocalUnifiedSwitches(switches);

    const configs: Record<string, { baseURL: string; apiKey: string; modelName?: string }> = {};
    MODEL_PROVIDER_GROUPS.forEach((p) => {
      let c = modelConfigs[p.unifiedConfigKey as keyof typeof modelConfigs] as { baseURL: string; apiKey: string } | undefined;
      if (!c && p.unifiedConfigKey === 'google-gemini-unified') {
        const legacy = (modelConfigs as Record<string, { baseURL: string; apiKey: string }>)['gemini-unified']
          || (modelConfigs as Record<string, { baseURL: string; apiKey: string }>)['google-genai-unified'];
        c = legacy;
      }
      configs[p.unifiedConfigKey] = c ? { ...c } : { baseURL: '', apiKey: '' };
    });
    getAllModelOptions().forEach((m) => {
      const c = modelConfigs[m.value as keyof typeof modelConfigs] as { baseURL: string; apiKey: string; modelName?: string } | undefined;
      if (m.value === 'ollama') {
        configs[m.value] = c ? { ...c, apiKey: c.apiKey || 'ollama-no-key-needed' } : { baseURL: '', apiKey: 'ollama-no-key-needed' };
      } else {
        configs[m.value] = c ? { ...c } : { baseURL: '', apiKey: '' };
      }
    });
    setLocalModelConfigs(configs);

    if (configs['ollama']?.baseURL) {
      detectOllamaModels(configs['ollama'].baseURL);
    }
  }, [isOpen, saveConfig, modelConfigs, getUnifiedConfigSwitch, appearanceConfig]); // eslint-disable-line react-hooks/exhaustive-deps -- detectOllamaModels intentionally not in deps

  const detectOllamaModels = async (baseURL: string) => {
    if (!baseURL?.trim()) return;
    setOllamaLoading(true);
    try {
      const res = await fetch(`${baseURL}/api/tags`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const names = data.models?.map((m: { name: string }) => m.name) || [];
      setOllamaModels(names);
      if (names.length === 1 && !localModelConfigs['ollama']?.modelName) {
        setLocalModelConfigs((prev) => ({
          ...prev,
          ollama: { ...prev['ollama'], baseURL: prev['ollama']?.baseURL || '', apiKey: '', modelName: names[0] },
        }));
      }
    } catch {
      setOllamaModels([]);
    } finally {
      setOllamaLoading(false);
    }
  };

  const handleSave = async () => {
    setSaveConfig(localSaveConfig);
    setAppearanceConfig(localAppearance);
    await Promise.all(
      Object.entries(localUnifiedSwitches).map(([id, enabled]) => setUnifiedConfigSwitch(id, enabled))
    );

    // 保存统一配置
    for (const provider of MODEL_PROVIDER_GROUPS) {
      const unified = localModelConfigs[provider.unifiedConfigKey];
      if (unified?.baseURL?.trim() && unified?.apiKey?.trim()) {
        await setModelConfig(provider.unifiedConfigKey, { baseURL: unified.baseURL.trim(), apiKey: unified.apiKey.trim() });
        if (localUnifiedSwitches[provider.id] ?? true) {
          for (const modelValue of provider.models) {
            await setModelConfig(modelValue, { baseURL: unified.baseURL.trim(), apiKey: unified.apiKey.trim() });
          }
        }
      }
    }
    // 保存非统一配置的模型
    for (const provider of MODEL_PROVIDER_GROUPS) {
      if (localUnifiedSwitches[provider.id] ?? true) continue;
      for (const modelValue of provider.models) {
        const c = localModelConfigs[modelValue];
        if (c?.baseURL?.trim() || c?.apiKey?.trim()) {
          await setModelConfig(modelValue, {
            baseURL: (c.baseURL || '').trim(),
            apiKey: (c.apiKey || '').trim(),
          });
        }
      }
    }
    // 保存其他模型（仅 Ollama），包含选中的 modelName
    const c = localModelConfigs['ollama'];
    if (c) {
      const baseURL = (c.baseURL || '').trim();
      if (baseURL) {
        await setModelConfig('ollama', {
          baseURL,
          apiKey: c.apiKey || 'ollama-no-key-needed',
          modelName: c.modelName?.trim() || undefined,
        });
      }
    }
    onClose();
  };

  const handleCancel = () => {
    setLocalSaveConfig(saveConfig);
    setLocalAppearance(appearanceConfig);
    onClose();
  };

  const categories: { id: SettingsCategory; label: string; icon: typeof Save }[] = [
    { id: 'data', label: t('settings.save.title') || '数据与保存', icon: Save },
    { id: 'models', label: t('settings.models.title') || '模型 API', icon: Brain },
    { id: 'appearance', label: t('settings.theme.title') || '外观与语言', icon: Palette },
    { id: 'about', label: t('settings.about.title') || '关于', icon: Info },
  ];

  const workflowCount = Object.keys(workflows).length;
  const historyCount = generationHistory.length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="glass-strong menu-surface rounded-2xl w-[90vw] h-[85vh] max-w-4xl overflow-hidden flex flex-col border border-white/10"
        >
          <div className="p-6 border-b border-diffusion-border flex items-center justify-between shrink-0">
            <h2 className="text-xl font-semibold text-diffusion-text-primary">{t('settings.title')}</h2>
            <button onClick={handleCancel} className="text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-1 min-h-0">
            <div className="w-52 border-r border-diffusion-border flex flex-col shrink-0">
              <div className="p-3 space-y-1">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                        active ? 'bg-diffusion-bg-tertiary/60 text-diffusion-text-primary border border-white/10' : 'text-diffusion-text-secondary hover:bg-diffusion-bg-tertiary/50'
                      }`}
                    >
                      <Icon size={16} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex-1 overflow-y-auto custom-scrollbar glass-scrollbar p-6">
                {/* 数据与保存 */}
                {selectedCategory === 'data' && (
                  <div className="space-y-6">
                    <h2 className="text-lg font-semibold text-diffusion-text-primary">{t('settings.save.title') || '数据与保存'}</h2>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-lg border border-diffusion-border bg-diffusion-bg-tertiary/30">
                        <div>
                          <h3 className="text-sm font-medium text-diffusion-text-primary">{t('settings.save.enable') || '启用自动保存'}</h3>
                          <p className="text-xs text-diffusion-text-muted mt-0.5">{t('settings.save.enableHint') || '生成的内容自动保存到指定目录'}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={localSaveConfig.enabled}
                            onChange={(e) => setLocalSaveConfig({ ...localSaveConfig, enabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-diffusion-border rounded-full peer peer-checked:bg-accent after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                        </label>
                      </div>

                      {localSaveConfig.enabled && (
                        <>
                          <div className="flex items-center justify-between p-4 rounded-lg border border-diffusion-border bg-diffusion-bg-tertiary/30">
                            <div>
                              <h3 className="text-sm font-medium text-diffusion-text-primary">{t('settings.save.useRelativePath') || '使用相对路径'}</h3>
                              <p className="text-xs text-diffusion-text-muted mt-0.5">{t('settings.save.useRelativePathHint') || '相对路径相对于应用目录'}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={localSaveConfig.useRelativePath}
                                onChange={(e) => setLocalSaveConfig({ ...localSaveConfig, useRelativePath: e.target.checked })}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-diffusion-border rounded-full peer peer-checked:bg-accent after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                            </label>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-diffusion-text-primary mb-2">{t('settings.save.path') || '保存路径'}</label>
                            <input
                              type="text"
                              value={localSaveConfig.path}
                              onChange={(e) => setLocalSaveConfig({ ...localSaveConfig, path: e.target.value })}
                              placeholder={localSaveConfig.useRelativePath ? 'outputs' : 'D:\\outputs'}
                              className={INPUT_CLASS}
                              style={{ userSelect: 'text', cursor: 'text' }}
                            />
                          </div>
                        </>
                      )}

                      <div className="p-4 rounded-lg border border-diffusion-border-60 bg-diffusion-bg-tertiary/20 space-y-3">
                        <h3 className="text-sm font-medium text-diffusion-text-primary flex items-center gap-2">
                          <History size={14} />
                          {t('settings.data.historyTitle')}
                        </h3>
                        <p className="text-xs text-diffusion-text-muted">
                          {t('settings.data.historyDesc')}
                          {localSaveConfig.enabled ? t('settings.data.historyDescWithSave') : ''}
                        </p>
                        <p className="text-xs text-diffusion-text-muted">{t('settings.data.historyCount')}{historyCount}</p>
                      </div>
                      <div className="p-4 rounded-lg border border-diffusion-border-60 bg-diffusion-bg-tertiary/20 space-y-3">
                        <h3 className="text-sm font-medium text-diffusion-text-primary flex items-center gap-2">
                          <Workflow size={14} />
                          {t('settings.data.workflowTitle')}
                        </h3>
                        <p className="text-xs text-diffusion-text-muted">{t('settings.data.workflowDesc')}{workflowCount}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 模型 API（按提供商聚合） */}
                {selectedCategory === 'models' && (
                  <div className="space-y-6">
                    <h2 className="text-lg font-semibold text-diffusion-text-primary">{t('settings.models.title') || '模型 API'}</h2>
                    <p className="text-sm text-diffusion-text-muted">同一提供商的模型共用一个 Base URL 与 API Key，配置一次即可在所有相关节点中使用。</p>

                    {MODEL_PROVIDER_GROUPS.map((provider) => {
                      const unified = localModelConfigs[provider.unifiedConfigKey] || { baseURL: '', apiKey: '' };
                      const useUnified = localUnifiedSwitches[provider.id] ?? true;
                      return (
                        <div key={provider.id} className="p-4 rounded-lg border border-diffusion-border bg-diffusion-bg-tertiary/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-diffusion-text-primary">{provider.label}</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-diffusion-text-muted">统一配置</span>
                              <button
                                type="button"
                                onClick={() => setLocalUnifiedSwitches({ ...localUnifiedSwitches, [provider.id]: !useUnified })}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useUnified ? 'bg-accent' : 'bg-diffusion-border'}`}
                              >
                                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${useUnified ? 'translate-x-5' : 'translate-x-1'}`} />
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={unified.baseURL}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLocalModelConfigs((prev) => ({
                                ...prev,
                                [provider.unifiedConfigKey]: { ...unified, baseURL: v },
                              }));
                            }}
                            placeholder="API Base URL"
                            className={INPUT_CLASS}
                            style={{ userSelect: 'text', cursor: 'text' }}
                          />
                          <input
                            type="password"
                            value={unified.apiKey}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLocalModelConfigs((prev) => ({
                                ...prev,
                                [provider.unifiedConfigKey]: { ...unified, apiKey: v },
                              }));
                            }}
                            placeholder="API Key"
                            className={INPUT_CLASS}
                            style={{ userSelect: 'text', cursor: 'text' }}
                          />
                        </div>
                      );
                    })}

                    <div className="pt-2">
                      <h3 className="text-sm font-medium text-diffusion-text-primary mb-3">{t('settings.models.other') || '其他模型'}</h3>
                      <div className="p-3 rounded-lg border border-diffusion-border bg-diffusion-bg-tertiary/20 space-y-2">
                        <span className="text-xs font-medium text-diffusion-text-primary">Ollama</span>
                        {(() => {
                          const config = localModelConfigs['ollama'] || { baseURL: '', apiKey: 'ollama-no-key-needed' };
                          return (
                            <>
                              <input
                                type="text"
                                value={config.baseURL}
                                onChange={(e) =>
                                  setLocalModelConfigs((prev) => ({
                                    ...prev,
                                    ollama: { ...(prev['ollama'] || { apiKey: 'ollama-no-key-needed' }), baseURL: e.target.value },
                                  }))
                                }
                                placeholder="http://localhost:11434"
                                className={INPUT_CLASS}
                                style={{ userSelect: 'text', cursor: 'text' }}
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => detectOllamaModels(config.baseURL)}
                                  disabled={ollamaLoading || !config.baseURL?.trim()}
                                  className="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
                                >
                                  <RefreshCw size={12} className={ollamaLoading ? 'animate-spin' : ''} />
                                  {t('settings.models.detectOllama') || '检测模型'}
                                </button>
                              </div>
                              {ollamaModels.length > 0 && (
                                <CustomSelect
                                  value={config.modelName || ''}
                                  onChange={(v) =>
                                    setLocalModelConfigs((prev) => ({
                                      ...prev,
                                      ollama: { ...(prev['ollama'] || {}), baseURL: prev['ollama']?.baseURL || '', apiKey: 'ollama-no-key-needed', modelName: v },
                                    }))
                                  }
                                  options={[
                                    { value: '', label: t('settings.models.ollamaDefault') || '默认' },
                                    ...ollamaModels.map((name) => ({ value: name, label: name })),
                                  ]}
                                  placeholder={t('settings.models.ollamaDefault') || '默认'}
                                  className="w-full"
                                  size="md"
                                />
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* 外观与语言：仅保留画布背景图 + 语言 */}
                {selectedCategory === 'appearance' && (
                  <div className="space-y-6">
                    <h2 className="text-lg font-semibold text-diffusion-text-primary">{t('settings.theme.title')}</h2>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-diffusion-text-primary mb-2">{t('settings.theme.canvasBackgroundImage')}</label>
                        <p className="text-xs text-diffusion-text-muted mb-2">{t('settings.theme.canvasBackgroundImageHint')}</p>
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id="canvas-bg-file"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                setLocalAppearance((prev) => ({ ...prev, canvasBackgroundImage: String(reader.result) }));
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                          <label
                            htmlFor="canvas-bg-file"
                            className="px-3 py-2 rounded-lg border border-diffusion-border bg-diffusion-bg-tertiary/50 text-sm text-diffusion-text-primary hover:border-diffusion-glow-cyan cursor-pointer"
                          >
                            {t('settings.theme.uploadBackground')}
                          </label>
                          {(localAppearance.canvasBackgroundImage ?? '') && (
                            <>
                              <div
                                className="w-16 h-16 rounded border border-diffusion-border bg-diffusion-bg-tertiary/50 bg-cover bg-center"
                                style={{ backgroundImage: `url(${localAppearance.canvasBackgroundImage})` }}
                              />
                              <button
                                type="button"
                                onClick={() => setLocalAppearance((prev) => ({ ...prev, canvasBackgroundImage: '' }))}
                                className="text-xs px-2 py-1 rounded border border-diffusion-border text-diffusion-text-secondary hover:text-red-400"
                              >
                                {t('settings.theme.clearBackground')}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-diffusion-text-primary mb-3">{t('settings.language.select')}</label>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setLanguage('zh-CN')}
                            className={`flex-1 px-4 py-3 rounded-lg border text-sm transition-colors ${
                              language === 'zh-CN' ? 'bg-accent/25 text-diffusion-text-primary border-accent/60' : 'glass border-diffusion-border hover:border-accent/30 text-diffusion-text-secondary'
                            }`}
                          >
                            {t('settings.language.zh-CN')}
                          </button>
                          <button
                            onClick={() => setLanguage('en-US')}
                            className={`flex-1 px-4 py-3 rounded-lg border text-sm transition-colors ${
                              language === 'en-US' ? 'bg-accent/25 text-diffusion-text-primary border-accent/60' : 'glass border-diffusion-border hover:border-accent/30 text-diffusion-text-secondary'
                            }`}
                          >
                            {t('settings.language.en-US')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 关于 */}
                {selectedCategory === 'about' && (
                  <div className="space-y-6">
                    <h2 className="text-lg font-semibold text-diffusion-text-primary">{t('settings.about.title') || '关于'}</h2>
                    <div className="space-y-4 text-diffusion-text-secondary">
                      <div>
                        <h3 className="text-sm font-medium text-diffusion-text-primary">{APP_NAME} ({APP_SUBTITLE})</h3>
                        <p className="text-xs text-diffusion-text-muted mt-1">版本 1.0.0 · 基于节点的 AI 内容创建与自动化桌面应用</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-diffusion-text-primary mb-1">{t('settings.about.techStack') || '技术栈'}</h3>
                        <p className="text-xs text-diffusion-text-muted">React 18, TypeScript, React Flow, Electron, Tailwind CSS, Framer Motion, Zustand</p>
                      </div>
                      <p className="text-xs text-diffusion-text-muted">{t('settings.about.license') || 'MIT License'}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-diffusion-border flex justify-end gap-4 shrink-0">
                <button onClick={handleCancel} className="px-4 py-2 glass rounded-lg text-diffusion-text-primary hover:bg-diffusion-bg-tertiary transition-colors">
                  {t('settings.cancel') || '取消'}
                </button>
                <button onClick={handleSave} className="px-4 py-2 bg-accent/25 border border-accent/50 rounded-lg text-diffusion-text-primary hover:opacity-90 transition-opacity">
                  {t('settings.saveButton') || '保存'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SettingsModal;
