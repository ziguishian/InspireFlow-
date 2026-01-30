import React from 'react';
import { NodeProps } from 'reactflow';
import BaseNode from '../BaseNode';
import { NODE_HANDLE_SCHEMAS } from '../handleSchema';
import { Upload } from 'lucide-react';

const ImageInputNode: React.FC<NodeProps> = (props) => {
  const schema = NODE_HANDLE_SCHEMAS.imageInput;
  return (
    <BaseNode
      {...props}
      icon={<Upload size={16} />}
      color="cyan"
      nodeType="image"
      inputs={schema.inputs}
      outputs={schema.outputs}
    />
  );
};

export default ImageInputNode;
