import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 根仓测试只覆盖后端运行时；ui/ 是独立的 Electron 子工程，
    // 依赖单独安装，由其自身的测试步骤负责
    exclude: ['**/node_modules/**', '**/dist/**', 'ui/**'],
  },
});
