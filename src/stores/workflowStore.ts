import { create } from 'zustand';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow';
import { WorkflowNode } from '@/types';
import { getHandleType } from '@/nodes/handleSchema';
import { getEdgeColor } from '@/utils/colorUtils';
import { database } from '@/utils/database';

export interface WorkflowData {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  unsaved?: boolean;
  lastSavedAt?: string;
  persisted?: boolean; // 是否已被用户“保存”到侧边栏/数据库
}

interface WorkflowSnapshot {
  nodes: Node[];
  edges: Edge[];
}

interface WorkflowStore {
  workflows: Record<string, WorkflowData>;
  openedWorkflowIds: string[]; // 在标签栏中打开的工作流 ID 列表
  activeWorkflowId: string | null;
  selectedNodeId: string | null;
  history: Record<string, { past: WorkflowSnapshot[]; future: WorkflowSnapshot[] }>;
  
  // 当前工作流的快捷访问
  getCurrentWorkflow: () => WorkflowData | null;
  getNodes: () => Node[];
  getEdges: () => Edge[];
  
  // 工作流管理
  createWorkflow: (name?: string) => string;
  openWorkflow: (workflowId: string) => void; // 打开工作流（添加到标签栏）
  closeWorkflow: (workflowId: string) => void; // 关闭工作流（从标签栏移除，不删除）
  reorderOpenedWorkflows: (workflowIds: string[]) => void; // 重新排序已打开的工作流
  switchWorkflow: (workflowId: string) => void;
  deleteWorkflow: (workflowId: string) => void;
  updateWorkflowName: (workflowId: string, name: string) => void;
  saveWorkflow: (workflowId: string) => void;
  loadWorkflows: () => void;
  
  undo: () => void;
  redo: () => void;
  
