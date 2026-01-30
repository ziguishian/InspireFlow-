# 将项目推送到 GitHub

仓库地址：**https://github.com/ziguishian/InspireFlow-.git**

在项目根目录 `mxinspireFlows` 下打开终端（PowerShell 或 CMD），按顺序执行：

---

## 1. 若尚未初始化 Git

```bash
cd d:\File\CursorProjectSets\mxinspireFlows

git init
git branch -M main
```

## 2. 添加远程仓库

若已存在 `origin` 且不是本仓库，可先删除再添加：

```bash
git remote remove origin
```

添加远程：

```bash
git remote add origin https://github.com/ziguishian/InspireFlow-.git
```

## 3. 提交并推送

```bash
git add .
git status
git commit -m "Initial commit: InspireFlow (灵感流动)"
git push -u origin main
```

---

## 4. 若远程已有内容（如 LICENSE）

GitHub 上该仓库若已存在提交（例如只有 LICENSE），直接 `git push` 可能被拒绝。可二选一：

**方式 A：保留远程历史，拉取后合并再推送**

```bash
git pull origin main --allow-unrelated-histories
# 若有冲突，解决后：
git add .
git commit -m "Merge remote LICENSE"
git push -u origin main
```

**方式 B：用本地覆盖远程（慎用，会清掉远程已有提交）**

```bash
git push -u origin main --force
```

---

## 5. 后续日常推送

```bash
git add .
git commit -m "你的提交说明"
git push
```

---

推送前请确认：

- 已安装 Git 并配置 `user.name`、`user.email`
- 对 https://github.com/ziguishian/InspireFlow- 有推送权限（或为仓库所有者）
- 若使用 HTTPS，推送时可能提示输入 GitHub 用户名与密码（或 Personal Access Token）
