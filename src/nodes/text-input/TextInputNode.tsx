import React from 'react';
import { NodeProps } from 'reactflow';
import BaseNode from '../BaseNode';
import { NODE_HANDLE_SCHEMAS } from '../handleSchema';
import { FileText } from 'lucide-react';

const TextInputNode: React.FC<NodeProps> = (props) => {
  const schema = NODE_HANDLE_SCHEMAS.textInput;
  return (
    <BaseNode
      {...props}
      icon={<FileText size={16} />}
      color="blue"
      nodeType="text"
      inputs={schema.inputs}
      outputs={schema.outputs}
    />
  );
};

export default TextInputNode;
