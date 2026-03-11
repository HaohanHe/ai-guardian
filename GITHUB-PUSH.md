# 推送到 GitHub 指南

## 步骤 1：在 GitHub 创建仓库

1. 访问 https://github.com/new
2. 仓库名称：`ai-guardian`
3. 描述：`AI Agent 数字孪生防御系统 - AI界的360/金山毒霸`
4. 选择 **Public**（开源）
5. 勾选 **Add a README file**（可选）
6. 点击 **Create repository**

## 步骤 2：初始化本地仓库

```bash
cd e:\debot\ai-guardian

# 初始化 git
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: AI Guardian - AI Agent Security System

- Core risk evaluation engine (0-100 score)
- Web UI for command evaluation
- MCP Server support
- PowerShell terminal monitoring
- OpenClaw/AutoClaw Skill integration
- No-auth mode for local development
- Multi-language support (zh/en/jp)

🛡️ Let there be no dangerous AI Agents in the world!"
```

## 步骤 3：关联远程仓库

```bash
# 添加远程仓库（替换 YOUR_USERNAME）
git remote add origin https://github.com/YOUR_USERNAME/ai-guardian.git

# 推送
git branch -M main
git push -u origin main
```

## 步骤 4：验证

访问 `https://github.com/YOUR_USERNAME/ai-guardian` 查看是否推送成功。

## 步骤 5：设置 GitHub Pages（可选）

1. 进入仓库 Settings → Pages
2. Source 选择 Deploy from a branch
3. Branch 选择 main / root
4. 保存后访问 `https://YOUR_USERNAME.github.io/ai-guardian`

## 步骤 6：添加 Topics

在仓库页面右侧点击齿轮图标，添加 Topics：
- ai-agent
- security
- prompt-injection
- openclaw
- mcp
- guardian
- safety
- typescript

## 完成！

🎉 现在全世界都能看到你的项目了！

记得分享链接：
- 朋友圈
- Twitter/X
- V2EX
- 知乎
- Discord 社区

**让星星飞起来！** ⭐⭐⭐