  // 节点和边的操作（自动保存到当前工作流）
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNode['data']>) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  clearWorkflow: () => void;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => {
  // 初始化第一个工作流
  const initialWorkflowId = '1';
  const initialWorkflow: WorkflowData = {
    id: initialWorkflowId,
    name: '未命名工作流',
    nodes: [],
    edges: [],
    unsaved: true,
    persisted: false,
  };

  const cloneSnapshot = (snapshot: WorkflowSnapshot): WorkflowSnapshot => ({
    nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
    edges: JSON.parse(JSON.stringify(snapshot.edges)),
  });

  const getCurrentSnapshot = (workflow: WorkflowData): WorkflowSnapshot => ({
    nodes: JSON.parse(JSON.stringify(workflow.nodes)),
    edges: JSON.parse(JSON.stringify(workflow.edges)),
  });

  // 定时自动保存（每2分钟）
  let autoSaveInterval: NodeJS.Timeout | null = null;
  
  // 立即保存函数（用于手动保存）
  const persistWorkflowsImmediate = async (workflows: Record<string, WorkflowData>, activeWorkflowId: string | null) => {
    // 完全使用数据库存储，不再使用 localStorage
    try {
      // 仅保存“用户已保存(persisted)”的工作流到数据库
      for (const workflow of Object.values(workflows).filter((w) => w.persisted)) {
        try {
          await database.saveWorkflow(workflow);
        } catch (error) {
          console.error(`保存工作流 ${workflow.id} 失败:`, error);
          // 继续保存其他工作流，不中断整个流程
        }
      }
      
      // 保存当前活动工作流 ID 到设置
      try {
        await database.saveSettings('workflow', { activeWorkflowId });
      } catch (error) {
        console.error('保存活动工作流ID失败:', error);
      }
    } catch (error) {
      console.error('保存工作流到数据库失败:', error);
    }
  };
  
  // 标记需要保存（不立即保存，等待定时器）
  // 注意：此函数不再保存到 localStorage，只标记状态，由定时器负责保存到数据库
  const markWorkflowUnsaved = (_workflows: Record<string, WorkflowData>, _activeWorkflowId: string | null) => {
    // 不再使用 localStorage，数据会通过定时器保存到数据库
    // 这个函数现在只用于标记状态，实际的保存由 persistWorkflowsImmediate 处理
  };

  // 启动定时自动保存（每2分钟）
  if (typeof window !== 'undefined') {
    autoSaveInterval = setInterval(() => {
      const { workflows, activeWorkflowId } = get();
      // 只自动保存已 persisted 的工作流
      persistWorkflowsImmediate(workflows, activeWorkflowId);
    }, 2 * 60 * 1000); // 2分钟
    void autoSaveInterval; // 供 noUnusedLocals：定时器 id 可后续用于 clearInterval
  }

  return {
    workflows: {
      [initialWorkflowId]: initialWorkflow,
    },
    openedWorkflowIds: [initialWorkflowId], // 初始工作流默认打开
    activeWorkflowId: initialWorkflowId,
    selectedNodeId: null,
    history: {},

    getCurrentWorkflow: () => {
      const { workflows, activeWorkflowId } = get();
      return activeWorkflowId ? workflows[activeWorkflowId] || null : null;
    },

    getNodes: () => {
      const workflow = get().getCurrentWorkflow();
      return workflow?.nodes || [];
    },

    getEdges: () => {
      const workflow = get().getCurrentWorkflow();
      return workflow?.edges || [];
    },

    createWorkflow: (name) => {
      const newId = Date.now().toString();
      const newWorkflow: WorkflowData = {
        id: newId,
        name: name || `未命名工作流 ${Object.keys(get().workflows).length + 1}`,
        nodes: [],
        edges: [],
        unsaved: true,
        persisted: false,
      };
      const state = get();
      const nextWorkflows = { ...state.workflows, [newId]: newWorkflow };
      
      set({
        workflows: nextWorkflows,
        openedWorkflowIds: [...state.openedWorkflowIds, newId], // 新建的工作流自动打开
        activeWorkflowId: newId,
        selectedNodeId: null,
      });
      
      return newId;
    },

    openWorkflow: (workflowId) => {
      const state = get();
      if (!state.workflows[workflowId]) {
        console.warn(`[openWorkflow] 工作流 ${workflowId} 不存在`);
        return;
      }
      
      // 如果已经在打开列表中，只切换
      if (state.openedWorkflowIds.includes(workflowId)) {
        set({ activeWorkflowId: workflowId, selectedNodeId: null });
        return;
      }
      
      // 添加到打开列表并切换
      set({
        openedWorkflowIds: [...state.openedWorkflowIds, workflowId],
        activeWorkflowId: workflowId,
        selectedNodeId: null,
      });
    },

    closeWorkflow: (workflowId) => {
      const state = get();
      if (!state.openedWorkflowIds.includes(workflowId)) {
        return; // 已经关闭了
      }
      
      const newOpenedIds = state.openedWorkflowIds.filter(id => id !== workflowId);
      
      // 如果关闭的是当前活动工作流，切换到其他打开的工作流
      let newActiveId = state.activeWorkflowId;
      if (workflowId === state.activeWorkflowId) {
        newActiveId = newOpenedIds.length > 0 ? newOpenedIds[newOpenedIds.length - 1] : null;
      }
      
      set({
        openedWorkflowIds: newOpenedIds,
        activeWorkflowId: newActiveId,
        selectedNodeId: null,
      });
    },

    reorderOpenedWorkflows: (workflowIds) => {
      set({ openedWorkflowIds: workflowIds });
    },

    switchWorkflow: (workflowId) => {
      const { workflows, openedWorkflowIds } = get();
      if (workflows[workflowId]) {
        // 如果工作流不在打开列表中，先打开它
        if (!openedWorkflowIds.includes(workflowId)) {
          set({
            openedWorkflowIds: [...openedWorkflowIds, workflowId],
            activeWorkflowId: workflowId,
            selectedNodeId: null,
          });
        } else {
          set({ activeWorkflowId: workflowId, selectedNodeId: null });
        }
      }
    },

    deleteWorkflow: async (workflowId) => {
      const { workflows, activeWorkflowId, openedWorkflowIds } = get();
      const deleting = workflows[workflowId];
      const newWorkflows = { ...workflows };
      delete newWorkflows[workflowId];

      // 从打开列表中移除
      let newOpenedIds = openedWorkflowIds.filter(id => id !== workflowId);

      let newActiveId = activeWorkflowId;
      if (activeWorkflowId === workflowId) {
        // 如果删除的是当前活动工作流，切换到其他工作流
        newActiveId = newOpenedIds.length > 0 ? newOpenedIds[newOpenedIds.length - 1] : null;
      }

      // 允许全部删除：如果删到空，则自动创建一个新的临时工作流，保证画布可用
      if (Object.keys(newWorkflows).length === 0) {
        const newId = Date.now().toString();
        const fallbackWorkflow: WorkflowData = {
          id: newId,
          name: '未命名工作流',
          nodes: [],
          edges: [],
          unsaved: true,
          persisted: false,
        };
        newWorkflows[newId] = fallbackWorkflow;
        newOpenedIds = [newId];
        newActiveId = newId;
      }

      // 先更新状态
      set({
        workflows: newWorkflows,
        openedWorkflowIds: newOpenedIds,
        activeWorkflowId: newActiveId,
        selectedNodeId: null,
      });

      // 只有 persisted 的工作流才需要删数据库
      if (deleting?.persisted) {
        try {
          await database.deleteWorkflow(workflowId);
          console.log(`[deleteWorkflow] 工作流 ${workflowId} 已从数据库删除`);
        } catch (error) {
          console.error('从数据库删除工作流失败:', error);
        }
      }
    },

    updateWorkflowName: async (workflowId, name) => {
      const state = get();
      const workflow = state.workflows[workflowId];
      if (!workflow) {
        console.warn(`[updateWorkflowName] 工作流 ${workflowId} 不存在`);
        return;
      }
      
      const updatedWorkflow = { ...workflow, name, unsaved: true };
      const nextWorkflows = {
        ...state.workflows,
        [workflowId]: updatedWorkflow,
      };
      
      // 先更新状态
      set({
        workflows: nextWorkflows,
      });
      
      // 仅 persisted 的工作流才会写入数据库
      if (workflow.persisted) {
        try {
          await persistWorkflowsImmediate(nextWorkflows, state.activeWorkflowId);
          console.log(`[updateWorkflowName] 工作流 ${workflowId} 名称已更新并保存`);
        } catch (error) {
          console.error(`[updateWorkflowName] 保存工作流失败:`, error);
        }
      }
    },

    // 文件夹功能已移除

    saveWorkflow: async (workflowId) => {
      const state = get();
      const workflow = state.workflows[workflowId];
      if (!workflow) {
        console.warn(`[saveWorkflow] 工作流 ${workflowId} 不存在`);
        return;
      }
      
      // 如果工作流为空（没有节点），则不保存
      if (!workflow.nodes || workflow.nodes.length === 0) {
        console.warn(`[saveWorkflow] 工作流 ${workflowId} 为空，跳过保存`);
        return;
      }
      
      const updatedWorkflow = { 
        ...workflow, 
        unsaved: false, 
        lastSavedAt: new Date().toISOString(),
        persisted: true,
      };
      
      // 先更新状态
      set((state) => ({
        workflows: {
          ...state.workflows,
          [workflowId]: updatedWorkflow,
        },
      }));
      
      // 用户主动保存：写入数据库（只会保存 persisted 的工作流）
      try {
        await persistWorkflowsImmediate(
          { ...state.workflows, [workflowId]: updatedWorkflow },
          state.activeWorkflowId
        );
        console.log(`[saveWorkflow] 工作流 ${workflowId} 保存成功`);
      } catch (error) {
        console.error(`[saveWorkflow] 保存工作流 ${workflowId} 失败:`, error);
        // 即使保存失败，状态也已经更新了
      }
    },

    loadWorkflows: async () => {
      // 优先从数据库加载
      try {
        const workflows = await database.getAllWorkflows();
        const settings = await database.getSettings('workflow');
        
        if (workflows && Object.keys(workflows).length > 0) {
          console.log(`[loadWorkflows] 从数据库加载了 ${Object.keys(workflows).length} 个工作流`);
          const activeId = settings?.activeWorkflowId ?? Object.keys(workflows)[0];

          // 数据库里的都视为已 persisted
          const persistedWorkflows: Record<string, WorkflowData> = {};
          for (const [id, wf] of Object.entries(workflows)) {
            persistedWorkflows[id] = { ...wf, persisted: true };
          }

          set({
            workflows: persistedWorkflows,
            openedWorkflowIds: [activeId],
            activeWorkflowId: activeId,
            selectedNodeId: null,
          });
          
          // 尝试从 localStorage 迁移旧数据（一次性迁移）
          try {
            const saved = localStorage.getItem('matrixinspire-workflows');
            if (saved) {
              const parsed = JSON.parse(saved) as 
                | {
                    workflows?: Record<string, WorkflowData>; // 旧格式：包含所有工作流
                    activeWorkflow?: WorkflowData; // 新格式：只包含当前活动工作流
                    activeWorkflowId: string | null;
                    workflowIds?: string[]; // 新格式：工作流ID列表
                  };
              
              // 处理旧格式（包含所有工作流）
              if (parsed?.workflows && Object.keys(parsed.workflows).length > 0) {
                console.log(`[loadWorkflows] 发现 localStorage 中的旧数据，迁移到数据库...`);
                try {
                  for (const workflow of Object.values(parsed.workflows)) {
                    await database.saveWorkflow(workflow);
                  }
                  await database.saveSettings('workflow', { activeWorkflowId: parsed.activeWorkflowId });
                  console.log('[loadWorkflows] 旧数据已迁移到数据库');
                  // 迁移完成后清除 localStorage
                  localStorage.removeItem('matrixinspire-workflows');
                } catch (e) {
                  console.error('迁移工作流到数据库失败:', e);
                }
              }
              
              // 处理新格式（只包含当前活动工作流）
              if (parsed?.activeWorkflow && parsed.activeWorkflowId) {
                console.log(`[loadWorkflows] 发现 localStorage 中的旧数据，迁移到数据库...`);
                try {
                  await database.saveWorkflow(parsed.activeWorkflow);
                  await database.saveSettings('workflow', { activeWorkflowId: parsed.activeWorkflowId });
                  console.log('[loadWorkflows] 旧数据已迁移到数据库');
                  // 迁移完成后清除 localStorage
                  localStorage.removeItem('matrixinspire-workflows');
                } catch (e) {
                  console.error('迁移工作流到数据库失败:', e);
                }
              }
            }
          } catch (e) {
            // 迁移失败不影响正常使用
            console.warn('迁移 localStorage 数据失败:', e);
          }
          
          return;
        }
      } catch (error) {
        console.error('从数据库加载工作流失败:', error);
      }
      
      // 如果数据库加载失败或没有数据，尝试从 localStorage 迁移（仅作为最后的回退）
      const saved = localStorage.getItem('matrixinspire-workflows');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as 
            | {
                workflows?: Record<string, WorkflowData>; // 旧格式：包含所有工作流
                activeWorkflow?: WorkflowData; // 新格式：只包含当前活动工作流
                activeWorkflowId: string | null;
                workflowIds?: string[]; // 新格式：工作流ID列表
              };
          
          // 处理旧格式（包含所有工作流）
          if (parsed?.workflows && Object.keys(parsed.workflows).length > 0) {
            console.log(`[loadWorkflows] 从 localStorage 迁移 ${Object.keys(parsed.workflows).length} 个工作流到数据库`);
            set({
              workflows: parsed.workflows,
              activeWorkflowId: parsed.activeWorkflowId ?? Object.keys(parsed.workflows)[0],
              selectedNodeId: null,
            });
            
            // 迁移到数据库
            try {
              for (const workflow of Object.values(parsed.workflows)) {
                await database.saveWorkflow(workflow);
              }
              await database.saveSettings('workflow', { activeWorkflowId: parsed.activeWorkflowId });
              console.log('[loadWorkflows] 工作流已迁移到数据库');
              // 迁移完成后清除 localStorage
              localStorage.removeItem('matrixinspire-workflows');
            } catch (e) {
              console.error('迁移工作流到数据库失败:', e);
            }
            return;
          }
          
          // 处理新格式（只包含当前活动工作流）
          if (parsed?.activeWorkflow && parsed.activeWorkflowId) {
            console.log(`[loadWorkflows] 从 localStorage 迁移当前活动工作流到数据库`);
            set({
              workflows: { [parsed.activeWorkflowId]: parsed.activeWorkflow },
              activeWorkflowId: parsed.activeWorkflowId,
              selectedNodeId: null,
            });
            // 保存到数据库
            try {
              await database.saveWorkflow(parsed.activeWorkflow);
              await database.saveSettings('workflow', { activeWorkflowId: parsed.activeWorkflowId });
              console.log('[loadWorkflows] 工作流已迁移到数据库');
              // 迁移完成后清除 localStorage
              localStorage.removeItem('matrixinspire-workflows');
            } catch (e) {
              console.error('迁移工作流到数据库失败:', e);
            }
            return;
          }
        } catch (e) {
          console.error('Failed to parse localStorage workflows:', e);
        }
      }
      
      // 如果都没有数据，使用初始工作流
      console.log('[loadWorkflows] 使用初始工作流');
    },

    undo: () => {
      const { activeWorkflowId, workflows, history } = get();
      if (!activeWorkflowId || !workflows[activeWorkflowId]) return;
      const currentHistory = history[activeWorkflowId];
      if (!currentHistory || currentHistory.past.length === 0) return;

      const previous = currentHistory.past[currentHistory.past.length - 1];
      const currentSnapshot = getCurrentSnapshot(workflows[activeWorkflowId]);
      const nextHistory = {
        past: currentHistory.past.slice(0, -1),
        future: [cloneSnapshot(currentSnapshot), ...currentHistory.future],
      };

      set((state) => ({
        workflows: {
          ...state.workflows,
          [activeWorkflowId]: {
            ...state.workflows[activeWorkflowId],
            nodes: cloneSnapshot(previous).nodes,
            edges: cloneSnapshot(previous).edges,
            unsaved: true,
          },
        },
        history: {
          ...state.history,
          [activeWorkflowId]: nextHistory,
        },
      }));
    },

    redo: () => {
      const { activeWorkflowId, workflows, history } = get();
      if (!activeWorkflowId || !workflows[activeWorkflowId]) return;
      const currentHistory = history[activeWorkflowId];
      if (!currentHistory || currentHistory.future.length === 0) return;

      const next = currentHistory.future[0];
      const currentSnapshot = getCurrentSnapshot(workflows[activeWorkflowId]);
      const nextHistory = {
        past: [...currentHistory.past, cloneSnapshot(currentSnapshot)],
        future: currentHistory.future.slice(1),
      };

      set((state) => ({
        workflows: {
          ...state.workflows,
          [activeWorkflowId]: {
            ...state.workflows[activeWorkflowId],
            nodes: cloneSnapshot(next).nodes,
            edges: cloneSnapshot(next).edges,
            unsaved: true,
          },
        },
        history: {
          ...state.history,
          [activeWorkflowId]: nextHistory,
        },
      }));
    },

    setNodes: (nodes) => {
      const { activeWorkflowId, workflows } = get();
      if (activeWorkflowId && workflows[activeWorkflowId]) {
        const snapshot = getCurrentSnapshot(workflows[activeWorkflowId]);
        set((state) => ({
          history: {
            ...state.history,
            [activeWorkflowId]: {
              past: [...(state.history[activeWorkflowId]?.past || []), cloneSnapshot(snapshot)].slice(-100),
              future: [],
            },
          },
        }));
        set((state) => {
          const updatedWorkflow = {
            ...state.workflows[activeWorkflowId],
            nodes,
            unsaved: true,
          };
          const nextWorkflows = {
            ...state.workflows,
            [activeWorkflowId]: updatedWorkflow,
          };
          // 标记为未保存（不立即保存，等待定时器）
          markWorkflowUnsaved(nextWorkflows, state.activeWorkflowId);
          return { workflows: nextWorkflows };
        });
      }
    },

    setEdges: (edges) => {
      const { activeWorkflowId, workflows } = get();
      if (activeWorkflowId && workflows[activeWorkflowId]) {
        const snapshot = getCurrentSnapshot(workflows[activeWorkflowId]);
        set((state) => ({
          history: {
            ...state.history,
            [activeWorkflowId]: {
              past: [...(state.history[activeWorkflowId]?.past || []), cloneSnapshot(snapshot)].slice(-100),
              future: [],
            },
          },
        }));
        set((state) => {
          const updatedWorkflow = {
            ...state.workflows[activeWorkflowId],
            edges,
            unsaved: true,
          };
          const nextWorkflows = {
            ...state.workflows,
            [activeWorkflowId]: updatedWorkflow,
          };
          // 标记为未保存（不立即保存，等待定时器）
          markWorkflowUnsaved(nextWorkflows, state.activeWorkflowId);
          return { workflows: nextWorkflows };
        });
      }
    },

    onNodesChange: (changes) => {
      const { activeWorkflowId, workflows } = get();
      if (!activeWorkflowId || !workflows[activeWorkflowId]) return;

      const onlySelection =
        changes.length > 0 && changes.every((change) => change.type === 'select');
      const isDraggingMove = changes.some(
        (change) =>
          change.type === 'position' &&
          typeof change.dragging === 'boolean' &&
          change.dragging
      );
      
      // 如果是拖动操作，只更新节点位置，不保存历史，也不触发保存
      // 优化：使用节流来减少状态更新频率，提高拖动性能
      if (isDraggingMove) {
        const currentNodes = workflows[activeWorkflowId].nodes;
        const updatedNodes = applyNodeChanges(changes, currentNodes);
        
        // 直接同步更新，不使用 requestAnimationFrame（React Flow 已经优化了）
        // 但只在拖动过程中更新，不触发保存和历史记录
        set((state) => {
          const workflow = state.workflows[activeWorkflowId];
          if (!workflow) return state;
          
          return {
            workflows: {
              ...state.workflows,
              [activeWorkflowId]: {
                ...workflow,
                nodes: updatedNodes,
                // 拖动时不标记为未保存，避免频繁保存
              },
            },
          };
        });
        return;
      }
      
      if (!onlySelection) {
        const snapshot = getCurrentSnapshot(workflows[activeWorkflowId]);
        set((state) => ({
          history: {
            ...state.history,
            [activeWorkflowId]: {
              past: [...(state.history[activeWorkflowId]?.past || []), cloneSnapshot(snapshot)].slice(-100),
              future: [],
            },
          },
        }));
      }

      const currentNodes = workflows[activeWorkflowId].nodes;
      const updatedNodes = applyNodeChanges(changes, currentNodes);
      
      // Update selected node based on selection changes
      const selectionChange = changes.find((change) => change.type === 'select');
      const newSelectedNodeId = selectionChange && selectionChange.type === 'select'
        ? (selectionChange.selected ? selectionChange.id : null)
        : get().selectedNodeId;

      set((state) => {
        const updatedWorkflow = {
          ...state.workflows[activeWorkflowId],
          nodes: updatedNodes,
          unsaved: true,
        };
        const nextWorkflows = {
          ...state.workflows,
          [activeWorkflowId]: updatedWorkflow,
        };
        // 标记为未保存（不立即保存，等待定时器）
        markWorkflowUnsaved(nextWorkflows, state.activeWorkflowId);
        return {
          workflows: nextWorkflows,
          selectedNodeId: newSelectedNodeId,
        };
      });
    },

    onEdgesChange: (changes) => {
      const { activeWorkflowId, workflows } = get();
      if (!activeWorkflowId || !workflows[activeWorkflowId]) return;

      const snapshot = getCurrentSnapshot(workflows[activeWorkflowId]);
      set((state) => ({
        history: {
          ...state.history,
          [activeWorkflowId]: {
            past: [...(state.history[activeWorkflowId]?.past || []), cloneSnapshot(snapshot)].slice(-100),
            future: [],
          },
        },
      }));

      const currentEdges = workflows[activeWorkflowId].edges;
      const updatedEdges = applyEdgeChanges(changes, currentEdges);

      set((state) => {
        const updatedWorkflow = {
          ...state.workflows[activeWorkflowId],
          edges: updatedEdges,
          unsaved: true,
        };
        const nextWorkflows = {
          ...state.workflows,
          [activeWorkflowId]: updatedWorkflow,
        };
        // 标记为未保存（不立即保存，等待定时器）
        markWorkflowUnsaved(nextWorkflows, state.activeWorkflowId);
        return { workflows: nextWorkflows };
      });
    },

    onConnect: (connection) => {
      const { activeWorkflowId, workflows } = get();
      if (!activeWorkflowId || !workflows[activeWorkflowId]) return;
      if (connection.source && connection.target && connection.source === connection.target) return;

      const snapshot = getCurrentSnapshot(workflows[activeWorkflowId]);
      set((state) => ({
        history: {
          ...state.history,
          [activeWorkflowId]: {
            past: [...(state.history[activeWorkflowId]?.past || []), cloneSnapshot(snapshot)].slice(-100),
            future: [],
          },
        },
      }));

      const sourceNode = workflows[activeWorkflowId].nodes.find(n => n.id === connection.source);
      const targetNode = workflows[activeWorkflowId].nodes.find(n => n.id === connection.target);

      const sourceType = getHandleType(sourceNode?.type, connection.sourceHandle, 'output');
      const _targetType = getHandleType(targetNode?.type, connection.targetHandle, 'input');
      void _targetType;
      // 从节点类型推断 nodeType（与 DeletableEdge 中的逻辑一致）
      const nodeTypeMap: Record<string, 'text' | 'image' | 'video' | '3d' | 'other'> = {
        'textGen': 'text',
        'imageGen': 'image',
        'videoGen': 'video',
        '3dGen': '3d',
        'textInput': 'text',
        'imageInput': 'image',
        'videoInput': 'video',
        '3dInput': '3d',
        'textPreview': 'text',
        'imagePreview': 'image',
        'videoPreview': 'video',
        '3dPreview': '3d',
        'scriptRunner': 'other',
      };
      const nodeType = nodeTypeMap[sourceNode?.type || ''] || 'other';

      // 使用统一的颜色工具函数，使用 rgba 格式与 DeletableEdge 保持一致
      const edgeColor = getEdgeColor(sourceType || undefined, nodeType, 0.6);
      
      const newEdge = {
        ...connection,
        id: `edge-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
        type: 'deletable',
        style: { stroke: edgeColor, strokeWidth: 3, strokeDasharray: '5,5' },
        animated: false,
      };
      
      const currentEdges = workflows[activeWorkflowId].edges;
      const updatedEdges = addEdge(newEdge, currentEdges);

      set((state) => {
        const updatedWorkflow = {
          ...state.workflows[activeWorkflowId],
          edges: updatedEdges,
          unsaved: true,
        };
        const nextWorkflows = {
          ...state.workflows,
          [activeWorkflowId]: updatedWorkflow,
        };
        // 标记为未保存（不立即保存，等待定时器）
        markWorkflowUnsaved(nextWorkflows, state.activeWorkflowId);
        return { workflows: nextWorkflows };
      });
    },

    addNode: (node) => {
      const { activeWorkflowId, workflows } = get();
      if (!activeWorkflowId || !workflows[activeWorkflowId]) return;

      const snapshot = getCurrentSnapshot(workflows[activeWorkflowId]);
      set((state) => ({
        history: {
          ...state.history,
          [activeWorkflowId]: {
            past: [...(state.history[activeWorkflowId]?.past || []), cloneSnapshot(snapshot)].slice(-100),
            future: [],
          },
        },
      }));

      const currentNodes = workflows[activeWorkflowId].nodes;
      set((state) => {
        const updatedWorkflow = {
          ...state.workflows[activeWorkflowId],
          nodes: [...currentNodes, node],
          unsaved: true,
        };
        const nextWorkflows = {
          ...state.workflows,
          [activeWorkflowId]: updatedWorkflow,
        };
        // 标记为未保存（不立即保存，等待定时器）
        markWorkflowUnsaved(nextWorkflows, state.activeWorkflowId);
        return { workflows: nextWorkflows };
      });
    },

    removeNode: (nodeId) => {
      const { activeWorkflowId, workflows } = get();
      if (!activeWorkflowId || !workflows[activeWorkflowId]) return;

      const snapshot = getCurrentSnapshot(workflows[activeWorkflowId]);
      set((state) => ({
        history: {
          ...state.history,
          [activeWorkflowId]: {
            past: [...(state.history[activeWorkflowId]?.past || []), cloneSnapshot(snapshot)].slice(-100),
            future: [],
          },
        },
      }));

      const currentNodes = workflows[activeWorkflowId].nodes;
      const currentEdges = workflows[activeWorkflowId].edges;
      
      set((state) => {
        const updatedWorkflow = {
          ...state.workflows[activeWorkflowId],
          nodes: currentNodes.filter((n) => n.id !== nodeId),
          edges: currentEdges.filter((e) => e.source !== nodeId && e.target !== nodeId),
          unsaved: true,
        };
        const nextWorkflows = {
          ...state.workflows,
          [activeWorkflowId]: updatedWorkflow,
        };
        // 标记为未保存（不立即保存，等待定时器）
        markWorkflowUnsaved(nextWorkflows, state.activeWorkflowId);
        return {
          workflows: nextWorkflows,
          selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
        };
      });
    },

    updateNodeData: (nodeId, data) => {
      const { activeWorkflowId, workflows } = get();
      if (!activeWorkflowId || !workflows[activeWorkflowId]) return;

      const currentNodes = workflows[activeWorkflowId].nodes;
      // 确保创建新的节点对象和数据对象，触发 React 重新渲染
      set((state) => {
        const updatedNodes = currentNodes.map((node) => {
          if (node.id === nodeId) {
            // 创建新的节点对象和数据对象，确保引用变化
            // 使用展开运算符创建新对象，确保 React 能检测到变化
            return {
              ...node,
              data: {
                ...node.data,
                ...data,
              },
            };
          }
          return node;
        });
        
        const updatedWorkflow = {
          ...state.workflows[activeWorkflowId],
          nodes: updatedNodes,
          unsaved: true,
        };
        const nextWorkflows = {
          ...state.workflows,
          [activeWorkflowId]: updatedWorkflow,
        };
        // 标记为未保存（不立即保存，等待定时器）
        markWorkflowUnsaved(nextWorkflows, state.activeWorkflowId);
        return { workflows: nextWorkflows };
      });
    },

    setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),

    clearWorkflow: () => {
      const { activeWorkflowId, workflows } = get();
      if (!activeWorkflowId || !workflows[activeWorkflowId]) return;

      const snapshot = getCurrentSnapshot(workflows[activeWorkflowId]);
      set((state) => ({
        history: {
          ...state.history,
          [activeWorkflowId]: {
            past: [...(state.history[activeWorkflowId]?.past || []), cloneSnapshot(snapshot)].slice(-100),
            future: [],
          },
        },
      }));

      set((state) => {
        const updatedWorkflow = {
          ...state.workflows[activeWorkflowId],
          nodes: [],
          edges: [],
          unsaved: true,
        };
        const nextWorkflows = {
          ...state.workflows,
          [activeWorkflowId]: updatedWorkflow,
        };
        // 标记为未保存（不立即保存，等待定时器）
        markWorkflowUnsaved(nextWorkflows, state.activeWorkflowId);
        return {
          workflows: nextWorkflows,
          selectedNodeId: null,
        };
      });
    },
  };
});
