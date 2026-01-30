import React, { useMemo, useCallback, memo } from 'react';
import { Node } from 'reactflow';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkflowStore } from '@/stores/workflowStore';
import { getModelOptions } from '@/nodes/modelOptions';

interface NodePropertiesProps {
  node: Node;
}

// 参数输入组件，使用 memo 避免不必要的重新渲染
interface ParamInputProps {
  paramKey: string;
  value: any;
  nodeType: string;
  onChange: (key: string, value: any) => void;
}

const ParamInput = memo<ParamInputProps>(({ paramKey, value, nodeType, onChange }) => {
  const { t } = useLanguage();
  // 缓存模型选项
  const modelOptions = useMemo(() => {
    if (paramKey === 'model') {
      return getModelOptions({ nodeType });
    }
    return [];
  }, [paramKey, nodeType]);

  const handleChange = useCallback(
    (newValue: any) => {
      onChange(paramKey, newValue);
    },
    [paramKey, onChange]
  );

  if (paramKey === 'model') {
    return (
      <select
        value={value || ''}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full glass px-3 py-2 rounded-lg text-diffusion-text-primary bg-diffusion-bg-tertiary/50 border border-diffusion-border focus:border-diffusion-glow-cyan focus:outline-none"
      >
        <option value="">{t('nodeParams.selectModel')}</option>
        {modelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  // 根据值的类型推断输入类型
  const inputType = typeof value === 'number' ? 'number' : 'text';

  if (inputType === 'number') {
    return (
      <input
        type="number"
        value={value || 0}
        onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
        className="nodrag w-full glass px-3 py-2 rounded-lg text-diffusion-text-primary bg-diffusion-bg-tertiary/50 border border-diffusion-border focus:border-diffusion-glow-cyan focus:outline-none select-text"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
        }}
        onMouseMove={(e) => {
          e.stopPropagation();
        }}
        onDragStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{
          userSelect: 'text',
          WebkitUserSelect: 'text',
          MozUserSelect: 'text',
          msUserSelect: 'text',
          cursor: 'text',
        }}
      />
    );
  }

  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => handleChange(e.target.value)}
      className="nodrag w-full glass px-3 py-2 rounded-lg text-diffusion-text-primary bg-diffusion-bg-tertiary/50 border border-diffusion-border focus:border-diffusion-glow-cyan focus:outline-none select-text"
      onMouseDown={(e) => {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
      }}
      onMouseMove={(e) => {
        e.stopPropagation();
      }}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        userSelect: 'text',
        WebkitUserSelect: 'text',
        MozUserSelect: 'text',
        msUserSelect: 'text',
        cursor: 'text',
      }}
    />
  );
});

ParamInput.displayName = 'ParamInput';

const NodeProperties: React.FC<NodePropertiesProps> = ({ node }) => {
  const { t } = useLanguage();
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  // 使用 useCallback 缓存回调函数
  const handleParamChange = useCallback(
    (key: string, value: any) => {
      updateNodeData(node.id, { [key]: value });
    },
    [node.id, updateNodeData]
  );

  // 使用 useMemo 缓存过滤后的参数列表，避免每次渲染都重新计算
  const params = useMemo(() => {
    const data = node.data || {};
    return Object.entries(data)
      .filter(([key]) => key !== 'label' && key !== 'status' && key !== 'output' && key !== 'image' && key !== 'video' && key !== 'model')
      .map(([key, value]) => ({ key, value }));
  }, [node.data]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-diffusion-text-secondary mb-2">
          {t('node.params')}
        </label>
        <div className="space-y-3">
          {params.map(({ key, value }) => (
            <div key={key}>
              <label className="block text-xs text-diffusion-text-muted mb-1 capitalize">
                {key}
              </label>
              <ParamInput
                paramKey={key}
                value={value ?? ''}
                nodeType={node.type ?? ''}
                onChange={handleParamChange}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 使用 memo 包装组件，只在 node 的 id 或 data 变化时重新渲染
export default memo(NodeProperties, (prevProps, nextProps) => {
  // 如果节点 ID 相同，且 data 的引用相同，则不重新渲染
  if (prevProps.node.id !== nextProps.node.id) return false;
  if (prevProps.node.data !== nextProps.node.data) return false;
  if (prevProps.node.type !== nextProps.node.type) return false;
  return true;
});
