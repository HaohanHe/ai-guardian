# Contributing to AI Guardian

感谢您对 AI Guardian 的兴趣！我们欢迎所有形式的贡献。

## 快速开始

1. Fork 本仓库
2. Clone 您的 fork: `git clone https://github.com/YOUR_USERNAME/ai-guardian.git`
3. 创建分支: `git checkout -b feature/your-feature-name`
4. 提交更改: `git commit -m "Add some feature"`
5. Push 到 fork: `git push origin feature/your-feature-name`
6. 创建 Pull Request

## 贡献类型

### 报告 Bug

- 使用 GitHub Issues
- 描述清楚复现步骤
- 提供环境信息（OS、Node版本等）
- 提供错误日志

### 提出新功能

- 先搜索是否已有类似 issue
- 描述清楚使用场景
- 说明为什么这个功能重要

### 提交代码

#### 代码规范

- 使用 TypeScript
- 遵循 ESLint 规则
- 添加必要的注释
- 编写单元测试

#### 提交信息规范

```
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
style: 代码格式调整
refactor: 重构代码
test: 添加测试
chore: 构建过程或辅助工具的变动
```

### 改进文档

- 修正拼写错误
- 改进说明清晰度
- 添加使用示例
- 翻译文档

## 当前优先任务

查看 [PROJECT-BRIEF.md](PROJECT-BRIEF.md) 了解当前状态和任务分配。

### 高优先级

1. **解决 AutoClaw Skill 加载问题** - 让 Guardian 能真正拦截命令
2. **系统级拦截实现** - Windows API Hooking / Linux LD_PRELOAD
3. **完善文档** - 让更多开发者能使用

### 中优先级

1. 支持更多 LLM 提供商
2. 改进风险评估算法
3. 添加更多测试

### 低优先级

1. UI 美化
2. 多语言支持
3. 性能优化

## 感谢

所有贡献者将在 README 中列出！

---

**让我们一起让天下没有危险的 AI Agent！** 
