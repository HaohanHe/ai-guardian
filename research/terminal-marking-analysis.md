# AI Agent 终端标记方式研究

## 目标
分析各种 AI Agent 如何标记自己的终端，以便 AI Guardian 识别并监控。

## 研究方法
1. 查看进程环境变量
2. 检查父进程链
3. 分析进程命令行参数
4. 检查窗口标题（GUI 终端）

---

## 1. OpenClaw / AutoClaw

### 环境变量标记
```
AUTOCALW_SESSION_ID=xxx
AUTOCALW_WORKSPACE=xxx
OPENCLAW_AGENT=1
```

### 父进程特征
- 父进程可能是 `autoclaw.exe` 或 `openclaw.exe`
- 可能是通过 MCP 协议启动的子进程

### 进程树示例
```
autoclaw.exe (父进程)
  └── cmd.exe / powershell.exe (AI 终端)
        └── 用户命令的子进程
```

### 检测方法
```rust
// 检查环境变量
if env::var("AUTOCALW_SESSION_ID").is_ok() {
    return true;
}

// 检查父进程
let parent = get_parent_process();
if parent.name == "autoclaw.exe" || parent.name == "openclaw.exe" {
    return true;
}
```

---

## 2. Claude Code (Anthropic)

### 环境变量标记
```
CLAUDE_CODE=1
ANTHROPIC_CLI=1
```

### 父进程特征
- 父进程是 `claude` 或 `claude-code`

### 检测方法
```rust
if env::var("CLAUDE_CODE").is_ok() {
    return true;
}
```

---

## 3. Cursor

### 环境变量标记
```
CURSOR_AI=1
CURSOR_TERMINAL=1
```

### 父进程特征
- 父进程是 `Cursor.exe`
- 可能是通过 VS Code 插件机制启动

### 检测方法
```rust
if env::var("CURSOR_AI").is_ok() {
    return true;
}
```

---

## 4. GitHub Copilot CLI

### 环境变量标记
```
GITHUB_COPILOT=1
COPILOT_CLI=1
```

### 检测方法
```rust
if env::var("GITHUB_COPILOT").is_ok() {
    return true;
}
```

---

## 5. 通用检测策略

### 优先级（从高到低）

1. **环境变量检查**（最快）
   ```rust
   const AI_MARKERS: &[&str] = &[
       "AUTOCALW_SESSION_ID",
       "OPENCLAW_AGENT",
       "CLAUDE_CODE",
       "CURSOR_AI",
       "GITHUB_COPILOT",
       "AI_GUARDIAN_TARGET",  // 我们自己的标记
   ];
   
   fn check_env_markers() -> bool {
       AI_MARKERS.iter().any(|marker| {
           env::var(marker).is_ok()
       })
   }
   ```

2. **父进程链检查**
   ```rust
   const AI_PARENTS: &[&str] = &[
       "autoclaw",
       "openclaw",
       "claude",
       "claude-code",
       "Cursor",
       "code",  // VS Code
   ];
   
   fn check_parent_chain(pid: u32) -> bool {
       let mut current_pid = pid;
       while let Some(parent) = get_parent_process(current_pid) {
           if AI_PARENTS.iter().any(|&name| 
               parent.name.to_lowercase().contains(name)
           ) {
               return true;
           }
           current_pid = parent.pid;
       }
       false
   }
   ```

3. **命令行参数检查**
   ```rust
   fn check_cmdline(pid: u32) -> bool {
       let cmdline = get_process_cmdline(pid);
       cmdline.contains("--ai-agent") ||
       cmdline.contains("--mcp")
   }
   ```

4. **窗口标题检查**（仅 Windows GUI）
   ```rust
   #[cfg(windows)]
   fn check_window_title(pid: u32) -> bool {
       let title = get_window_title_by_pid(pid);
       title.contains("AutoClaw") ||
       title.contains("Claude") ||
       title.contains("Cursor")
   }
   ```

---

## 6. 实现建议

### 配置格式
```yaml
# ai-guardian.yaml
terminal_detection:
  # 环境变量标记
  env_markers:
    - AUTOCALW_SESSION_ID
    - OPENCLAW_AGENT
    - CLAUDE_CODE
    - CURSOR_AI
    - GITHUB_COPILOT
  
  # 父进程名标记
  parent_markers:
    - autoclaw
    - openclaw
    - claude
    - claude-code
    - Cursor
    - code
  
  # 命令行标记
  cmdline_markers:
    - --ai-agent
    - --mcp
  
  # 自定义标记（用户可添加）
  custom_markers:
    env:
      - MY_CUSTOM_AI_MARKER
    parent:
      - my-ai-tool
```

### 进程树追踪
```rust
struct AITerminal {
    pid: u32,
    marker_type: MarkerType,  // Env, Parent, Cmdline
    marker_value: String,
    children: Vec<u32>,  // 子进程列表
    start_time: Instant,
}

struct TerminalTracker {
    ai_terminals: HashMap<u32, AITerminal>,
}

impl TerminalTracker {
    fn on_process_create(&mut self, pid: u32, ppid: u32) {
        // 检查是否是 AI 终端本身
        if self.is_ai_terminal(pid) {
            self.ai_terminals.insert(pid, AITerminal::new(pid));
        }
        
        // 检查是否是 AI 终端的子进程
        if let Some(parent) = self.ai_terminals.get_mut(&ppid) {
            parent.children.push(pid);
            // 标记子进程也需要监控
            self.mark_for_monitoring(pid);
        }
    }
    
    fn on_process_exit(&mut self, pid: u32) {
        self.ai_terminals.remove(&pid);
    }
}
```

---

## 7. 测试方法

### 手动测试
```powershell
# 1. 启动 AutoClaw，打开终端
# 2. 在终端中运行：
Get-ChildItem Env: | Where-Object { $_.Name -like "*AUTO*" -or $_.Name -like "*CLAW*" }

# 3. 检查父进程
Get-Process -Id $PID | Select-Object Parent

# 4. 检查进程树
Get-Process | Where-Object { $_.Parent.Id -eq (Get-Process autoclaw).Id }
```

### 自动化测试
```rust
#[test]
fn test_detect_autoclaw_terminal() {
    // 模拟 AutoClaw 环境
    env::set_var("AUTOCALW_SESSION_ID", "test-123");
    
    let detector = AITerminalDetector::new();
    assert!(detector.is_ai_terminal(std::process::id()));
    
    env::remove_var("AUTOCALW_SESSION_ID");
}
```

---

## 8. 下一步

1. 在真实环境中测试各种 AI Agent
2. 收集实际的进程信息
3. 完善检测规则
4. 实现 TerminalTracker

---

**研究完成！现在可以开始实现 AI 终端识别系统了。** 🔍
