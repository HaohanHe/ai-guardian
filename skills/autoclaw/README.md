# AI Guardian Skill for AutoClaw

> **AutoClaw 专用 Skill 格式**

## 重要发现

**AutoClaw 使用的是 Skill 系统，不是 OpenClaw Extension！**

- AutoClaw 基于 OpenCode
- 使用 `skills` 配置，不是 `extensions`
- 需要在 `before_tool_call` hook 中拦截

## 安装步骤

### 步骤 1：复制 Skill 到 AutoClaw

```powershell
# 创建 skills 目录
mkdir "C:\Users\LENOVO\.openclaw-autoclaw\workspace\.opencode\skills\ai-guardian"

# 复制文件
copy "e:\debot\ai-guardian\skills\autoclaw\ai-guardian-skill\index.ts" "C:\Users\LENOVO\.openclaw-autoclaw\workspace\.opencode\skills\ai-guardian\"
copy "e:\debot\ai-guardian\skills\autoclaw\ai-guardian-skill\skill.json" "C:\Users\LENOVO\.openclaw-autoclaw\workspace\.opencode\skills\ai-guardian\"
```

### 步骤 2：配置 AutoClaw

编辑 `C:\Users\LENOVO\.openclaw-autoclaw\openclaw.json`，添加 skill 配置：

```json
{
  "skills": {
    "load": {
      "extraDirs": [
        "C:\\Users\\LENOVO\\.openclaw-autoclaw\\workspace\\.opencode\\skills"
      ]
    },
    "ai-guardian": {
      "enabled": true,
      "guardianUrl": "http://localhost:3456",
      "guardianToken": "4zmc5md9gmt77cnvwj039v",
      "alertThreshold": 70,
      "autoBlock": true
    }
  }
}
```

### 步骤 3：重启 AutoClaw

完全退出 AutoClaw，然后重新启动。

## 验证安装

查看 AutoClaw 日志，确认 skill 被加载：
```powershell
Get-Content "C:\Users\LENOVO\.openclaw-autoclaw\logs\gateway.log" -Tail 50
```

应该能看到：
```
[ai-guardian] 🛡️ AI Guardian Skill activated
```

## 测试

让 AutoClaw 执行：
```
删除 C:\Users\LENOVO\Desktop\zeppos-samples-main 里的所有文件
```

**预期结果**：被拦截！

## 文件结构

```
skills/autoclaw/ai-guardian-skill/
├── index.ts      # Skill 入口
├── skill.json    # Skill 配置
└── README.md     # 文档
```

## 工作原理

```
AutoClaw 执行命令
    ↓
before_tool_call hook (AI Guardian Skill)
    ↓
调用 Guardian API 评估
    ↓
风险 >= 70 → 阻断并返回错误
风险 < 70 → 允许执行
```

---

**这才是 AutoClaw 正确的接入方式！** 🎯
