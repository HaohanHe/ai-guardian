# AI Guardian 集成方案

> **让全国人民都能用的 AI 安全防护**

## 方案概述

AI Guardian 提供**两种并行**的保护方案：

1. **MCP 拦截** - 针对 OpenClaw 等 AI Agent 的插件式保护
2. **终端监听** - 针对 PowerShell/CMD 的系统级保护

两种方案可以**同时使用**，实现全方位防护。

---

## 方案一：OpenClaw 插件（MCP 拦截）

### 特点
- ✅ 实时拦截 OpenClaw 的命令执行
- ✅ 在命令执行前进行安全分析
- ✅ 支持自动阻断和用户确认
- ✅ 完整的审计日志

### 安装步骤

#### 1. 复制插件到 OpenClaw

```bash
# 将插件复制到 OpenClaw 的插件目录
cp integrations/openclaw/ai-guardian-plugin.ts /path/to/openclaw/src/plugins/
```

#### 2. 注册插件

编辑 `openclaw/src/plugins/index.ts`：

```typescript
import aiGuardianPlugin from './ai-guardian-plugin';

export const plugins = [
  // ... 其他插件
  aiGuardianPlugin,
];
```

#### 3. 配置环境变量

```bash
# 添加到 .env 或系统环境变量
export AI_GUARDIAN_URL=http://localhost:3456
export AI_GUARDIAN_TOKEN=your-token-here
export AI_GUARDIAN_THRESHOLD=70
export AI_GUARDIAN_SILENT=true
export AI_GUARDIAN_AUTO_BLOCK=false
```

#### 4. 重启 OpenClaw

```bash
npm run build
npm start
```

### 配置说明

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `AI_GUARDIAN_URL` | Guardian 服务地址 | `http://localhost:3456` |
| `AI_GUARDIAN_TOKEN` | API Token | - |
| `AI_GUARDIAN_THRESHOLD` | 告警阈值 (0-100) | `70` |
| `AI_GUARDIAN_SILENT` | 静默模式 | `true` |
| `AI_GUARDIAN_AUTO_BLOCK` | 自动阻断高危命令 | `false` |

---

## 方案二：终端监听（PowerShell）

### 特点
- ✅ 监控所有 PowerShell 命令
- ✅ 本地快速模式匹配 + 云端 AI 分析
- ✅ 一键安装，无需修改系统
- ✅ 适合普通用户

### 一键安装（推荐）

#### Windows (PowerShell)

```powershell
# 以管理员身份运行 PowerShell
# 下载安装脚本
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/your-repo/ai-guardian/main/integrations/terminal/install.ps1" -OutFile "install-guardian.ps1"

# 运行安装脚本
.\install-guardian.ps1 -GuardianUrl "http://localhost:3456" -GuardianToken "your-token"

# 或者使用默认配置
.\install-guardian.ps1
```

#### 手动安装

```powershell
# 1. 创建目录
New-Item -ItemType Directory -Path "$env:USERPROFILE\.ai-guardian" -Force

# 2. 保存配置
$config = @{
    guardianUrl = "http://localhost:3456"
    guardianToken = "your-token"
    alertThreshold = 70
    silentMode = $true
} | ConvertTo-Json

$config | Set-Content "$env:USERPROFILE\.ai-guardian\config.json"

# 3. 复制监控模块
Copy-Item "integrations/terminal/AI-Guardian-Monitor.psm1" "$env:USERPROFILE\.ai-guardian\"

# 4. 添加到 PowerShell Profile
$importLine = "Import-Module '$env:USERPROFILE\.ai-guardian\AI-Guardian-Monitor.psm1' -Force"
Add-Content $PROFILE $importLine
```

### 使用效果

安装后，每次打开 PowerShell 都会看到：

```
🛡️  AI Guardian Terminal Protection Active
   Mode: Silent
   Threshold: 70/100
```

当执行危险命令时：

```
╔══════════════════════════════════════════════════════════════╗
║           ⚠️  AI GUARDIAN SECURITY ALERT  ⚠️                 ║
╠══════════════════════════════════════════════════════════════╣
║ Risk Score: 95/100                                           ║
║ Command: rm -rf /                                            ║
║ Reason: 删除整个文件系统                                      ║
╠══════════════════════════════════════════════════════════════╣
║ Safer Alternatives:                                          ║
║   • 使用 rm -i 进行交互式删除                                 ║
║   • 先使用 ls 查看要删除的内容                               ║
╚══════════════════════════════════════════════════════════════╝

This command is potentially dangerous. Continue? (y/N): 
```

---

## 两种方案对比

| 特性 | OpenClaw 插件 | 终端监听 |
|------|--------------|----------|
| **适用场景** | AI Agent 用户 | 普通终端用户 |
| **拦截时机** | 命令执行前 | 命令执行前 |
| **安装难度** | 需要修改 OpenClaw | 一键安装 |
| **覆盖范围** | OpenClaw 执行的命令 | 所有 PowerShell 命令 |
| **实时性** | ⚡ 实时 | ⚡ 实时 |
| **AI 分析** | ✅ 完整 | ✅ 完整 |
| **审计日志** | ✅ 完整 | ✅ 完整 |

---

## 推荐配置

### 对于开发者（使用 OpenClaw）

同时使用两种方案：
1. 安装 OpenClaw 插件（保护 AI Agent 操作）
2. 安装终端监听（保护手动命令）

### 对于普通用户

只安装终端监听：
```powershell
.\install-guardian.ps1 -Silent -AlertThreshold 70
```

### 对于企业用户

- 部署集中式 Guardian 服务
- 所有员工安装终端监听
- 统一配置管理

---

## 故障排除

### Guardian 连接失败

```powershell
# 检查 Guardian 是否运行
Invoke-RestMethod -Uri "http://localhost:3456/api/status" -Method GET

# 如果失败，启动 Guardian
cd ai-guardian
node dist/cli.js server
```

### Token 无效

```powershell
# 重新设置 Token
$env:AI_GUARDIAN_TOKEN = "your-new-token"
```

### 性能问题

如果感觉命令执行变慢：
1. 启用本地模式（只使用模式匹配）
2. 调高检查间隔
3. 使用静默模式

---

## 商业价值

> 💡 **为什么这个产品有巨大商业价值？**

1. **国家政策支持** - 国家开始补贴 OpenClaw 等 AI 工具
2. **安全意识提升** - AI Agent 操作风险被广泛关注
3. **市场需求巨大** - 从个人开发者到企业都需要
4. **技术门槛适中** - 普通人也能安装使用
5. **先发优势** - 目前市场上没有类似产品

---

## 贡献指南

欢迎贡献代码！你可以：

1. **添加新的集成方式** - Bash/Zsh/Fish 终端监听
2. **改进检测算法** - 提高准确率和性能
3. **添加新的 AI 模型支持** - 支持更多 LLM 提供商
4. **完善文档** - 让更多人能用上

---

## 许可证

MIT License - 让全世界人民都能用上 AI 安全防护！
