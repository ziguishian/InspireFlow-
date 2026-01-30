export type HandleType = 'text' | 'image' | 'video' | '3d' | 'any';

export interface HandleDef {
  id: string;
  label: string;
  type: HandleType;
}

export interface NodeHandleSchema {
  inputs: HandleDef[];
  outputs: HandleDef[];
}

export const NODE_HANDLE_SCHEMAS: Record<string, NodeHandleSchema> = {
  textGen: {
    inputs: [
      { id: 'text', label: 'Text', type: 'text' },
      { id: 'image', label: 'Image', type: 'image' },
    ],
    outputs: [{ id: 'text', label: 'Text', type: 'text' }],
  },
  imageGen: {
    inputs: [
      { id: 'text', label: 'Text', type: 'text' },
      { id: 'image', label: 'Image', type: 'image' },
    ],
    outputs: [{ id: 'image', label: 'Image', type: 'image' }],
  },
  videoGen: {
    inputs: [
      { id: 'text', label: 'Text', type: 'text' },
      { id: 'image', label: 'Image', type: 'image' },
    ],
    outputs: [{ id: 'video', label: 'Video', type: 'video' }],
  },
  '3dGen': {
    inputs: [
      { id: 'text', label: 'Text', type: 'text' },
      { id: 'image', label: 'Image', type: 'image' },
    ],
    outputs: [{ id: 'model', label: '3D', type: '3d' }],
  },
  scriptRunner: {
    inputs: [
      { id: 'input1', label: 'Input 1', type: 'any' },
      { id: 'input2', label: 'Input 2', type: 'any' },
    ],
    outputs: [{ id: 'output', label: 'Output', type: 'any' }],
  },
  imageInput: {
    inputs: [],
    outputs: [{ id: 'image', label: 'Image', type: 'image' }],
  },
  textInput: {
    inputs: [],
    outputs: [{ id: 'text', label: 'Text', type: 'text' }],
  },
  videoInput: {
    inputs: [],
    outputs: [{ id: 'video', label: 'Video', type: 'video' }],
  },
  '3dInput': {
    inputs: [],
    outputs: [{ id: 'model', label: '3D', type: '3d' }],
  },
  textPreview: {
    inputs: [{ id: 'text', label: 'Text', type: 'text' }],
    outputs: [],
  },
  imagePreview: {
    inputs: [{ id: 'image', label: 'Image', type: 'image' }],
    outputs: [],
  },
  videoPreview: {
    inputs: [{ id: 'video', label: 'Video', type: 'video' }],
    outputs: [],
  },
  '3dPreview': {
    inputs: [{ id: 'model', label: '3D', type: '3d' }],
    outputs: [],
  },
};

const normalizeType = (type?: string | null): HandleType | null => {
  if (!type) return null;
  if (type === 'string') return 'text';
  if (type === 'text' || type === 'image' || type === 'video' || type === '3d' || type === 'any') {
    return type;
  }
  return null;
};

export const getHandleType = (
  nodeType: string | undefined,
  handleId: string | null | undefined,
  direction: 'input' | 'output'
): HandleType | null => {
  if (!nodeType || !handleId) return null;
  const schema = NODE_HANDLE_SCHEMAS[nodeType];
  if (!schema) return null;
  const handles = direction === 'input' ? schema.inputs : schema.outputs;
  const handle = handles.find((h) => h.id === handleId);
  return normalizeType(handle?.type) ?? null;
};

export const isCompatibleHandleType = (source?: HandleType | null, target?: HandleType | null) => {
  if (!source || !target) return false;
  if (source === 'any' || target === 'any') return true;
  return source === target;
};
