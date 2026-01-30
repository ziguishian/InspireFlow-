import React from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Layout from './components/Layout/Layout';
import ToastContainer from './components/Toast/ToastContainer';
import { useSettingsStore } from './stores/settingsStore';
import { useWorkflowStore } from './stores/workflowStore';
import './App.css';

const App: React.FC = () => {
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const loadWorkflows = useWorkflowStore((state) => state.loadWorkflows);
  const createWorkflow = useWorkflowStore((state) => state.createWorkflow);
  const didInitRef = React.useRef(false);

  React.useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    (async () => {
      loadSettings();
      await loadWorkflows();
      // 每次加载时：把已加载出来的工作流全部“关闭”（从标签栏移除），仅保留在数据/侧边栏中
      // 然后默认创建并打开一个新的空工作流（新的标签页）
      const { openedWorkflowIds, closeWorkflow } = useWorkflowStore.getState();
      openedWorkflowIds.forEach((id) => closeWorkflow(id));

      createWorkflow('MX_Flows');
    })();
  }, [loadSettings, loadWorkflows, createWorkflow]);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <div className="app-container">
          <Layout />
          <ToastContainer />
        </div>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
