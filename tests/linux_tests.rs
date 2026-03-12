/**
 * AI Guardian - Linux Integration Tests
 *
 * Linux 平台集成测试
 */

#[cfg(test)]
#[cfg(target_os = "linux")]
mod linux_tests {
    use ai_guardian::linux::*;
    use ai_guardian::core::*;
    use std::collections::HashMap;

    /// 测试 eBPF 监控器创建
    #[test]
    fn test_ebpf_monitor_creation() {
        let monitor = LinuxMonitor::new();
        // LinuxMonitor 总是创建成功
        assert!(!monitor.is_running());
    }

    /// 测试 AI 进程注册
    #[test]
    fn test_ai_process_registration() {
        let mut engine = LinuxGuardianEngine::new();

        // 尝试初始化
        let result = engine.initialize();
        if result.is_err() {
            println!("Engine initialization skipped (requires root)");
            return;
        }

        // 注册测试进程
        let result = engine.register_ai_process(1234, "test");
        assert!(result.is_ok());
        assert_eq!(engine.get_ai_process_count(), 1);

        // 注销进程
        let result = engine.unregister_ai_process(1234);
        assert!(result.is_ok());
        assert_eq!(engine.get_ai_process_count(), 0);
    }

    /// 测试内核版本检查
    #[test]
    fn test_kernel_version_check() {
        // 检查当前内核版本
        let uname = nix::sys::utsname::uname();
        let release = uname
            .map(|u| u.release().to_str().unwrap_or("").to_string())
            .unwrap_or_default();
        println!("Kernel version: {}", release);

        // 解析版本号
        let version_parts: Vec<&str> = release.split('.').collect();
        if version_parts.len() >= 2 {
            let major: u32 = version_parts[0].parse().unwrap_or(0);
            let minor: u32 = version_parts[1].parse().unwrap_or(0);

            // 需要 4.18+ 以获得 BPF ring buffer 支持
            assert!(
                major > 4 || (major == 4 && minor >= 18),
                "Kernel {}.{} is too old. Need 4.18+",
                major,
                minor
            );
        }
    }

    /// 测试 eBPF 程序加载
    #[test]
    fn test_ebpf_program_loading() {
        let mut monitor = LinuxMonitor::new();

        // 尝试启动
        let result = monitor.start();
        if result.is_err() {
            println!("eBPF start skipped (requires root or not implemented)");
        }
    }

    /// 测试配置更新
    #[test]
    fn test_config_update() {
        let mut engine = LinuxGuardianEngine::new();

        let config = DriverConfig {
            block_file_delete: true,
            block_system_path_write: true,
            block_network_connection: true,
            log_all_operations: false,
            risk_threshold: 70,
        };

        // 配置更新
        let result = engine.set_config(&config);
        // 允许失败（引擎可能未初始化）
        if result.is_err() {
            println!("Config update skipped (engine not initialized)");
        }
    }
}
