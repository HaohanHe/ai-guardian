/**
 * AI Guardian - Windows Integration Tests
 *
 * Windows 平台集成测试
 */

#[cfg(test)]
#[cfg(target_os = "windows")]
mod windows_tests {
    use ai_guardian::driver::windows::*;
    use ai_guardian::core::*;

    /// 测试 Windows 驱动连接
    #[test]
    fn test_driver_connection() {
        let driver = WindowsDriver::open();
        // 驱动可能未安装，所以允许失败
        if let Ok(driver) = driver {
            let stats = driver.get_stats();
            assert!(stats.is_ok());
        }
    }

    /// 测试 AI 进程注册
    #[test]
    fn test_ai_process_registration() {
        let mut engine = WindowsGuardianEngine::new();
        
        // 初始化引擎
        let result = engine.initialize();
        // 允许失败（如果驱动未安装）
        if result.is_err() {
            println!("Engine initialization skipped (driver not installed)");
            return;
        }

        // 注册测试进程
        let result = engine.register_ai_process(1234, "test.exe");
        assert!(result.is_ok());

        // 验证进程已注册
        assert_eq!(engine.get_ai_process_count(), 1);

        // 注销进程
        let result = engine.unregister_ai_process(1234);
        assert!(result.is_ok());
        assert_eq!(engine.get_ai_process_count(), 0);
    }

    /// 测试文件操作拦截
    #[test]
    fn test_file_operation_interception() {
        // 这需要实际的内核驱动支持
        // 在测试环境中可能无法运行
        println!("File operation interception test requires kernel driver");
    }

    /// 测试 ETW 进程监控
    #[test]
    fn test_etw_monitor() {
        let monitor = EtwProcessMonitor::new();
        assert!(monitor.is_ok());

        let mut monitor = monitor.unwrap();
        
        // 注册回调
        monitor.set_event_callback(|event| {
            println!("Process event: {:?}", event);
        });

        // 启动监控
        let result = monitor.start();
        // 允许失败（需要管理员权限）
        if result.is_err() {
            println!("ETW monitor test skipped (requires admin)");
        }
    }

    /// 测试 WFP 网络监控
    #[test]
    fn test_wfp_monitor() {
        let mut monitor = WfpNetworkMonitor::new();
        
        // 注册回调
        monitor.set_event_callback(|event| {
            println!("Network event: {:?}", event);
            wfp_monitor::ConnectionDecision::Allow
        });

        // 启动监控
        let result = monitor.start();
        // 允许失败（需要管理员权限）
        if result.is_err() {
            println!("WFP monitor test skipped (requires admin)");
        }
    }

    /// 测试驱动配置
    #[test]
    fn test_driver_config() {
        let driver = WindowsDriver::open();
        if let Ok(driver) = driver {
            let config = DriverConfig::default();
            let result = driver.set_config(&config);
            assert!(result.is_ok());
        }
    }
}
