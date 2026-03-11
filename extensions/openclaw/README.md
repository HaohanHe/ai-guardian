# AI Guardian Extension for OpenClaw

> **OpenClaw 官方扩展格式 - 真正的"AI 界 360/金山毒霸"**

## 特点

- ✅ **官方扩展格式** - 符合 OpenClaw Extension 标准
- ✅ **before_tool_call Hook** - 在命令执行前拦截
- ✅ **自动阻断高危命令** - 风险分 >= 70 自动拦截
- ✅ **完整审计日志** - 记录所有命令执行
- ✅ **无需修改源码** - 作为独立扩展安装

## 安装步骤

### 步骤 1：启动 AI Guardian 服务

```powershell
cd e:\debot\ai-guardian
node dist/cli.js server --no-open
```

记下 Token，例如：`kptvafxfywk6r55xlidfd`

### 步骤 2：复制扩展到 OpenClaw

```powershell
# 复制到 OpenClaw 扩展目录
xcopy /E /I "e:\debot\ai-guardian\extensions\openclaw\ai-guardian" "C:\Program Files\OpenClaw\resources\gateway\openclaw\extensions\ai-guardian"
```

### 步骤 3：配置环境变量

```powershell
# 设置环境变量
$env:AI_GUARDIAN_URL = "http://localhost:3456"
$env:AI_GUARDIAN_TOKEN = "你的Token"
$env:AI_GUARDIAN_THRESHOLD = "70"
$env:AI_GUARDIAN_AUTO_BLOCK = "true"
$env:AI_GUARDIAN_SILENT = "true"
```

### 步骤 4：重启 OpenClaw

```powershell
openclaw --reload
```

## 文件结构

```
ai-guardian/
├── index.ts              # 扩展入口（必需）
├── package.json          # npm 配置（必需）
├── openclaw.plugin.json  # 插件清单（必需）
└── README.md             # 文档
```

## 工作原理

```
OpenClaw 执行命令
    ↓
before_tool_call Hook (AI Guardian Extension)
    ↓
调用 Guardian API 评估风险
    ↓
风险 < 70  → 允许执行
风险 >= 70 → 阻断并返回错误
```

## 配置说明

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `AI_GUARDIAN_URL` | Guardian 服务地址 | `http://localhost:3456` |
| `AI_GUARDIAN_TOKEN` | API Token | - |
| `AI_GUARDIAN_THRESHOLD` | 告警阈值 (0-100) | `70` |
| `AI_GUARDIAN_AUTO_BLOCK` | 自动阻断高危命令 | `true` |
| `AI_GUARDIAN_SILENT` | 静默模式 | `true` |

## 与其他方式对比

| 方式 | 安装难度 | 拦截效果 | 推荐度 |
|------|---------|---------|--------|
| **OpenClaw Extension** | 中等（复制文件） | ⭐⭐⭐ 最好 | **推荐** |
| MCP Server | 简单（配置） | ⭐⭐ 有限 | 备选 |
| 终端监听 | 简单（PowerShell） | ⭐⭐ 较好 | 备选 |

## 测试

安装后，让 OpenClaw 执行：

```
# 高危命令（应该被拦截）
删除 C 盘的所有文件

# 安全命令（应该放行）
显示当前目录的文件列表
```

## 故障排除

### Extension 未加载

检查 OpenClaw 日志：
```powershell
openclaw logs
```

### Guardian 连接失败

```powershell
# 测试 Guardian 服务
Invoke-RestMethod -Uri "http://localhost:3456/api/status" -Method GET
```

### 命令没有被拦截

1. 确认环境变量设置正确
2. 检查 OpenClaw 是否加载了扩展
3. 查看 Guardian 服务日志

## 卸载

```powershell
# 删除扩展目录
Remove-Item -Recurse "C:\Program Files\OpenClaw\resources\gateway\openclaw\extensions\ai-guardian"

# 重启 OpenClaw
openclaw --reload
```

---

**现在 AI Guardian 作为 OpenClaw 官方扩展，可以真正保护你的 AI Agent 了！** 🛡️
