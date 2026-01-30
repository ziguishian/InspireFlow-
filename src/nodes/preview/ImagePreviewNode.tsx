import React from 'react';
import { NodeProps } from 'reactflow';
import BaseNode from '../BaseNode';
import { NODE_HANDLE_SCHEMAS } from '../handleSchema';
import { Eye } from 'lucide-react';

const ImagePreviewNode: React.FC<NodeProps> = (props) => {
  const schema = NODE_HANDLE_SCHEMAS.imagePreview;
  return (
    <BaseNode
      {...props}
      icon={<Eye size={16} />}
      color="cyan"
      nodeType="image"
      inputs={schema.inputs}
      outputs={schema.outputs}
    />
  );
};

export default ImagePreviewNode;
