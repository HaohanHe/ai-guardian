//! AI Guardian CLI 示例
//!
//! 演示如何使用 AI Guardian 库
//!
//! 使用方法:
//!   cargo run --example cli -- [命令]
//!
//! 命令:
//!   start    - 启动 AI Guardian
//!   stop     - 停止 AI Guardian
//!   status   - 查看状态
//!   list     - 列出 AI 终端进程
//!   add      - 手动添加 AI 进程 (需要 PID 参数)
//!   remove   - 手动移除 AI 进程 (需要 PID 参数)
//!   stats    - 查看驱动统计信息

use ai_guardian::{AiGuardian, GuardianConfig};
use std::env;
use std::thread;
use std::time::Duration;

fn main() {
    env_logger::init();

    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        print_usage();
        return;
    }

    let command = &args[1];

    match command.as_str() {
        "start" => cmd_start(),
        "stop" => cmd_stop(),
        "status" => cmd_status(),
        "list" => cmd_list(),
        "add" => {
            if args.len() < 3 {
                println!("错误: 需要 PID 参数");
                println!("用法: cargo run --example cli -- add <PID>");
                return;
            }
            cmd_add(&args[2]);
        }
        "remove" => {
            if args.len() < 3 {
                println!("错误: 需要 PID 参数");
                println!("用法: cargo run --example cli -- remove <PID>");
                return;
            }
            cmd_remove(&args[2]);
        }
        "stats" => cmd_stats(),
        "monitor" => cmd_monitor(),
        "help" | "-h" | "--help" => print_usage(),
        _ => {
            println!("未知命令: {}", command);
            print_usage();
        }
    }
}

fn print_usage() {
    println!("AI Guardian CLI - AI Agent 安全守护系统");
    println!();
    println!("用法: cargo run --example cli -- [命令] [参数]");
    println!();
    println!("命令:");
    println!("  start    启动 AI Guardian 监控");
    println!("  stop     停止 AI Guardian 监控");
    println!("  status   查看当前状态");
    println!("  list     列出检测到的 AI 终端进程");
    println!("  add      手动添加 AI 进程到监控列表 (需要 PID)");
    println!("  remove   手动移除 AI 进程 (需要 PID)");
    println!("  stats    查看驱动统计信息");
    println!("  monitor  持续监控模式");
    println!("  help     显示此帮助信息");
    println!();
    println!("示例:");
    println!("  cargo run --example cli -- start");
    println!("  cargo run --example cli -- add 1234");
    println!("  cargo run --example cli -- monitor");
}

fn cmd_start() {
    println!("🚀 正在启动 AI Guardian...");

    let config = GuardianConfig {
        auto_detect_ai_terminals: true,
        block_file_delete: true,
        block_system_path_write: true,
        block_network_connection: false,
        risk_threshold: 70,
        log_all_operations: true,
    };

    let mut guardian = AiGuardian::with_config(config);

    match guardian.start() {
        Ok(()) => {
            println!("✅ AI Guardian 启动成功!");
            println!();
            println!("配置信息:");
            println!("  - 自动检测 AI 终端: 启用");
            println!("  - 阻断文件删除: 启用");
            println!("  - 阻断系统路径写入: 启用");
            println!("  - 风险阈值: 70");
            println!();
            println!("正在监控的 AI Agent:");
            println!("  - OpenClaw");
            println!("  - Cursor");
            println!("  - Windsurf");
            println!("  - Trae");
            println!("  - Claude Code");
            println!();

            // 保持运行一段时间
            println!("按 Ctrl+C 停止...");
            loop {
                thread::sleep(Duration::from_secs(1));
            }
        }
        Err(e) => {
            eprintln!("❌ 启动失败: {}", e);
            std::process::exit(1);
        }
    }
}

fn cmd_stop() {
    println!("正在停止 AI Guardian...");
    // 注意：实际实现需要 IPC 或信号来停止守护进程
    println!("请直接关闭运行中的实例");
}

fn cmd_status() {
    println!("📊 AI Guardian 状态");
    println!();

    // 尝试连接驱动
    let mut guardian = AiGuardian::new();

    match guardian.start() {
        Ok(()) => {
            println!("状态: ✅ 运行中");

            #[cfg(windows)]
            {
                if guardian.is_driver_connected() {
                    println!("驱动状态: ✅ 已连接");
                } else {
                    println!("驱动状态: ⚠️ 未连接 (仅监控模式)");
                }
            }

            println!("AI 终端进程数: {}", guardian.ai_process_count());

            guardian.stop();
        }
        Err(e) => {
            println!("状态: ❌ 未运行 ({})", e);
        }
    }
}

