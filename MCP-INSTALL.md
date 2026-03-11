# AI Guardian MCP 服务器安装指南

> **无需修改源码，直接配置到 OpenClaw/Claude 等 MCP 客户端**

## 什么是 MCP 服务器？

MCP (Model Context Protocol) 是 AI Agent 与外部工具通信的标准协议。

AI Guardian MCP 服务器是一个**独立的进程**，你只需要在 OpenClaw 的配置文件中添加它，就能实现安全保护！

## 安装步骤

### 步骤 1：启动 AI Guardian 主服务

```powershell
cd e:\debot\ai-guardian
npm run build
node dist/cli.js server --no-open
```

记下显示的 Token，例如：`r9xmebht25ilo5g5ofwuxn`

### 步骤 2：配置 MCP

编辑你的 OpenClaw MCP 配置文件（通常在 `~/.openclaw/mcp.json` 或类似位置）：

```json
{
  "mcpServers": {
    "ai-guardian": {
      "command": "node",
      "args": [
        "e:/debot/ai-guardian/dist/mcp-server.js"
      ],
      "env": {
        "AI_GUARDIAN_URL": "http://localhost:3456",
        "AI_GUARDIAN_TOKEN": "你的Token",
        "AI_GUARDIAN_THRESHOLD": "70",
        "AI_GUARDIAN_AUTO_BLOCK": "true"
      }
    }
  }
}
```

### 步骤 3：重启 OpenClaw

```powershell
openclaw --reload
# 或完全重启
```

## 配置说明

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `AI_GUARDIAN_URL` | Guardian 服务地址 | `http://localhost:3456` |
| `AI_GUARDIAN_TOKEN` | API Token | - |
| `AI_GUARDIAN_THRESHOLD` | 拦截阈值 (0-100) | `70` |
| `AI_GUARDIAN_AUTO_BLOCK` | 自动阻断高危命令 | `true` |

## 工作原理

```
OpenClaw → 要执行命令 → AI Guardian MCP Server → 评估风险
                              ↓
                    风险 < 70 → 允许执行
                    风险 >= 70 → 阻断并返回错误
```

## 测试

配置完成后，让 OpenClaw 执行：

```
# 高危命令（应该被拦截）
删除 C 盘的所有文件

# 安全命令（应该放行）
显示当前目录的文件列表
```

## 故障排除

### 问题 1：MCP 服务器无法启动

**检查**：
```powershell
# 测试 Guardian 服务
Invoke-RestMethod -Uri "http://localhost:3456/api/status" -Method GET

# 手动测试 MCP 服务器
node e:/debot/ai-guardian/dist/mcp-server.js
```

### 问题 2：OpenClaw 无法连接到 MCP

**检查**：
1. 配置文件路径是否正确
2. JSON 格式是否正确（注意逗号）
3. 文件路径是否使用了正确的斜杠（Windows 用 `/` 或 `\\`）

### 问题 3：命令没有被拦截

**检查**：
1. `AI_GUARDIAN_TOKEN` 是否正确
2. `AI_GUARDIAN_THRESHOLD` 是否设置过低
3. Guardian 服务日志是否有错误

## 与其他方式对比

| 方式 | 安装难度 | 效果 | 适用场景 |
|------|---------|------|---------|
| **MCP 服务器** | 简单（配置即可） | 保护 OpenClaw 命令 | **推荐** |
| 终端监听 | 简单 | 保护所有终端命令 | 需要保护其他工具 |
| OpenClaw 插件 | 复杂（需改源码） | 深度集成 | 开发者 |

## 总结

**MCP 服务器是最简单的方式**：
- ✅ 无需修改 OpenClaw 源码
- ✅ 只需修改配置文件
- ✅ 独立进程，不影响 OpenClaw 稳定性
- ✅ 可以随时启用/禁用

现在你可以用 MCP 方式保护 OpenClaw 了！🛡️
