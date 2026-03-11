# AI Guardian v0.2.0 功能清单

## 新增功能总览

### 1. 开机自启管理 ⏰

**文件**: [`src/platform/startup-manager.ts`](file:///e:/debot/ai-guardian/src/platform/startup-manager.ts)

- ✅ 支持 Windows、macOS、Linux 三大平台
- ✅ 可配置启动延迟（默认10秒）
- ✅ 支持最小化启动
- ✅ 带开关控制，随时启用/禁用

**CLI 命令**:
```bash
ai-guardian startup --enable    # 启用开机自启
ai-guardian startup --disable   # 禁用开机自启
ai-guardian startup --status    # 查看状态
```

---

### 2. 系统通知系统 🔔

**文件**: [`src/platform/notification-manager.ts`](file:///e:/debot/ai-guardian/src/platform/notification-manager.ts)

- ✅ 跨平台系统通知（Windows/macOS/Linux）
- ✅ **命令行 + 通知同时存在**（不是替代关系）
- ✅ 通知中显示拦截原因
- ✅ 通知中显示替代方案
- ✅ 支持在通知中直接操作（放行/拦截/稍后）

**通知类型**:
- 🚫 拦截通知 - 显示风险等级、原因、替代方案
- ⚡ 观察通知 - 告知用户正在观察的操作
- 🚨 急停通知 - 紧急状态提醒

**CLI 命令**:
```bash
ai-guardian test-notification   # 测试通知功能
```

---

### 3. Web API 服务器 🌐

**文件**: [`src/web/api-server.ts`](file:///e:/debot/ai-guardian/src/web/api-server.ts)

- ✅ HTTP API 供多平台远程控制
- ✅ 类似 OpenClaw Gateway 的设计
- ✅ 支持手机远程批准/拦截
- ✅ 认证令牌保护
- ✅ 实时事件推送

**API 端点**:
```
GET  /api/status          - 服务状态
GET  /api/pending         - 待处理请求列表
POST /api/approve         - 批准请求
POST /api/deny            - 拒绝请求
POST /api/emergency-stop  - 触发急停
GET  /api/history         - 历史记录
GET/POST /api/config      - 配置管理
```

**CLI 命令**:
```bash
ai-guardian server                    # 启动服务器（默认端口 3456）
ai-guardian server -p 8080            # 指定端口
ai-guardian server -t my-token        # 自定义认证令牌
```

**手机访问示例**:
```bash
curl http://<电脑IP>:3456/api/pending \
  -H "Authorization: Bearer <token>"
```

---

### 4. 急停按钮 🛑

**文件**: [`src/core/emergency-stop.ts`](file:///e:/debot/ai-guardian/src/core/emergency-stop.ts)

- ✅ **防呆设计** - 3秒内二次确认，防止误触
- ✅ 瞬间刹停所有 OpenClaw 操作
- ✅ 可配置是否启用二次确认
- ✅ 完整的触发历史记录
- ✅ 统计信息（触发次数、平均持续时间）

**防呆机制**:
1. 首次按下 → 进入待确认状态（3秒窗口期）
2. 二次确认 → 真正触发急停
3. 超时 → 自动取消

**CLI 命令**:
```bash
ai-guardian emergency-stop              # 触发急停（需二次确认）
ai-guardian emergency-stop --no-confirm # 跳过确认直接触发
ai-guardian resume                      # 解除急停，恢复运行
```

---

### 5. 动态环境感知 🌍

**文件**: [`src/core/environment-context.ts`](file:///e:/debot/ai-guardian/src/core/environment-context.ts)

- ✅ 自动检测运行环境
- ✅ 根据环境动态调整提示词
- ✅ "有则改之，无则加勉"原则
- ✅ 检测 OpenClaw 安装状态

**检测维度**:
- 系统信息（OS、用户名、管理员权限）
- 运行环境（CI、Docker、VM、生产环境）
- 安全环境（防火墙、杀毒软件、可信网络）
- OpenClaw 状态（安装、运行、配置路径）
- 时间上下文（工作时间、周末）

**自适应调整**:
| 环境条件 | 调整 |
|---------|------|
| 管理员权限 | 风险阈值 -10 |
| 生产环境 | 启用严格模式，阈值 -20 |
| OpenClaw 已安装 | 阈值 -10，添加警告 |
| 非工作时间 | 阈值 -5 |
| 周末 | 阈值 -5 |

**CLI 命令**:
```bash
ai-guardian env   # 检测环境并显示自适应配置
```

---

### 6. 命令混淆检测 🔍

**文件**: [`src/analysis/obfuscation-detector.ts`](file:///e:/debot/ai-guardian/src/analysis/obfuscation-detector.ts)

- ✅ 检测 25+ 种命令混淆技术
- ✅ Base64/十六进制解码执行检测
- ✅ 命令替换检测（`$()` 和反引号）
- ✅ 多阶段管道混淆检测
- ✅ 尝试反混淆显示原始命令

**检测的混淆技术**:
- Base64 解码执行
- 十六进制/八进制/Unicode 转义
- 命令替换（`$()` 和 `` ` ``）
- eval/exec 动态执行
- 字符串拼接混淆
- 管道混淆（`cat file | bash`）
- 多阶段混淆处理

---

### 7. OpenClaw 特定参数分析 🦞

**文件**: [`src/analysis/openclaw-analyzer.ts`](file:///e:/debot/ai-guardian/src/analysis/openclaw-analyzer.ts)

- ✅ 深度解析 OpenClaw 特有参数
- ✅ 检测 `elevated=full` 等危险配置
- ✅ 危险组合检测（如 `elevated=full + security=full`）
- ✅ MCP 配置注入检测
- ✅ 生成安全加固建议

**风险参数检测**:
| 参数 | 风险值 | 说明 |
|------|--------|------|
| `elevated=full` | 100 | 完全绕过审批 |
| `security=full` | 90 | 允许任意命令 |
| `autoAllowSkills=true` | 80 | 自动执行技能 |
| `ask=off` | 70 | 不询问确认 |
| `host=gateway` | 60 | 在主机执行 |

---

### 8. 新增 LLM 提供商 🤖

- ✅ **Google Gemini** - gemini-1.5-pro、gemini-1.5-flash（100万 token 上下文）
- ✅ **Alibaba Qwen (通义千问)** - qwen-max、qwen-plus、qwen-turbo

**完整提供商列表**:
1. OpenAI (GPT-4o, GPT-3.5-turbo)
2. Anthropic Claude (Claude 3.5 Sonnet, Claude 3 Opus)
3. DeepSeek (deepseek-chat, deepseek-reasoner)
4. **Google Gemini** (gemini-1.5-pro, gemini-1.5-flash) ⭐ 新增
5. **Alibaba Qwen** (qwen-max, qwen-plus, qwen-turbo) ⭐ 新增
6. 小米 MiMoFlash (mimoflash-v2)
7. Ollama (本地部署)

---

## 参考工信部 NVDB 安全预警的防护措施

根据 [工信部网络安全威胁和漏洞信息共享平台预警](https://www.nvdb.org.cn/publicAnnouncement/2019330237532790786)，AI Guardian 已实施以下防护：

### 预警要点对应

| NVDB 预警风险 | AI Guardian 防护措施 |
|--------------|---------------------|
| "信任边界模糊" | Agent 检测器识别 OpenClaw/Clawbot |
| "自身持续运行" | 开机自启管理 + 进程监控 |
| "自主决策" | 手自一体决策引擎（0-30/31-70/71-100） |
| "调用系统资源" | 命令执行审批 + 沙箱隔离建议 |
| "权限控制缺失" | 权限提升检测 + 管理员权限警告 |
| "审计机制缺失" | 执法记录仪全程审计日志 |
| "配置缺陷" | OpenClaw 参数深度分析 |
| "恶意接管" | 急停按钮 + 防呆设计 |
| "越权操作" | 风险评分 + 自动拦截 |
| "信息泄露" | 数据外泄检测 + 敏感文件保护 |

### 建议的安全加固配置

```json
{
  "startup": {
    "enabled": true,
    "delay": 10
  },
  "notification": {
    "enabled": true,
    "showAlternatives": true
  },
  "webAPI": {
    "enabled": true,
    "port": 3456,
    "auth": true
  },
  "emergencyStop": {
    "confirmationRequired": true,
    "confirmationWindow": 3000
  },
  "riskThreshold": {
    "default": 50,
    "production": 30,
    "adminMode": 40
  }
}
```

---

## 使用示例

### 完整工作流程

```bash
# 1. 检测环境
ai-guardian env

# 2. 启用开机自启
ai-guardian startup --enable

# 3. 启动 Web API 服务器
ai-guardian server -p 3456

# 4. 评估命令（另一个终端）
ai-guardian eval "rm -rf /"

# 5. 触发急停（如有需要）
ai-guardian emergency-stop

# 6. 解除急停
ai-guardian resume
```

### 手机远程控制

```bash
# 查看待处理请求
curl http://192.168.1.100:3456/api/pending \
  -H "Authorization: Bearer <token>"

# 批准请求
curl -X POST http://192.168.1.100:3456/api/approve \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"requestId": "req_123_456"}'

# 触发急停
curl -X POST http://192.168.1.100:3456/api/emergency-stop \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "发现异常操作"}'
```

---

## 下一步计划

根据用户要求，以下功能待增强：

1. **Skill 供应链防护** (当前 30% → 目标 100%)
   - Skill 代码静态分析
   - 权限声明检查
   - 危险模式检测

2. **MCP 注入检测** (当前 20% → 目标 90%)
   - MCP 配置验证
   - 服务器命令白名单
   - 环境变量审计

3. **Prompt 注入防护** (当前 20% → 目标 85%)
   - 文件内容扫描
   - 恶意指令模式检测
   - URL 内容预检
