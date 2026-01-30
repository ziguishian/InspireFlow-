/**
 * 打包前清理：结束已运行的应用并删除 release，避免 electron-builder 报 "Access is denied"
 * 在 npm run build:win 时会自动先执行（prebuild:win）
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const releaseDir = path.join(__dirname, '..', 'release');

function main() {
  // 1. 结束 MatrixInspire 进程（Windows），避免占用 release 下 DLL
  if (process.platform === 'win32') {
    try {
      execSync('taskkill /IM MatrixInspire.exe /F', { stdio: 'ignore', windowsHide: true });
    } catch (_) {
      // taskkill 失败（进程不存在等）忽略
    }
  }

  // 2. 删除 release 目录，避免 electron-builder 清空时 Access denied
  if (fs.existsSync(releaseDir)) {
    try {
      fs.rmSync(releaseDir, { recursive: true, force: true });
    } catch (err) {
      console.error('');
      console.error('无法删除 release 目录（可能被占用）：');
      console.error('  请先关闭正在运行的 MatrixInspire，并关闭资源管理器中打开的 release 文件夹');
      console.error('  然后手动删除项目下的 release 文件夹，再重新执行 npm run build:win');
      console.error('');
      process.exit(1);
    }
  }
}

main();
