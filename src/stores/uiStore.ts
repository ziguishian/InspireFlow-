import { create } from 'zustand';

interface UIStore {
  leftSidebarContent: 'history' | 'nodes' | 'workflow' | 'template' | null;
  setLeftSidebarContent: (content: 'history' | 'nodes' | 'workflow' | 'template' | null) => void;
  mouseMode: 'pointer' | 'hand';
  setMouseMode: (mode: 'pointer' | 'hand') => void;
}

export const useUIStore = create<UIStore>((set) => ({
  leftSidebarContent: null,
  setLeftSidebarContent: (content) => set({ leftSidebarContent: content }),
  mouseMode: 'pointer',
  setMouseMode: (mode) => set({ mouseMode: mode }),
}));
