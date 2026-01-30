import React from 'react';
import { NodeProps } from 'reactflow';
import BaseNode from '../BaseNode';
import { NODE_HANDLE_SCHEMAS } from '../handleSchema';
import { Eye } from 'lucide-react';

const TextPreviewNode: React.FC<NodeProps> = (props) => {
  const schema = NODE_HANDLE_SCHEMAS.textPreview;
  return (
    <BaseNode
      {...props}
      icon={<Eye size={16} />}
      color="cyan"
      nodeType="text"
      inputs={schema.inputs}
      outputs={schema.outputs}
    />
  );
};

export default TextPreviewNode;
