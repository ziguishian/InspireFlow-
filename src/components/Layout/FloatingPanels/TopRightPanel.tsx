import React, { useState, useRef, useEffect } from 'react';
import { Puzzle, Play, Square, List, PanelRightClose, PanelRightOpen, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { executeWorkflow } from '@/services/workflowExecutor';
import { getModelConfigKey } from '@/config/modelProviders';
import { MODEL_PROVIDER_GROUPS } from '@/config/modelProviders';
import { topologicalSort } from '@/utils/graphExecution';
import { toast } from '@/utils/toast';
import { formatMissingRequired, validateNodeRequired } from '@/utils/nodeValidation';

interface TopRightPanelProps {
  onToggleProperties: () => void;
  propertiesVisible: boolean;
}

const TopRightPanel: React.FC<TopRightPanelProps> = ({ onToggleProperties, propertiesVisible }) => {
  const { getNodes, getEdges, updateNodeData, activeWorkflowId } = useWorkflowStore();
  const nodes = getNodes();
  const edges = getEdges();
  const saveConfig = useSettingsStore((state) => state.saveConfig);
  const [isRunning, setIsRunning] = useState(false);
  const [runCount, setRunCount] = useState(1);
  const [currentRunIndex, setCurrentRunIndex] = useState(0); // 当前运行到第几次
  const [, setProgress] = useState({ current: 0, total: 0 });
  const [simulatedProgress, setSimulatedProgress] = useState(0); // 模拟进度
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [showLongRunningTip, setShowLongRunningTip] = useState(false);
  const [longRunningTipIndex, setLongRunningTipIndex] = useState(0);
  const queueButtonRef = useRef<HTMLDivElement>(null);
  const pluginsButtonRef = useRef<HTMLDivElement>(null);
  const stopRequestedRef = useRef(false);
  const progressAnimationRef = useRef<number | null>(null);
  const runStartTimeRef = useRef<number>(0);
  const longRunningTipTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longRunningTipCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const LONG_RUNNING_TIPS = [
    '3D 模型生成可能需要数分钟甚至数小时，请耐心等待',
    '生成时间取决于模型复杂度与服务器负载',
    '长时间未完成时可在节点上点击「运行」单独重试',
  ];

  const handleRun = async () => {
    if (nodes.length === 0) return;
    
    // 检查运行次数：如果小于等于0则不运行
    if (runCount <= 0) {
      toast.warning('运行次数必须大于0', 2000);
      return;
    }

    // 运行前：必填项校验（全图）
    const invalidNodes = nodes
      .filter((n) => !n.data?.skip)
      .map((n) => {
        const { missing } = validateNodeRequired(n, nodes, edges);
        return { node: n, missing };
      })
      .filter((x) => x.missing.length > 0);
    if (invalidNodes.length > 0) {
      // 给缺值节点打上 error 状态，方便用户定位
      for (const x of invalidNodes) {
        updateNodeData(x.node.id, { status: 'error' });
      }
      const preview = invalidNodes
        .slice(0, 3)
        .map((x) => `「${x.node.data?.label || x.node.type || x.node.id}」${formatMissingRequired(x.missing)}`)
        .join('；');
      toast.warning(
        `存在 ${invalidNodes.length} 个节点缺少必填项：${preview}${invalidNodes.length > 3 ? '…' : ''}。请补齐后再运行。`,
        6000
      );
      return;
    }
    
    // 检查所有生成节点是否配置了模型
    const generationNodes = nodes.filter((n) => 
      n.type && ['textGen', 'imageGen', 'videoGen', '3dGen'].includes(n.type)
    );
    
    if (generationNodes.length > 0) {
      const { getModelConfig, getUnifiedConfigSwitch } = useSettingsStore.getState();
      const unifiedConfigSwitches: Record<string, boolean> = {};
      MODEL_PROVIDER_GROUPS.forEach((g) => {
        unifiedConfigSwitches[g.id] = getUnifiedConfigSwitch(g.id);
      });
      const unconfiguredModels: string[] = [];

      for (const node of generationNodes) {
        const model = node.data?.model ?? (node.type
          ? { textGen: 'openai', imageGen: 'nanobanana', videoGen: 'seedream-video', '3dGen': 'seedream-3d' }[node.type]
          : null);
        if (!model) continue;
        const configKey = getModelConfigKey(model, unifiedConfigSwitches);
        const config = getModelConfig(configKey);
        const isLocalModel = model.toLowerCase() === 'ollama';
        if (isLocalModel) {
          const hasBaseURL = config && config.baseURL && config.baseURL.trim() !== '';
          if (!hasBaseURL) unconfiguredModels.push(configKey);
        } else {
          const hasBaseURL = config && config.baseURL && config.baseURL.trim() !== '';
          const hasApiKey = config && config.apiKey && config.apiKey.trim() !== '';
          if (!hasBaseURL || !hasApiKey) unconfiguredModels.push(configKey);
        }
      }
      
      if (unconfiguredModels.length > 0) {
        const uniqueModels = [...new Set(unconfiguredModels)];
        const localModels = uniqueModels.filter(m => m.toLowerCase() === 'ollama');
        const otherModels = uniqueModels.filter(m => m.toLowerCase() !== 'ollama');
        const toDisplayName = (key: string) => key === 'seedream-ark' ? 'Seedream (方舟 API)' : key;
        let errorMessage = '';
        if (localModels.length > 0) {
          errorMessage += `以下本地模型未配置：${localModels.join('、')}。请前往设置配置这些模型的 API Base URL（不需要 API Key）。`;
        }
        if (otherModels.length > 0) {
          if (errorMessage) errorMessage += ' ';
          errorMessage += `以下模型未配置：${otherModels.map(toDisplayName).join('、')}。请前往设置配置这些模型的 API Base URL 和 API Key。`;
        }
        toast.error(errorMessage, 8000);
        return;
      }
    }
    
    setIsRunning(true);
    setShowLongRunningTip(false);
    setLongRunningTipIndex(0);
    stopRequestedRef.current = false;
    setProgress({ current: 0, total: 0 });
    setCurrentRunIndex(0); // 重置当前运行索引
    setSimulatedProgress(0); // 重置模拟进度
    setElapsedSeconds(0);
    runStartTimeRef.current = Date.now();

    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    elapsedTimerRef.current = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - runStartTimeRef.current) / 1000));
    }, 1000) as unknown as ReturnType<typeof setInterval>;

    if (longRunningTipTimerRef.current) {
      clearInterval(longRunningTipTimerRef.current);
      longRunningTipTimerRef.current = null;
    }
    if (longRunningTipCycleRef.current) {
      clearInterval(longRunningTipCycleRef.current);
      longRunningTipCycleRef.current = null;
    }
    longRunningTipTimerRef.current = window.setInterval(() => {
      if (Date.now() - runStartTimeRef.current >= 30_000) {
        setShowLongRunningTip(true);
        if (longRunningTipTimerRef.current) {
          clearInterval(longRunningTipTimerRef.current);
          longRunningTipTimerRef.current = null;
        }
      }
    }, 1000) as unknown as ReturnType<typeof setInterval>;
    longRunningTipCycleRef.current = window.setInterval(() => {
      setLongRunningTipIndex((i) => (i + 1) % LONG_RUNNING_TIPS.length);
    }, 5000) as unknown as ReturnType<typeof setInterval>;
    
    // 开始模拟进度动画（先快后慢）
    const startTime = Date.now();
    const duration = 30000; // 30秒总时长
    const isRunningRef = { current: true }; // 使用ref来跟踪运行状态
    
    const animateProgress = () => {
      if (stopRequestedRef.current || !isRunningRef.current) {
        if (progressAnimationRef.current) {
          cancelAnimationFrame(progressAnimationRef.current);
          progressAnimationRef.current = null;
        }
        return;
      }
      
      const elapsed = Date.now() - startTime;
      let progressValue = 0;
      
      if (elapsed < duration) {
        // 先快后慢的缓动函数 (ease-out cubic)
        const t = elapsed / duration;
        progressValue = 1 - Math.pow(1 - t, 3); // cubic ease-out
        progressValue = Math.min(progressValue * 100, 99); // 最多到99%，等待实际完成
      } else {
        progressValue = 99; // 如果超过30秒还没完成，保持在99%
      }
      
      setSimulatedProgress(progressValue);
      
      if (isRunningRef.current && progressValue < 99) {
        progressAnimationRef.current = requestAnimationFrame(animateProgress);
      }
    };
    
    progressAnimationRef.current = requestAnimationFrame(animateProgress);
    
    try {
      // 运行指定次数（runCount 已经确保 >= 1）
      const times = runCount;
      const executionOrder = topologicalSort(nodes, edges);
      
      for (let i = 0; i < times; i++) {
        if (stopRequestedRef.current) break;
        
        // 更新当前运行索引
        setCurrentRunIndex(i + 1);
        
        // 每次循环开始时，重置所有节点状态为 'idle'
        nodes.forEach((node) => updateNodeData(node.id, { status: 'idle' }));
        
        // 重置进度
        setProgress({ current: 0, total: executionOrder.length });
        
        const results = await executeWorkflow(nodes, edges, {
          shouldStop: () => stopRequestedRef.current,
          onProgress: (current, total) => {
            setProgress({ current, total });
          },
          onNodeStart: (nodeId) => {
            // 节点开始执行时，设置为 'running'
            updateNodeData(nodeId, { status: 'running' });
          },
          onNodeComplete: () => {
            // 节点执行完成时，状态会在结果处理中更新，这里不需要额外操作
            // 但可以确保状态正确更新
          },
          saveConfig, // 传递保存配置，以便 autoSaveNodeOutput 能够自动保存生成的内容
          workflowId: activeWorkflowId || undefined, // 传递工作流 ID
        });
        
        // 使用 for...of 循环以支持 await
        for (const result of results) {
          if (result.success) {
            if (result.skipped) {
              updateNodeData(result.nodeId, { status: 'idle' });
              continue;
            }
            updateNodeData(result.nodeId, {
              output: result.output,
              ...(result.outputs || {}),
              status: 'success',
            });
            
            // 注意：保存逻辑已由 workflowExecutor.ts 中的 autoSaveNodeOutput 统一处理
            // 这里不再重复保存，避免重复记录
          } else {
            // 显示错误提示
            updateNodeData(result.nodeId, { status: 'error' });
            if (result.error) {
              // 检查是否是模型配置错误
              if (result.error.includes('未配置') || result.error.includes('配置不完整')) {
                toast.error(result.error + '，请前往设置配置模型', 5000);
              } else {
                toast.error(`节点执行失败: ${result.error}`, 5000);
              }
            }
          }
        }
        
        // 如果不是最后一次循环，等待一小段时间
        if (i < times - 1 && !stopRequestedRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    } catch (error) {
      console.error('Execution failed:', error);
      nodes.forEach((node) => updateNodeData(node.id, { status: 'error' }));
    } finally {
      if (longRunningTipTimerRef.current) {
        clearInterval(longRunningTipTimerRef.current);
        longRunningTipTimerRef.current = null;
      }
      if (longRunningTipCycleRef.current) {
        clearInterval(longRunningTipCycleRef.current);
        longRunningTipCycleRef.current = null;
      }
      setShowLongRunningTip(false);
      // 停止动画
      isRunningRef.current = false;
      if (progressAnimationRef.current) {
        cancelAnimationFrame(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
      // 确保进度条到达100%
      setSimulatedProgress(100);
      // 短暂延迟后重置
      setTimeout(() => {
        if (elapsedTimerRef.current) {
          clearInterval(elapsedTimerRef.current);
          elapsedTimerRef.current = null;
        }
        setIsRunning(false);
        setProgress({ current: 0, total: 0 });
        setCurrentRunIndex(0); // 重置当前运行索引
        setSimulatedProgress(0);
      }, 500);
    }
  };

  const handleStop = () => {
    stopRequestedRef.current = true;
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    setIsRunning(false);
    setSimulatedProgress(0);
    if (progressAnimationRef.current) {
      cancelAnimationFrame(progressAnimationRef.current);
      progressAnimationRef.current = null;
    }
  };
  
  // 清理动画与计时器
  useEffect(() => {
    return () => {
      if (progressAnimationRef.current) {
        cancelAnimationFrame(progressAnimationRef.current);
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    };
  }, []);

  // 点击外部关闭弹出框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (queueOpen && queueButtonRef.current && !queueButtonRef.current.contains(target)) {
        const queuePopup = document.querySelector('[data-queue-popup]');
        if (queuePopup && !queuePopup.contains(target)) {
          setQueueOpen(false);
        }
      }
      if (pluginsOpen && pluginsButtonRef.current && !pluginsButtonRef.current.contains(target)) {
        const pluginsPopup = document.querySelector('[data-plugins-popup]');
        if (pluginsPopup && !pluginsPopup.contains(target)) {
          setPluginsOpen(false);
        }
      }
    };
    if (queueOpen || pluginsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [queueOpen, pluginsOpen]);

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-2"
      >
      {/* 插件 */}
      <div className="relative" ref={pluginsButtonRef}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setPluginsOpen(!pluginsOpen)}
          className="glass-strong rounded-lg p-2.5 border border-white/10 backdrop-blur-2xl text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-all h-[42px] flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          }}
          title="插件"
        >
          <Puzzle size={18} />
        </motion.button>
        
        <AnimatePresence>
          {pluginsOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full right-0 mt-2 glass-strong rounded-xl border border-white/10 backdrop-blur-2xl shadow-2xl p-4 min-w-[300px]"
              data-plugins-popup
              style={{
                background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.98) 0%, rgba(10, 10, 15, 0.99) 100%)',
                boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div className="text-sm text-diffusion-text-primary mb-2">插件管理</div>
              <div className="text-xs text-diffusion-text-secondary">暂无插件</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 运行组 */}
      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRun}
          disabled={isRunning || nodes.length === 0}
          className="rounded-lg px-4 py-2.5 border border-blue-500/30 backdrop-blur-2xl text-white hover:text-blue-100 transition-all flex items-center gap-2 disabled:opacity-50 h-[42px] relative overflow-hidden"
          style={{
            background: isRunning 
              ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(37, 99, 235, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 1) 100%)',
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.5)',
          }}
          title="运行"
        >
          <Play size={16} />
          <span className="text-sm font-medium">
            {isRunning && runCount > 1
              ? `${currentRunIndex}/${runCount}`
              : '运行'}
          </span>
        </motion.button>

        {/* 运行次数和取消运行 */}
        <div className="flex items-center gap-1 h-[42px]">
          <div className="glass-strong rounded-lg border border-white/10 h-full flex items-center overflow-hidden">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={runCount}
              onChange={(e) => {
                const val = parseInt(e.target.value.replace(/[^\d]/g, ''), 10) || 1;
                setRunCount(Math.max(1, val));
              }}
              onBlur={(e) => {
                // 失去焦点时确保值至少为1
                const val = parseInt(e.target.value.replace(/[^\d]/g, ''), 10) || 1;
                setRunCount(Math.max(1, val));
              }}
              className="w-12 px-2 py-1 text-xs text-diffusion-text-primary text-center bg-transparent border-0 focus:outline-none focus:ring-0 h-full flex items-center justify-center"
            />
            <div className="flex flex-col h-full border-l border-white/5">
              <button
                onClick={() => setRunCount(runCount + 1)}
                className="px-1.5 py-0.5 text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-colors h-1/2 flex items-center justify-center w-full border-b border-white/5"
              >
                <ChevronUp size={12} />
              </button>
              <button
                onClick={() => setRunCount(Math.max(1, runCount - 1))}
                className="px-1.5 py-0.5 text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-colors h-1/2 flex items-center justify-center w-full disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={runCount <= 1}
              >
                <ChevronDown size={12} />
              </button>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: isRunning ? 1.05 : 1 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStop}
            disabled={!isRunning}
            className="glass-strong rounded-lg p-2.5 border border-red-500/30 backdrop-blur-2xl text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed h-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(239, 68, 68, 0.3)',
            }}
            title="取消运行"
          >
            <Square size={16} />
          </motion.button>
        </div>
      </div>

      {/* 任务队列 */}
      <div className="relative" ref={queueButtonRef}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setQueueOpen(!queueOpen)}
          className="glass-strong rounded-lg p-2.5 border border-white/10 backdrop-blur-2xl text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-all h-[42px] flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          }}
          title="任务队列"
        >
          <List size={18} />
        </motion.button>
        
        <AnimatePresence>
          {queueOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full right-0 mt-2 glass-strong rounded-xl border border-white/10 backdrop-blur-2xl shadow-2xl p-4 min-w-[250px]"
              data-queue-popup
              style={{
                background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.98) 0%, rgba(10, 10, 15, 0.99) 100%)',
                boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div className="text-sm text-diffusion-text-primary mb-2">任务队列</div>
              <div className="text-xs text-diffusion-text-secondary">暂无任务</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 属性侧边栏开关 */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        onClick={onToggleProperties}
        className={`glass-strong rounded-lg p-2.5 border backdrop-blur-2xl transition-all h-[42px] flex items-center justify-center z-40 ${
          propertiesVisible
            ? 'border-diffusion-glow-cyan/30 text-diffusion-glow-cyan bg-diffusion-glow-cyan/10'
            : 'border-white/10 text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50'
        }`}
        style={{
          background: propertiesVisible
            ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(18, 18, 26, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(18, 18, 26, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
        title={propertiesVisible ? '隐藏属性栏' : '显示属性栏'}
      >
        {propertiesVisible ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
      </motion.button>
      </motion.div>
      
      {/* 进度条与长时间运行提示 */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-[374px] flex flex-col items-end gap-1.5"
          >
            <div
              className="w-full h-1.5 rounded-full overflow-hidden glass-strong border border-white/10"
              style={{
                background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
              }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.8) 0%, rgba(37, 99, 235, 0.9) 50%, rgba(59, 130, 246, 1) 100%)',
                  boxShadow: '0 0 8px rgba(59, 130, 246, 0.6)',
                }}
                initial={{ width: '0%' }}
                animate={{ width: `${simulatedProgress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
            <div className="w-full flex justify-between items-center gap-2 min-h-[1.25rem]">
              <span className="text-[11px] text-diffusion-text-muted tabular-nums" title="生成已用时间">
                {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
              </span>
              <AnimatePresence mode="wait">
                {showLongRunningTip && (
                  <motion.p
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.2 }}
                    key={longRunningTipIndex}
                    className="text-[11px] text-diffusion-text-muted text-right max-w-[260px] px-1 flex-shrink"
                  >
                    {LONG_RUNNING_TIPS[longRunningTipIndex]}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TopRightPanel;
