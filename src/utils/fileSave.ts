import { GenerationHistoryItem } from '@/stores/settingsStore';
import { APP_FILE_PREFIX } from '@/config/appName';

// IndexedDB 数据库名称和版本（用于文件存储，与主数据库分离）
const DB_NAME = 'mxinspire-files';
const DB_VERSION = 2; // 升级版本以支持文本类型
const STORE_NAME = 'generated-files';

const ARK_CDN_HOST = 'ark-content-generation-cn-beijing.tos-cn-beijing.volces.com';

/** 开发环境下通过 Vite 代理请求方舟 CDN（zip 等），避免 CORS */
function getFetchUrlForSave(url: string): string {
  if (typeof url !== 'string' || !url.startsWith('http')) return url;
  try {
    const u = new URL(url);
    if (import.meta.env.DEV && u.hostname === ARK_CDN_HOST) {
      return `${window.location.origin}/api-proxy-ark-zip${u.pathname}${u.search}`;
    }
  } catch (_) {}
  return url;
}

/**
 * 初始化 IndexedDB 数据库（用于浏览器环境）
 */
async function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * 将文件保存到 IndexedDB（浏览器环境）
 */
async function saveToIndexedDB(
  fileName: string,
  blob: Blob,
  type: 'text' | 'image' | 'video' | '3d',
  subFolder: string,
  basePath: string,
  metadata?: {
    workflowId?: string;
    nodeId?: string;
    nodeType?: string;
    label?: string;
  }
): Promise<string> {
  // 在事务开始之前就准备好数据，避免事务超时
  const arrayBuffer = await blob.arrayBuffer();
  
  const fileData = {
    id: fileName,
    fileName,
    data: arrayBuffer,
    type,
    subFolder,
    basePath,
    createdAt: Date.now(),
    mimeType: blob.type,
    workflowId: metadata?.workflowId,
    nodeId: metadata?.nodeId,
    nodeType: metadata?.nodeType,
    label: metadata?.label,
  };

  // 现在开始事务并立即保存
  const db = await initIndexedDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise<string>((resolve, reject) => {
    // 监听事务完成事件
    transaction.oncomplete = () => {
      // 返回虚拟路径（用于历史记录）
      resolve(`${basePath}/${subFolder}/${fileName}`);
    };
    
    transaction.onerror = () => {
      reject(transaction.error || new Error('IndexedDB transaction failed'));
    };
    
    // 执行保存操作
    const request = store.put(fileData);
    request.onerror = () => {
      reject(request.error || new Error('Failed to save to IndexedDB'));
    };
  });
}

/**
 * 从 IndexedDB 读取文件（浏览器环境）
 */
