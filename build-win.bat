@echo off
chcp 65001 >nul
cd /d "%~dp0"
REM 禁用代码签名，避免解压 winCodeSign 时因创建符号链接权限报错
set CSC_IDENTITY_AUTO_DISCOVERY=false
REM 若上次打包的应用仍在运行，会锁定 release 下 DLL，导致 Access denied；先结束进程并清空 release
taskkill /IM MatrixInspire.exe /F >nul 2>&1
if exist release rmdir /s /q release 2>nul
if exist release (
  echo 警告：无法删除 release 目录（可能被占用）。请关闭 MatrixInspire 或资源管理器中打开的 release 文件夹后重试。
  pause
  exit /b 1
)
echo 正在打包 Windows 应用（不签名）...
call npm run build:win
if %ERRORLEVEL% neq 0 (
  echo.
  echo 打包失败。若出现 "Access is denied"，请先关闭已运行的 MatrixInspire，删除 release 文件夹后重试。
  echo 若出现 spawn EPERM，请在「命令提示符」或「PowerShell」中手动执行：
  echo   cd /d "%~dp0"
  echo   npm run build:win
  pause
  exit /b 1
)
echo.
echo 打包完成。安装包与便携版位于 release 目录。
pause
