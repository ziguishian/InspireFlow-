import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkflowStore } from '@/stores/workflowStore';
import { FileText, Image, Video, Box, Code, Upload, Eye } from 'lucide-react';
import { motion } from 'framer-motion';

interface NodeTemplate {
  type: string;
  label: string;
  icon: React.ReactNode;
  category: string;
  defaultData: any;
}

const nodeTemplates: NodeTemplate[] = [
  {
    type: 'textGen',
    label: 'sidebar.nodes.textGen',
    icon: <FileText size={20} />,
    category: 'generation',
    defaultData: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      prompt: '',
      image: null,
    },
  },
  {
    type: 'imageGen',
    label: 'sidebar.nodes.imageGen',
    icon: <Image size={20} />,
    category: 'generation',
    defaultData: {
      model: 'dall-e-3',
      prompt: '',
      aspectRatio: '1:1',
      steps: 50,
    },
  },
  {
    type: 'videoGen',
    label: 'sidebar.nodes.videoGen',
    icon: <Video size={20} />,
    category: 'generation',
    defaultData: {
      model: 'seedream-video',
      prompt: '',
      duration: 5,
      ratio: 'adaptive',
      watermark: false,
      generateAudio: false,
    },
  },
  {
    type: '3dGen',
    label: 'sidebar.nodes.3dGen',
    icon: <Box size={20} />,
    category: 'generation',
    defaultData: {
      model: 'seedream-3d',
      prompt: '',
      format: 'glb',
      subdivisionLevel: 'medium',
    },
  },
  {
    type: 'scriptRunner',
    label: 'sidebar.nodes.scriptRunner',
    icon: <Code size={20} />,
    category: 'utility',
    defaultData: {
      language: 'python',
      code: '',
    },
  },
  {
    type: 'imageInput',
    label: 'sidebar.nodes.imageInput',
    icon: <Upload size={20} />,
    category: 'utility',
    defaultData: {
      image: null,
    },
  },
  {
    type: 'textInput',
    label: 'sidebar.nodes.textInput',
    icon: <FileText size={20} />,
    category: 'utility',
    defaultData: {
      text: '',
    },
  },
  {
    type: 'videoInput',
    label: 'sidebar.nodes.videoInput',
    icon: <Video size={20} />,
    category: 'utility',
    defaultData: {
      video: null,
    },
  },
  {
    type: '3dInput',
    label: 'sidebar.nodes.3dInput',
    icon: <Box size={20} />,
    category: 'utility',
    defaultData: {
      url: '',
      model: '',
    },
  },
  {
    type: 'textPreview',
    label: 'sidebar.nodes.textPreview',
    icon: <Eye size={20} />,
    category: 'preview',
    defaultData: {},
  },
  {
    type: 'imagePreview',
    label: 'sidebar.nodes.imagePreview',
    icon: <Eye size={20} />,
    category: 'preview',
    defaultData: {
      output: '',
    },
  },
  {
    type: 'videoPreview',
    label: 'sidebar.nodes.videoPreview',
    icon: <Eye size={20} />,
    category: 'preview',
    defaultData: {},
  },
  {
    type: '3dPreview',
    label: 'sidebar.nodes.3dPreview',
    icon: <Eye size={20} />,
    category: 'preview',
    defaultData: {},
  },
];

const Sidebar: React.FC = () => {
  const { t } = useLanguage();
  useWorkflowStore();

  const handleDragStart = (event: React.DragEvent, template: NodeTemplate) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(template));
    event.dataTransfer.effectAllowed = 'move';
  };

  const categories = ['generation', 'utility', 'preview'];

  return (
    <div className="w-64 glass-strong menu-surface border-r border-diffusion-border overflow-y-auto">
      <div className="p-4 border-b border-diffusion-border">
        <h2 className="text-lg font-semibold text-diffusion-text-primary">
          {t('sidebar.title')}
        </h2>
      </div>

      <div className="p-4 space-y-6">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="text-sm font-medium text-diffusion-text-secondary mb-3 uppercase tracking-wider">
              {t(`sidebar.categories.${category}`)}
            </h3>
            <div className="space-y-2">
              {nodeTemplates
                .filter((template) => template.category === category)
                .map((template) => (
                  <motion.div
                    key={template.type}
                    whileHover={{ scale: 1.01, x: 2 }}
                    whileTap={{ scale: 0.97 }}
                    className="menu-surface p-3.5 rounded-xl cursor-move flex items-center gap-3 border border-white/10 hover:bg-diffusion-bg-tertiary/50 transition-all group"
                  >
                    <div
                      draggable
                      onDragStart={(e: React.DragEvent) => handleDragStart(e, template)}
                      className="flex items-center gap-3 w-full"
                    >
                      <div className="text-diffusion-text-secondary group-hover:text-diffusion-text-primary transition-colors">
                        {template.icon}
                      </div>
                      <span className="text-sm font-medium text-diffusion-text-primary group-hover:text-diffusion-text-primary transition-colors">
                        {t(template.label)}
                      </span>
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
