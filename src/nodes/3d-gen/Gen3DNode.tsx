import React from 'react';
import { NodeProps } from 'reactflow';
import BaseNode from '../BaseNode';
import { NODE_HANDLE_SCHEMAS } from '../handleSchema';
import { Box } from 'lucide-react';

const Gen3DNode: React.FC<NodeProps> = (props) => {
  const schema = NODE_HANDLE_SCHEMAS['3dGen'];
  return (
    <BaseNode
      {...props}
      icon={<Box size={16} />}
      color="cyan"
      nodeType="3d"
      inputs={schema.inputs}
      outputs={schema.outputs}
    />
  );
};

export default Gen3DNode;
