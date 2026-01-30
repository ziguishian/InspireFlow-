import React, { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/stores/uiStore';
import { History, FolderTree, Workflow, FileText, X, FileText as FileTextIcon, Image, Video, Box, Code, Upload, Eye, ChevronDown, ChevronRight, Folder, Save, Download, Edit2, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { exportWorkflow, downloadWorkflow, loadWorkflowFromFile, importWorkflow } from '@/utils/workflowIO';
import { getFileBlobURL, getFileDisplayURL } from '@/utils/fileSave';
import { RESOURCE_FILENAME_MATCH_REGEX } from '@/config/appName';
import { toast } from '@/utils/toast';

const LeftSidebar: React.FC = () => {
  const { leftSidebarContent, setLeftSidebarContent } = useUIStore();
  const { t } = useLanguage();
  const {
    workflows,
    openedWorkflowIds,
    activeWorkflowId,
    createWorkflow,
    openWorkflow,
    switchWorkflow,
    saveWorkflow,
    deleteWorkflow,
    updateWorkflowName,
    setNodes,
    setEdges,
  } = useWorkflowStore();
  const { generationHistory, clearGenerationHistory, deleteGenerationHistoryItem } = useSettingsStore();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [renamingWorkflowId, setRenamingWorkflowId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const nodeTemplates = [
    { type: 'textGen', label: 'sidebar.nodes.textGen', icon: FileTextIcon, category: 'generation', defaultData: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000, prompt: '', image: null } },
    { type: 'imageGen', label: 'sidebar.nodes.imageGen', icon: Image, category: 'generation', defaultData: { model: 'nanobanana', prompt: '', aspectRatio: '1:1', quality: '1K' } },
    { type: 'videoGen', label: 'sidebar.nodes.videoGen', icon: Video, category: 'generation', defaultData: { model: 'seedream-video', prompt: '', duration: 5, ratio: 'adaptive', watermark: false, generateAudio: false } },
    { type: '3dGen', label: 'sidebar.nodes.3dGen', icon: Box, category: 'generation', defaultData: { model: 'seedream-3d', prompt: '', format: 'glb', subdivisionLevel: 'medium' } },
    { type: 'scriptRunner', label: 'sidebar.nodes.scriptRunner', icon: Code, category: 'utility', defaultData: { language: 'python', code: '' } },
    { type: 'imageInput', label: 'sidebar.nodes.imageInput', icon: Upload, category: 'utility', defaultData: { image: null } },
    { type: 'textInput', label: 'sidebar.nodes.textInput', icon: FileTextIcon, category: 'utility', defaultData: { text: '' } },
    { type: 'videoInput', label: 'sidebar.nodes.videoInput', icon: Video, category: 'utility', defaultData: { video: null } },
    { type: '3dInput', label: 'sidebar.nodes.3dInput', icon: Box, category: 'utility', defaultData: { url: '', model: '' } },
    { type: 'textPreview', label: 'sidebar.nodes.textPreview', icon: Eye, category: 'preview', defaultData: {} },
    { type: 'imagePreview', label: 'sidebar.nodes.imagePreview', icon: Eye, category: 'preview', defaultData: { output: '' } },
    { type: 'videoPreview', label: 'sidebar.nodes.videoPreview', icon: Eye, category: 'preview', defaultData: {} },
    { type: '3dPreview', label: 'sidebar.nodes.3dPreview', icon: Eye, category: 'preview', defaultData: {} },
  ];

  const categories = useMemo(() => ([
    { id: 'generation', label: `sidebar.categories.generation` },
    { id: 'utility', label: `sidebar.categories.utility` },
    { id: 'preview', label: `sidebar.categories.preview` },
  ]), []);

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    generation: true,
    utility: true,
    preview: true,
  });

  const toggleCategory = useCallback((id: string) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleDragStart = useCallback((event: React.DragEvent, template: typeof nodeTemplates[0]) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(template));
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const renderNodeLibrary = () => {
    return (
      <div className="space-y-3">
        {categories.map((category) => {
          const isExpanded = expandedCategories[category.id];
          return (
            <div key={category.id} className="menu-surface rounded-xl border border-white/10 overflow-hidden">
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown size={14} className="text-diffusion-text-secondary" />
                ) : (
                  <ChevronRight size={14} className="text-diffusion-text-secondary" />
                )}
                <Folder size={14} className="text-diffusion-text-secondary" />
                <span className="font-medium">{t(category.label)}</span>
              </button>
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-2 pb-2"
                  >
                    <div className="space-y-1">
                      {nodeTemplates
                        .filter((template) => template.category === category.id)
                        .map((template) => {
                          const Icon = template.icon;
                          return (
                            <div
                              key={template.type}
                              draggable
                              onDragStart={(e) => handleDragStart(e, template)}
                              className="group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-colors cursor-move"
                            >
                              <Icon size={16} className="text-diffusion-text-secondary group-hover:text-diffusion-text-primary" />
                              <span>{t(template.label)}</span>
                            </div>
                          );
                        })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    );
  };

  const renderHistory = () => {
    const grouped = {
      text: generationHistory.filter((item) => item.type === 'text'),
      image: generationHistory.filter((item) => item.type === 'image'),
      video: generationHistory.filter((item) => item.type === 'video'),
      '3d': generationHistory.filter((item) => item.type === '3d'),
    };

    const renderGroup = (type: 'text' | 'image' | 'video' | '3d', title: string) => {
      const HistoryItem: React.FC<{ item: typeof generationHistory[0] }> = ({ item }) => {
        const [imageUrl, setImageUrl] = React.useState<string | null>(null);
        const [imageError, setImageError] = React.useState(false);

        React.useEffect(() => {
          // 处理不同类型的 URL
          const processUrl = async () => {
            // 优化策略：
            // 1. 如果有 filePath，优先从文件系统读取（Electron 或 IndexedDB）
            // 2. 如果 filePath 读取失败，回退到 url
            // 3. 如果只有 url，直接使用 url
            
            // 优先使用 filePath（如果存在）
            if (item.filePath) {
              try {
                const saveConfig = useSettingsStore.getState().saveConfig;
                const displayUrl = await getFileDisplayURL(item.filePath, item.type, saveConfig);
                if (displayUrl) {
                  setImageUrl(displayUrl);
                  return;
                } else {
                  // filePath 读取失败，回退到 url（如果有）
                  console.warn(`Failed to read file from filePath: ${item.filePath}, falling back to URL`);
                  if (item.url && item.url.trim() !== '') {
                    setImageUrl(item.url);
                    return;
                  }
                }
              } catch (error) {
                console.error('Failed to read file from filePath:', error);
                // filePath 读取失败，回退到 url（如果有）
                if (item.url && item.url.trim() !== '') {
                  setImageUrl(item.url);
                  return;
                }
                setImageError(true);
                return;
              }
            }
            
            // 如果没有 filePath，使用 url
            if (item.url && item.url.trim() !== '') {
              setImageUrl(item.url);
              return;
            }
            
            // 如果既没有 filePath 也没有 url，显示错误
            setImageError(true);
            
            // 如果是 file:// 协议（Electron 环境），转换为 data URL
            if (item.url.startsWith('file://')) {
              // 检查是否在 Electron 环境中
              if (typeof window !== 'undefined' && (window as any).electronAPI?.readFileAsDataUrl) {
                try {
                  // 从 file:// URL 提取路径（移除 file:// 前缀和开头的斜杠）
                  const filePath = decodeURIComponent(item.url.replace(/^file:\/\/\/?/, ''));
                  const dataUrl = await (window as any).electronAPI.readFileAsDataUrl({ filePath });
                  setImageUrl(dataUrl);
                  return;
                } catch (error) {
                  console.error('Failed to read file as data URL:', error);
                  // 如果失败，显示错误
                  setImageError(true);
                  return;
                }
              } else {
                // 浏览器环境，file:// URL 无法使用
                setImageError(true);
                return;
              }
            }
            
            // 如果是相对路径（保存的文件路径），尝试从 IndexedDB 加载
            if (!item.url.startsWith('http') && !item.url.startsWith('blob:') && !item.url.startsWith('data:') && !item.url.startsWith('file://')) {
              // 尝试从路径中提取文件名
              const fileNameMatch = item.url.match(RESOURCE_FILENAME_MATCH_REGEX);
              if (fileNameMatch) {
                const fileName = fileNameMatch[0];
                try {
                  const blobUrl = await getFileBlobURL(fileName);
                  if (blobUrl) {
                    setImageUrl(blobUrl);
                    return;
                  }
                } catch (error) {
                  console.error('Failed to load file from IndexedDB:', error);
                }
              }
            }
            
            // 其他情况（http、blob、data URL）直接使用
            setImageUrl(item.url);
          };

          processUrl();
        }, [item.url, item.filePath, item.type]);

        const handleImageError = () => {
          setImageError(true);
        };

        // 文本类型的特殊处理
        if (type === 'text') {
          const textContent = item.content || '';
          const preview = textContent.length > 50 ? textContent.substring(0, 50) + '...' : textContent;
          
          return (
            <div
              key={item.id}
              className="menu-surface rounded-lg border border-white/10 px-2 py-1.5 flex flex-col gap-2 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded border border-white/10 overflow-hidden bg-diffusion-bg-tertiary/40 flex items-center justify-center text-[10px] text-diffusion-text-muted">
                    <FileTextIcon size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-diffusion-text-primary">
                      {item.label || t('leftSidebar.historyTypeText')}
                    </span>
                    <span className="text-[10px] text-diffusion-text-muted">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={item.url}
                    download={`${item.id}.txt`}
                    className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    下载
                  </a>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(t('leftSidebar.confirmDeleteHistory'))) {
                        await deleteGenerationHistoryItem(item.id);
                      }
                    }}
                    className="p-1 rounded border border-white/10 text-diffusion-text-secondary hover:text-red-300 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    title={t('leftSidebar.delete')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-diffusion-text-secondary bg-diffusion-bg-tertiary/30 rounded px-2 py-1 max-h-20 overflow-y-auto">
                {preview || t('leftSidebar.emptyContent')}
              </div>
            </div>
          );
        }

        return (
          <div
            key={item.id}
            className="menu-surface rounded-lg border border-white/10 px-2 py-1.5 flex items-center justify-between gap-2 group"
          >
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded border border-white/10 overflow-hidden bg-diffusion-bg-tertiary/40 flex items-center justify-center text-[10px] text-diffusion-text-muted">
                {type === 'image' && imageUrl && !imageError && (
                  <img 
                    src={imageUrl} 
                    alt={item.label || 'thumbnail'} 
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                  />
                )}
                {type === 'image' && (!imageUrl || imageError) && (
                  <span className="text-[8px]">{t('leftSidebar.historyTypeImage')}</span>
                )}
                {type === 'video' && imageUrl && !imageError && (
                  <video
                    src={imageUrl}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    onError={handleImageError}
                  />
                )}
                {type === 'video' && (!imageUrl || imageError) && (
                  <span className="text-[8px]">{t('leftSidebar.historyTypeVideo')}</span>
                )}
                {type === '3d' && (
                  <span className="text-[8px]">{t('leftSidebar.historyType3d')}</span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-diffusion-text-primary">
                  {item.label || t('leftSidebar.generationResult')}
                </span>
                <span className="text-[10px] text-diffusion-text-muted">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <a
                href={imageUrl || item.url || '#'}
                download={imageUrl || item.url ? undefined : false}
                className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-colors"
                onClick={async (e) => {
                  e.stopPropagation();
                  // 如果只有 filePath，需要先读取文件再下载
                  if (item.filePath && (!item.url || item.url.trim() === '')) {
                    e.preventDefault();
                    try {
                      const saveConfig = useSettingsStore.getState().saveConfig;
                      const displayUrl = await getFileDisplayURL(item.filePath, item.type, saveConfig);
                      if (displayUrl) {
                        const link = document.createElement('a');
                        link.href = displayUrl;
                        link.download = `${item.label || 'output'}.${item.type === 'image' ? 'png' : item.type === 'video' ? 'mp4' : item.type === '3d' ? 'glb' : 'txt'}`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }
                    } catch (error) {
                      console.error('Failed to download file:', error);
                    }
                  }
                }}
              >
                {t('leftSidebar.download')}
              </a>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm(t('leftSidebar.confirmDeleteHistory'))) {
                    await deleteGenerationHistoryItem(item.id);
                  }
                }}
                className="p-1 rounded border border-white/10 text-diffusion-text-secondary hover:text-red-300 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                title={t('leftSidebar.delete')}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        );
      };

      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-diffusion-text-secondary">{title}</div>
            <span className="text-[10px] text-diffusion-text-muted">
              {grouped[type].length}
            </span>
          </div>
          {grouped[type].length === 0 ? (
            <div className="text-xs text-diffusion-text-muted">{t('leftSidebar.noRecords')}</div>
          ) : (
            <div className="space-y-1">
              {grouped[type].map((item) => (
                <HistoryItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-diffusion-text-secondary">{t('settings.data.historyTitle')}</div>
          <button
            onClick={async () => {
              if (confirm(t('leftSidebar.confirmClearHistory'))) await clearGenerationHistory();
            }}
            className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-colors"
          >
            {t('leftSidebar.clearHistory')}
          </button>
        </div>
        {renderGroup('text', t('leftSidebar.historyTypeText'))}
        {renderGroup('image', t('leftSidebar.historyTypeImage'))}
        {renderGroup('video', t('leftSidebar.historyTypeVideo'))}
        {renderGroup('3d', t('leftSidebar.historyType3d'))}
      </div>
    );
  };

  // workflowList 已移除，现在在 renderWorkflowList 中直接使用 workflows

  const handleSaveWorkflow = (workflowId: string) => {
    const workflow = workflows[workflowId];
    if (!workflow) return;
    // 如果工作流为空（没有节点），则不保存
    if (!workflow.nodes || workflow.nodes.length === 0) {
      toast.warning(t('layout.workflowEmpty'), 3000);
      return;
    }
    saveWorkflow(workflowId);
  };

  const handleSaveAs = (workflowId: string) => {
    const workflow = workflows[workflowId];
    if (!workflow) return;
    // 如果工作流为空（没有节点），则不保存
    if (!workflow.nodes || workflow.nodes.length === 0) {
      toast.warning(t('layout.workflowEmpty'), 3000);
      return;
    }
    const filename = `${workflow.name || 'workflow'}.json`;
    const data = exportWorkflow(workflow.nodes, workflow.edges);
    downloadWorkflow(data, filename);
  };

  const handleRenameWorkflow = (workflowId: string) => {
    const workflow = workflows[workflowId];
    if (!workflow) return;
    setRenamingWorkflowId(workflowId);
    setRenameValue(workflow.name || '');
  };

  const handleRenameSave = (workflowId: string) => {
    const nextName = renameValue.trim();
    if (nextName) {
      updateWorkflowName(workflowId, nextName);
    }
    setRenamingWorkflowId(null);
    setRenameValue('');
  };

  const handleImportWorkflow = async (file: File) => {
    try {
      const workflow = await loadWorkflowFromFile(file);
      const { nodes, edges } = importWorkflow(workflow);
      const id = createWorkflow(file.name.replace(/\.[^/.]+$/, '') || t('layout.importWorkflow'));
      setNodes(nodes);
      setEdges(edges);
      switchWorkflow(id);
    } catch (error) {
      alert(t('layout.loadFailed') + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const [workflowSearch, setWorkflowSearch] = useState('');

  const renderWorkflowList = () => {
    // 侧边栏只显示用户“主动保存(persisted)”的工作流
    const allWorkflows = Object.values(workflows)
      .filter((w) => w.persisted)
      .filter((w) => w.name.toLowerCase().includes(workflowSearch.trim().toLowerCase()));

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-diffusion-text-secondary">工作流列表</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => createWorkflow()}
              className="text-xs px-2 py-1 rounded border border-white/10 text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-colors"
            >
              {t('leftSidebar.newWorkflow')}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs px-2 py-1 rounded border border-white/10 text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-colors"
            >
              {t('leftSidebar.import')}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <input
            value={workflowSearch}
            onChange={(e) => setWorkflowSearch(e.target.value)}
            placeholder={t('leftSidebar.searchWorkflow')}
            className="w-full text-xs px-3 py-2 rounded-lg border border-white/10 bg-diffusion-bg-secondary/60 text-diffusion-text-primary placeholder:text-diffusion-text-muted focus:outline-none focus:border-diffusion-glow-cyan"
          />

          {/* 工作流列表 */}
          {allWorkflows.length === 0 ? (
            <div className="text-xs text-diffusion-text-muted px-1">{t('leftSidebar.noWorkflows')}</div>
          ) : (
            allWorkflows.map((workflow) => {
            const isActive = workflow.id === activeWorkflowId;
            const isOpened = openedWorkflowIds.includes(workflow.id);
            return (
              <div
                key={workflow.id}
                onClick={() => openWorkflow(workflow.id)}
                className={`menu-surface rounded-xl border px-3 py-2 cursor-pointer transition-colors ${
                  isActive ? 'border-white/20 bg-diffusion-bg-tertiary/40' : 'border-white/10 hover:bg-diffusion-bg-tertiary/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {renamingWorkflowId === workflow.id ? (
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRenameSave(workflow.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSave(workflow.id);
                          if (e.key === 'Escape') {
                            setRenamingWorkflowId(null);
                            setRenameValue('');
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs px-2 py-1 rounded border border-white/10 bg-diffusion-bg-secondary/70 text-diffusion-text-primary focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <>
                        <span 
                          className={`text-sm text-diffusion-text-primary truncate ${isOpened ? 'font-medium' : ''}`}
                          style={{ width: '4em', maxWidth: '4em', display: 'inline-block' }}
                          title={workflow.name}
                        >
                          {workflow.name}
                        </span>
                        {workflow.unsaved && <span className="w-1.5 h-1.5 rounded-full bg-diffusion-text-muted flex-shrink-0" />}
                        {isOpened && <span className="text-[10px] text-diffusion-text-muted">({t('leftSidebar.opened')})</span>}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveWorkflow(workflow.id);
                      }}
                      className="p-1 rounded border border-white/10 text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-colors"
                      title="保存"
                    >
                      <Save size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveAs(workflow.id);
                      }}
                      className="p-1 rounded border border-white/10 text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-colors"
                      title={t('leftSidebar.saveAs')}
                    >
                      <Download size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameWorkflow(workflow.id);
                      }}
                      className="p-1 rounded border border-white/10 text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-colors"
                      title="重命名"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(t('leftSidebar.confirmDeleteWorkflow'))) {
                          deleteWorkflow(workflow.id);
                        }
                      }}
                      className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-diffusion-text-secondary mt-1">
                  {workflow.lastSavedAt
                    ? `上次保存：${new Date(workflow.lastSavedAt).toLocaleString()}`
                    : '未保存'}
                </div>
              </div>
            );
          })
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportWorkflow(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
      </div>
    );
  };

  const contentMap = {
    history: { icon: History, label: t('settings.data.historyTitle'), content: renderHistory() },
    nodes: { icon: FolderTree, label: t('sidebar.title'), content: renderNodeLibrary() },
    workflow: { icon: Workflow, label: t('leftSidebar.workflows'), content: renderWorkflowList() },
    template: { icon: FileText, label: t('leftSidebar.workflows'), content: <div className="text-diffusion-text-secondary">Template</div> },
  };

  const currentContent = leftSidebarContent ? contentMap[leftSidebarContent] : null;

  if (!leftSidebarContent || !currentContent) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={leftSidebarContent}
        initial={{ x: '-100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '-100%', opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="absolute left-0 top-0 h-full glass-strong menu-surface border-r border-white/10 overflow-hidden z-50"
        style={{ width: '320px' }}
      >
        <div className="w-full h-full flex flex-col">
          <div className="p-4 border-b border-diffusion-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentContent && (
                <>
                  <currentContent.icon size={20} className="text-diffusion-text-secondary" />
                  <h2 className="text-lg font-semibold text-diffusion-text-primary">
                    {currentContent.label}
                  </h2>
                </>
              )}
            </div>
            <button
              onClick={() => setLeftSidebarContent(null)}
              className="p-1 rounded hover:bg-diffusion-bg-tertiary text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar glass-scrollbar p-4">
            {currentContent && (
              <div className="text-diffusion-text-secondary">
                {currentContent.content}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LeftSidebar;
