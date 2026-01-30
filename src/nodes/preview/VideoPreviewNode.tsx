import React from 'react';
import { NodeProps } from 'reactflow';
import BaseNode from '../BaseNode';
import { NODE_HANDLE_SCHEMAS } from '../handleSchema';
import { Eye } from 'lucide-react';

const VideoPreviewNode: React.FC<NodeProps> = (props) => {
  const schema = NODE_HANDLE_SCHEMAS.videoPreview;
  return (
    <BaseNode
      {...props}
      icon={<Eye size={16} />}
      color="cyan"
      nodeType="video"
      inputs={schema.inputs}
      outputs={schema.outputs}
    />
  );
};

export default VideoPreviewNode;
