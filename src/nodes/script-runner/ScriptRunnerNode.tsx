import React from 'react';
import { NodeProps } from 'reactflow';
import BaseNode from '../BaseNode';
import { NODE_HANDLE_SCHEMAS } from '../handleSchema';
import { Code } from 'lucide-react';

const ScriptRunnerNode: React.FC<NodeProps> = (props) => {
  const schema = NODE_HANDLE_SCHEMAS.scriptRunner;
  return (
    <BaseNode
      {...props}
      icon={<Code size={16} />}
      color="cyan"
      nodeType="other"
      inputs={schema.inputs}
      outputs={schema.outputs}
    />
  );
};

export default ScriptRunnerNode;
