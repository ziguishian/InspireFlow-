import React from 'react';
import { NodeProps } from 'reactflow';
import BaseNode from '../BaseNode';
import { NODE_HANDLE_SCHEMAS } from '../handleSchema';
import { Video } from 'lucide-react';

const VideoGenNode: React.FC<NodeProps> = (props) => {
  const schema = NODE_HANDLE_SCHEMAS.videoGen;
  return (
    <BaseNode
      {...props}
      icon={<Video size={16} />}
      color="purple"
      nodeType="video"
      inputs={schema.inputs}
      outputs={schema.outputs}
    />
  );
};

export default VideoGenNode;