fn cmd_list() {
    println!("📋 AI 终端进程列表");
    println!();

    let mut guardian = AiGuardian::new();

    match guardian.start() {
        Ok(()) => {
            thread::sleep(Duration::from_millis(500));

            let processes = guardian.get_ai_processes();

            if processes.is_empty() {
                println!("未检测到 AI 终端进程");
                println!();
                println!("提示: 启动你的 AI Agent (OpenClaw, Cursor 等) 后重试");
            } else {
                println!("{:<10} {:<20} {:<30}", "PID", "进程名", "命令行");
                println!("{}", "-".repeat(80));

                for proc in processes {
                    let cmd_short = if proc.command_line.len() > 40 {
                        format!("{}...", &proc.command_line[..37])
                    } else {
                        proc.command_line.clone()
                    };

                    println!("{:<10} {:<20} {:<30}",
                        proc.pid,
                        proc.name,
                        cmd_short
                    );
                }
            }

            guardian.stop();
        }
        Err(e) => {
            eprintln!("启动失败: {}", e);
        }
    }
}

fn cmd_add(pid_str: &str) {
    let pid: u32 = match pid_str.parse() {
        Ok(p) => p,
        Err(_) => {
            eprintln!("错误: PID 必须是数字");
            return;
        }
    };

    println!("➕ 添加 AI 进程 PID: {}", pid);

    let mut guardian = AiGuardian::new();

    match guardian.start() {
        Ok(()) => {
            match guardian.add_ai_process(pid) {
                Ok(()) => {
                    println!("✅ 成功添加进程 {} 到监控列表", pid);
                }
                Err(e) => {
                    eprintln!("❌ 添加失败: {}", e);
                }
            }
            guardian.stop();
        }
        Err(e) => {
            eprintln!("启动失败: {}", e);
        }
    }
}

fn cmd_remove(pid_str: &str) {
    let pid: u32 = match pid_str.parse() {
        Ok(p) => p,
        Err(_) => {
            eprintln!("错误: PID 必须是数字");
            return;
        }
    };

    println!("➖ 移除 AI 进程 PID: {}", pid);

    let mut guardian = AiGuardian::new();

    match guardian.start() {
        Ok(()) => {
            match guardian.remove_ai_process(pid) {
                Ok(()) => {
                    println!("✅ 成功移除进程 {} 从监控列表", pid);
                }
                Err(e) => {
                    eprintln!("❌ 移除失败: {}", e);
                }
            }
            guardian.stop();
        }
        Err(e) => {
            eprintln!("启动失败: {}", e);
        }
    }
}

fn cmd_stats() {
    println!("📈 驱动统计信息");
    println!();

    let mut guardian = AiGuardian::new();

    match guardian.start() {
        Ok(()) => {
            #[cfg(windows)]
            {
                match guardian.get_driver_stats() {
                    Ok(stats) => {
                        println!("驱动状态: {}", if stats.driver_active { "✅ 活跃" } else { "❌ 未激活" });
                        println!("AI 进程数: {}", stats.ai_process_count);
                        println!("已阻断操作: {}", stats.total_operations_blocked);
                        println!("已允许操作: {}", stats.total_operations_allowed);

                        if stats.total_operations_blocked + stats.total_operations_allowed > 0 {
                            let block_rate = (stats.total_operations_blocked as f64 /
                                (stats.total_operations_blocked + stats.total_operations_allowed) as f64) * 100.0;
                            println!("阻断率: {:.2}%", block_rate);
                        }
                    }
                    Err(e) => {
                        eprintln!("获取统计信息失败: {}", e);
                    }
                }
            }

            guardian.stop();
        }
        Err(e) => {
            eprintln!("启动失败: {}", e);
        }
    }
}

fn cmd_monitor() {
    println!("🔍 持续监控模式");
    println!("按 Ctrl+C 停止...");
    println!();

    let mut guardian = AiGuardian::new();

    match guardian.start() {
        Ok(()) => {
            loop {
                let count = guardian.ai_process_count();

                print!("\r监控中... AI 终端进程: {} | 驱动连接: {} | 时间: {}",
                    count,
                    if guardian.is_driver_connected() { "✅" } else { "❌" },
                    chrono::Local::now().format("%H:%M:%S")
                );

                thread::sleep(Duration::from_secs(1));
            }
        }
        Err(e) => {
            eprintln!("启动失败: {}", e);
        }
    }
}
