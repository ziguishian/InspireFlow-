import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getIconPath() {
  if (app.isPackaged) {
    const unpacked = join(process.resourcesPath, 'app.asar.unpacked', 'build', 'icon.ico');
    if (existsSync(unpacked)) return unpacked;
    const inAsar = join(process.resourcesPath, 'app.asar', 'build', 'icon.ico');
    if (existsSync(inAsar)) return inAsar;
  }
  return join(__dirname, '../build/icon.ico');
}

function createWindow() {
  const iconPath = getIconPath();
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0a0a0f',
    icon: existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    frame: true,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }
}

// 确保输出目录存在
async function ensureOutputDirectories(basePath) {
  const directories = [
    join(basePath, 'text'),
    join(basePath, 'image'),
    join(basePath, 'video'),
    join(basePath, '3Dmodels'),
  ];

  for (const dir of directories) {
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

// 保存生成的文件
ipcMain.handle('save-generated-file', async (event, { buffer, fileName, subFolder, basePath, useRelativePath, metadata }) => {
  try {
    let fullPath;
    let relativePath;
    
    // 如果没有设置路径，使用默认的 outputs
    const outputBasePath = basePath || 'outputs';
    
    if (useRelativePath !== false && !outputBasePath.startsWith('/') && !outputBasePath.match(/^[A-Za-z]:/)) {
      // 相对路径：相对于应用目录
      const appPath = app.getAppPath();
      fullPath = join(appPath, outputBasePath);
      relativePath = `${outputBasePath}/${subFolder}/${fileName}`;
    } else {
      // 绝对路径：直接使用
      fullPath = outputBasePath;
      relativePath = `${outputBasePath}/${subFolder}/${fileName}`;
    }
    
    // 确保目录存在
    await ensureOutputDirectories(fullPath);
    
    // 保存文件
    const filePath = join(fullPath, subFolder, fileName);
    await fs.writeFile(filePath, Buffer.from(buffer));
    
    // 保存元数据到 JSON 文件（如果提供了元数据）
    if (metadata) {
      const metadataFileName = `${fileName}.meta.json`;
      const metadataPath = join(fullPath, subFolder, metadataFileName);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    }
    
    // 返回相对路径（用于历史记录）
    return relativePath;
  } catch (error) {
    console.error('Failed to save generated file:', error);
    throw error;
  }
});

// 从文件系统加载历史记录
ipcMain.handle('load-history-from-files', async (event, { basePath, useRelativePath }) => {
  try {
    let fullPath;
    
    // 如果没有设置路径，使用默认的 outputs
    const outputBasePath = basePath || 'outputs';
    
    if (useRelativePath !== false && !outputBasePath.startsWith('/') && !outputBasePath.match(/^[A-Za-z]:/)) {
      // 相对路径：相对于应用目录
      const appPath = app.getAppPath();
      fullPath = join(appPath, outputBasePath);
    } else {
      // 绝对路径：直接使用
      fullPath = outputBasePath;
    }
    
    // 确保目录存在
    await ensureOutputDirectories(fullPath);
    
    const history = [];
    
    // 读取四个子文件夹中的文件
    const folders = [
      { path: join(fullPath, 'text'), type: 'text', folderName: 'text' },
      { path: join(fullPath, 'image'), type: 'image', folderName: 'image' },
      { path: join(fullPath, 'video'), type: 'video', folderName: 'video' },
      { path: join(fullPath, '3Dmodels'), type: '3d', folderName: '3Dmodels' },
    ];
    
    for (const folder of folders) {
      if (existsSync(folder.path)) {
        const files = await fs.readdir(folder.path);
        for (const file of files) {
          // 只处理以 mxinspire 开头的文件（排除元数据文件）
          if (file.startsWith('mxinspire') && !file.endsWith('.meta.json')) {
            const filePath = join(folder.path, file);
            const stats = await fs.stat(filePath);
            // 从文件名中提取时间戳，或者使用文件的修改时间
            const timestampMatch = file.match(/mxinspire(\d+)/);
            const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : stats.mtimeMs;
            
            // 构建文件 URL（使用 file:// 协议）
            const relativePath = `${outputBasePath}/${folder.folderName}/${file}`;
            const appPath = app.getAppPath();
            const absolutePath = join(appPath, relativePath);
            const fileUrl = pathToFileURL(absolutePath).href;
            
            const historyItem = {
              id: `file-${timestamp}-${file}`,
              type: folder.type,
              url: fileUrl,
              filePath: relativePath,
              createdAt: new Date(timestamp).toISOString(),
            };
            
            // 尝试读取元数据文件
            const metadataFileName = `${file}.meta.json`;
            const metadataPath = join(folder.path, metadataFileName);
            if (existsSync(metadataPath)) {
              try {
                const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                const metadata = JSON.parse(metadataContent);
                if (metadata.workflowId) historyItem.workflowId = metadata.workflowId;
                if (metadata.nodeId) historyItem.nodeId = metadata.nodeId;
                if (metadata.nodeType) historyItem.nodeType = metadata.nodeType;
                if (metadata.label) historyItem.label = metadata.label;
              } catch (error) {
                console.error(`Failed to read metadata file ${metadataPath}:`, error);
              }
            }
            
            // 如果是文本文件，读取内容
            if (folder.type === 'text') {
              try {
                const content = await fs.readFile(absolutePath, 'utf-8');
                historyItem.content = content;
              } catch (error) {
                console.error(`Failed to read text file ${absolutePath}:`, error);
              }
            }
            
            history.push(historyItem);
          }
        }
      }
    }
    
    // 按创建时间排序（最新的在前）
    history.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
    
    return history;
  } catch (error) {
    console.error('Failed to load history from files:', error);
    return [];
  }
});

// 清空文件系统中的所有历史记录
ipcMain.handle('clear-history-from-files', async (event, { basePath, useRelativePath }) => {
  try {
    let fullPath;
    if (useRelativePath) {
      const appPath = app.getAppPath();
      fullPath = join(appPath, basePath);
    } else {
      fullPath = basePath;
    }
    
    // 删除四个子文件夹中以 mxinspire 开头的所有文件
    const folders = [
      { path: join(fullPath, 'text'), folderName: 'text' },
      { path: join(fullPath, 'image'), folderName: 'image' },
      { path: join(fullPath, 'video'), folderName: 'video' },
      { path: join(fullPath, '3Dmodels'), folderName: '3Dmodels' },
    ];
    
    for (const folder of folders) {
      if (existsSync(folder.path)) {
        const files = await fs.readdir(folder.path);
        for (const file of files) {
          // 只删除以 mxinspire 开头的文件
          if (file.startsWith('mxinspire')) {
            const filePath = join(folder.path, file);
            try {
              await fs.unlink(filePath);
            } catch (error) {
              console.error(`Failed to delete file ${filePath}:`, error);
            }
          }
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to clear history from files:', error);
    throw error;
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 读取文件内容并转换为 base64（用于预览）
ipcMain.handle('read-file-as-data-url', async (event, { filePath }) => {
  try {
    // 如果是相对路径，转换为绝对路径
    let absolutePath;
    if (filePath.startsWith('/') || filePath.match(/^[A-Za-z]:/)) {
      absolutePath = filePath;
    } else {
      const appPath = app.getAppPath();
      absolutePath = join(appPath, filePath);
    }
    
    // 检查文件是否存在
    if (!existsSync(absolutePath)) {
      throw new Error('File not found');
    }
    
    // 读取文件
    const fileBuffer = await fs.readFile(absolutePath);
    const base64 = fileBuffer.toString('base64');
    
    // 根据文件扩展名确定 MIME 类型
    const ext = absolutePath.toLowerCase().substring(absolutePath.lastIndexOf('.'));
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json',
    };
    
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    
    // 返回 data URL
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Failed to read file as data URL:', error);
    throw error;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
