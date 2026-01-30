import React from 'react';
import { NodeProps } from 'reactflow';
import BaseNode from '../BaseNode';
import { NODE_HANDLE_SCHEMAS } from '../handleSchema';
import { Image } from 'lucide-react';

const ImageGenNode: React.FC<NodeProps> = (props) => {
  const schema = NODE_HANDLE_SCHEMAS.imageGen;
  return (
    <BaseNode
      {...props}
      icon={<Image size={16} />}
      color="purple"
      nodeType="image"
      inputs={schema.inputs}
      outputs={schema.outputs}
    />
  );
};

export default ImageGenNode;
