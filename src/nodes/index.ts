import { NodeTypes } from 'reactflow';
import TextGenNode from './text-gen/TextGenNode';
import ImageGenNode from './image-gen/ImageGenNode';
import VideoGenNode from './video-gen/VideoGenNode';
import Gen3DNode from './3d-gen/Gen3DNode';
import ScriptRunnerNode from './script-runner/ScriptRunnerNode';
import ImageInputNode from './image-input/ImageInputNode';
import TextInputNode from './text-input/TextInputNode';
import VideoInputNode from './video-input/VideoInputNode';
import ThreeDInputNode from './3d-input/ThreeDInputNode';
import TextPreviewNode from './preview/TextPreviewNode';
import ImagePreviewNode from './preview/ImagePreviewNode';
import VideoPreviewNode from './preview/VideoPreviewNode';
import Preview3DNode from './preview/Preview3DNode';

export const nodeTypes: NodeTypes = {
  textGen: TextGenNode,
  imageGen: ImageGenNode,
  videoGen: VideoGenNode,
  '3dGen': Gen3DNode,
  scriptRunner: ScriptRunnerNode,
  imageInput: ImageInputNode,
  textInput: TextInputNode,
  videoInput: VideoInputNode,
  '3dInput': ThreeDInputNode,
  textPreview: TextPreviewNode,
  imagePreview: ImagePreviewNode,
  videoPreview: VideoPreviewNode,
  '3dPreview': Preview3DNode,
};
