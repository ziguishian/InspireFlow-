import React, { createContext, useContext, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { database } from '@/utils/database';

interface LanguageContextType {
  language: string;
  setLanguage: (lang: 'zh-CN' | 'en-US') => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { i18n, t } = useTranslation();

  const setLanguage = async (lang: 'zh-CN' | 'en-US') => {
    i18n.changeLanguage(lang);
    // 保存到数据库
    try {
      const settings = await database.getSettings('main') || {};
      await database.saveSettings('main', {
        ...settings,
        language: lang,
      });
    } catch (error) {
      console.error('保存语言设置到数据库失败:', error);
    }
  };

  // Load saved language on mount
  React.useEffect(() => {
    const loadLanguage = async () => {
      try {
        // 优先从数据库加载
        const settings = await database.getSettings('main');
        if (settings?.language && (settings.language === 'zh-CN' || settings.language === 'en-US')) {
          i18n.changeLanguage(settings.language);
          return;
        }
      } catch (error) {
        console.error('从数据库加载语言设置失败:', error);
      }
      
      // 如果数据库没有，尝试从 localStorage 迁移（一次性迁移）
      try {
        const saved = localStorage.getItem('matrixinspire-language');
        if (saved && (saved === 'zh-CN' || saved === 'en-US')) {
          i18n.changeLanguage(saved);
          // 迁移到数据库
          try {
            const settings = await database.getSettings('main') || {};
            await database.saveSettings('main', {
              ...settings,
              language: saved,
            });
            // 迁移完成后清除 localStorage
            localStorage.removeItem('matrixinspire-language');
          } catch (e) {
            console.error('迁移语言设置到数据库失败:', e);
          }
        }
      } catch (e) {
        console.error('从 localStorage 加载语言设置失败:', e);
      }
    };
    
    loadLanguage();
  }, [i18n]);

  return (
    <LanguageContext.Provider value={{ language: i18n.language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
