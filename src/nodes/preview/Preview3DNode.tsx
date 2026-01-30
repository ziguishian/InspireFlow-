import React from 'react';
import { NodeProps } from 'reactflow';
import BaseNode from '../BaseNode';
import { NODE_HANDLE_SCHEMAS } from '../handleSchema';
import { Eye } from 'lucide-react';

const Preview3DNode: React.FC<NodeProps> = (props) => {
  const schema = NODE_HANDLE_SCHEMAS['3dPreview'];
  return (
    <BaseNode
      {...props}
      icon={<Eye size={16} />}
      color="cyan"
      nodeType="3d"
      inputs={schema.inputs}
      outputs={schema.outputs}
    />
  );
};

export default Preview3DNode;