async function readFromIndexedDB(fileName: string): Promise<Blob | null> {
  const db = await initIndexedDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.get(fileName);
    request.onsuccess = () => {
      const fileData = request.result;
      if (fileData && fileData.data) {
        const blob = new Blob([fileData.data], { type: fileData.mimeType });
        resolve(blob);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * 将 ArrayBuffer 转换为 data URL
 * 用于浏览器环境中将 IndexedDB 存储的文件数据转换为可显示的 data URL
 */
function arrayBufferToDataURL(arrayBuffer: ArrayBuffer, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([arrayBuffer], { type: mimeType });
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * 从 IndexedDB 加载所有历史记录（浏览器环境）
 */
async function loadHistoryFromIndexedDB(
  saveConfig: { enabled: boolean; useRelativePath: boolean; path: string }
): Promise<GenerationHistoryItem[]> {
  if (!saveConfig.enabled) {
    return [];
  }

  try {
    const db = await initIndexedDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('createdAt');

    // 先收集所有文件数据
    const fileDataList: any[] = [];
    
    await new Promise<void>((resolve, reject) => {
      const request = index.openCursor(null, 'prev'); // 从新到旧排序

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const fileData = cursor.value;
          // 只处理以项目资源前缀开头的文件
          if (fileData.fileName && fileData.fileName.startsWith(APP_FILE_PREFIX)) {
            fileDataList.push(fileData);
          }
          cursor.continue();
        } else {
          // 所有数据已读取完成
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    });

    // 处理所有文件数据，转换为历史记录项
    const history: GenerationHistoryItem[] = [];
    
    for (const fileData of fileDataList) {
      if (fileData.type === 'text') {
        // 文本类型：直接读取内容
        const decoder = new TextDecoder('utf-8');
        const textContent = decoder.decode(fileData.data);
        // 创建 data URL 用于显示
        const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(textContent)}`;
        
        history.push({
          id: `indexeddb-${fileData.id}`,
          type: 'text',
          url: dataUrl,
          content: textContent, // 保存文本内容
          createdAt: new Date(fileData.createdAt).toISOString(),
          workflowId: fileData.workflowId,
          nodeId: fileData.nodeId,
          nodeType: fileData.nodeType,
          label: fileData.label,
        });
      } else {
        // 其他类型：转换为 data URL（避免页面刷新后失效）
        try {
          const dataUrl = await arrayBufferToDataURL(
            fileData.data,
            fileData.mimeType || 'application/octet-stream'
          );

          history.push({
            id: `indexeddb-${fileData.id}`,
            type: fileData.type,
            url: dataUrl,
            createdAt: new Date(fileData.createdAt).toISOString(),
            workflowId: fileData.workflowId,
            nodeId: fileData.nodeId,
            nodeType: fileData.nodeType,
            label: fileData.label,
          });
        } catch (error) {
          console.error(`Failed to convert file ${fileData.fileName} to data URL:`, error);
          // 如果转换失败，跳过这个文件
        }
      }
    }

    return history;
  } catch (error) {
    console.error('Failed to load history from IndexedDB:', error);
    return [];
  }
}

/**
 * 保存生成的内容到本地文件
 * 文件名格式：APP_FILE_PREFIX + 时间戳
 * 支持 Electron 和浏览器环境
 * 支持文本、图像、视频、3D 等多种类型
 */
export async function saveGeneratedFile(
  url: string, // 文本内容或 URL
  type: 'text' | 'image' | 'video' | '3d',
  saveConfig: { enabled: boolean; useRelativePath: boolean; path: string },
  metadata?: {
    workflowId?: string;
    nodeId?: string;
    nodeType?: string;
    label?: string;
  }
): Promise<string | null> {
  if (!saveConfig.enabled) {
    return null;
  }

  try {
    const timestamp = Date.now();
    const fileName = `${APP_FILE_PREFIX}${timestamp}`;
    
    // 根据类型确定子文件夹和文件扩展名
    const subFolder = type === 'text' ? 'text' : type === 'image' ? 'image' : type === 'video' ? 'video' : '3Dmodels';
    const extension = type === 'text' ? '.txt' : type === 'image' ? '.png' : type === 'video' ? '.mp4' : '.glb';
    const fullFileName = `${fileName}${extension}`;
    
    // 检查是否在 Electron 环境中
    const isElectron = typeof window !== 'undefined' && 
                       (window as any).electronAPI && 
                       typeof (window as any).electronAPI.saveGeneratedFile === 'function';
    
    if (isElectron) {
      // Electron 环境：使用 IPC 保存文件（静默保存）
      let bufferArray: number[];
      
      if (type === 'text') {
        // 文本类型：直接转换为 UTF-8 字节数组
        const textContent = typeof url === 'string' ? url : '';
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(textContent);
        bufferArray = Array.from(uint8Array);
      } else {
        // 其他类型：处理 URL
        let arrayBuffer: ArrayBuffer;
        
        // 处理不同类型的 URL
        if (url.startsWith('data:')) {
          // Data URL: 直接解码
          const base64Data = url.split(',')[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          arrayBuffer = bytes.buffer;
        } else if (url.startsWith('blob:')) {
          // Blob URL: 使用 fetch
          const response = await fetch(url);
          arrayBuffer = await response.arrayBuffer();
        } else if (url.startsWith('file://')) {
          // File URL: 在 Electron 中，可能需要特殊处理
          const response = await fetch(url);
          arrayBuffer = await response.arrayBuffer();
        } else {
          // HTTP/HTTPS URL: 开发环境下方舟 CDN 走代理避免 CORS
          const fetchUrl = getFetchUrlForSave(url);
          const response = await fetch(fetchUrl);
          arrayBuffer = await response.arrayBuffer();
        }
        
        bufferArray = Array.from(new Uint8Array(arrayBuffer));
      }
      
      // 调用 Electron API 保存文件（静默保存）
      const basePath = saveConfig.path && saveConfig.path.trim() ? saveConfig.path.trim() : 'outputs';
      const savedPath = await (window as any).electronAPI.saveGeneratedFile({
        buffer: bufferArray,
        fileName: fullFileName,
        subFolder,
        basePath,
        useRelativePath: saveConfig.useRelativePath,
        metadata: metadata, // 传递元数据
      });
      
      // 返回相对路径，用于历史记录
      return savedPath;
    } else {
      // 浏览器环境：使用 IndexedDB 静默保存
      let blob: Blob;
      
      if (type === 'text') {
        // 文本类型：创建文本 Blob
        const textContent = typeof url === 'string' ? url : '';
        blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      } else {
        // 其他类型：处理 URL
        // 处理不同类型的 URL
        if (url.startsWith('data:')) {
          // Data URL: 直接转换为 Blob
          const response = await fetch(url);
          blob = await response.blob();
        } else if (url.startsWith('blob:')) {
          // Blob URL: 使用 fetch
          const response = await fetch(url);
          blob = await response.blob();
        } else {
          // HTTP/HTTPS URL: 开发环境下方舟 CDN 走代理避免 CORS
          const fetchUrl = getFetchUrlForSave(url);
          const response = await fetch(fetchUrl);
          blob = await response.blob();
        }
      }
      
      // 保存到 IndexedDB（静默保存，不弹出对话框）
      const basePath = saveConfig.path && saveConfig.path.trim() ? saveConfig.path.trim() : 'outputs';
      const savedPath = await saveToIndexedDB(fullFileName, blob, type, subFolder, basePath, metadata);
      
      // 返回虚拟路径（用于历史记录）
      return savedPath;
    }
  } catch (error) {
    console.error('Failed to save generated file:', error);
    return null;
  }
}

/**
 * 从保存的文件中加载历史记录
 * 支持 Electron 和浏览器环境
 */
export async function loadHistoryFromFiles(
  saveConfig: { enabled: boolean; useRelativePath: boolean; path: string }
): Promise<GenerationHistoryItem[]> {
  if (!saveConfig.enabled) {
    return [];
  }

  try {
    // 检查是否在 Electron 环境中
    const isElectron = typeof window !== 'undefined' && 
                       (window as any).electronAPI && 
                       typeof (window as any).electronAPI.loadHistoryFromFiles === 'function';
    
    if (isElectron) {
      // Electron 环境：从文件系统读取
      const basePath = saveConfig.path && saveConfig.path.trim() ? saveConfig.path.trim() : 'outputs';
      const history = await (window as any).electronAPI.loadHistoryFromFiles({
        basePath,
        useRelativePath: saveConfig.useRelativePath,
      });
      return history;
    } else {
      // 浏览器环境：从 IndexedDB 读取
      const history = await loadHistoryFromIndexedDB(saveConfig);
      return history;
    }
  } catch (error) {
    console.error('Failed to load history from files:', error);
    return [];
  }
}

/**
 * 从 IndexedDB 获取文件的 Blob URL（浏览器环境）
 */
export async function getFileBlobURL(fileName: string): Promise<string | null> {
  try {
    const blob = await readFromIndexedDB(fileName);
    if (blob) {
      return URL.createObjectURL(blob);
    }
    return null;
  } catch (error) {
    console.error('Failed to get file blob URL:', error);
    return null;
  }
}

/**
 * 根据文件路径读取文件并转换为可显示的 URL
 * 支持 Electron 和浏览器环境
 */
export async function getFileDisplayURL(
  filePath: string,
  _type: 'text' | 'image' | 'video' | '3d',
  _saveConfig?: { enabled: boolean; useRelativePath: boolean; path: string }
): Promise<string | null> {
  if (!filePath) {
    return null;
  }

  try {
    // 检查是否在 Electron 环境中
    const isElectron = typeof window !== 'undefined' && 
                       (window as any).electronAPI && 
                       typeof (window as any).electronAPI.readFileAsDataUrl === 'function';
    
    if (isElectron) {
      // Electron 环境：使用 IPC 读取文件
      try {
        const dataUrl = await (window as any).electronAPI.readFileAsDataUrl({ filePath });
        return dataUrl;
      } catch (error) {
        console.error('Failed to read file from Electron:', error);
        return null;
      }
    } else {
      // 浏览器环境：从 IndexedDB 读取
      // filePath 格式：basePath/subFolder/fileName
      // 需要提取 fileName（例如：outputs/image/前缀+时间戳.png -> 文件名）
      const fileName = filePath.split('/').pop() || filePath;
      console.log(`[getFileDisplayURL] 浏览器环境，从 IndexedDB 读取文件:`, {
        filePath,
        extractedFileName: fileName,
      });
      
      try {
        const blob = await readFromIndexedDB(fileName);
        if (blob) {
          console.log(`[getFileDisplayURL] 成功从 IndexedDB 读取文件: ${fileName}, size: ${blob.size} bytes`);
          // 转换为 data URL
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              console.log(`[getFileDisplayURL] 成功转换为 data URL: ${fileName}`);
              resolve(reader.result as string);
            };
            reader.onerror = () => {
              console.error(`[getFileDisplayURL] 转换为 data URL 失败: ${fileName}`, reader.error);
              reject(reader.error);
            };
            reader.readAsDataURL(blob);
          });
        } else {
          console.warn(`[getFileDisplayURL] 从 IndexedDB 读取文件失败: ${fileName} (文件不存在)`);
        }
        return null;
      } catch (error) {
        console.error(`[getFileDisplayURL] 从 IndexedDB 读取文件失败: ${fileName}`, error);
        return null;
      }
    }
  } catch (error) {
    console.error('Failed to get file display URL:', error);
    return null;
  }
}

/**
 * 清空 IndexedDB 中的所有历史记录（浏览器环境）
 */
export async function clearIndexedDBHistory(): Promise<void> {
  try {
    const db = await initIndexedDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      // 删除所有以项目资源前缀开头的文件
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const fileData = cursor.value;
          if (fileData.fileName && fileData.fileName.startsWith(APP_FILE_PREFIX)) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          // 所有数据已处理完成
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    });
  } catch (error) {
    console.error('Failed to clear IndexedDB history:', error);
    throw error;
  }
}

/**
 * 清空文件系统中的所有历史记录
 * Electron 环境：删除文件系统中的文件
 * 浏览器环境：清空 IndexedDB
 */
export async function clearFileSystemHistory(
  saveConfig: { enabled: boolean; useRelativePath: boolean; path: string }
): Promise<void> {
  if (!saveConfig.enabled) {
    return;
  }

  try {
    // 检查是否在 Electron 环境中
    const isElectron = typeof window !== 'undefined' && 
                       (window as any).electronAPI && 
                       typeof (window as any).electronAPI.clearHistoryFromFiles === 'function';
    
    if (isElectron) {
      // Electron 环境：删除文件系统中的文件
      const basePath = saveConfig.path && saveConfig.path.trim() ? saveConfig.path.trim() : 'outputs';
      await (window as any).electronAPI.clearHistoryFromFiles({
        basePath,
        useRelativePath: saveConfig.useRelativePath,
      });
    } else {
      // 浏览器环境：清空 IndexedDB
      await clearIndexedDBHistory();
    }
  } catch (error) {
    console.error('Failed to clear file system history:', error);
    throw error;
  }
}
