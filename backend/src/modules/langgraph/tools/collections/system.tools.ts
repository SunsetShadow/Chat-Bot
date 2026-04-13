import { z } from 'zod';
import { spawn } from 'node:child_process';
import { safeTool } from '../base/tool.helper';

/**
 * 创建获取当前时间工具 — 零依赖，返回服务器时间
 */
export function createTimeNowTool() {
  return safeTool(
    'time_now',
    `获取服务器当前的日期和时间。

何时使用：
- 用户询问"现在几点"、"今天几号"、"当前时间"等
- 需要获取时间戳进行计算或比较
- 任何需要知道当前时间的场景`,
    z.object({}),
    async () => {
      const now = new Date();
      return `当前时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\nISO: ${now.toISOString()}\n时间戳: ${now.getTime()}`;
    },
  );
}

/**
 * 创建执行命令工具 — 在服务器上执行系统命令
 */
export function createExecuteCommandTool() {
  return safeTool(
    'execute_command',
    `在服务器上执行系统命令。

何时使用：
- 用户明确要求执行某个命令（如 "运行 ls"、"执行 npm test"）
- 需要检查系统状态（如 "查看磁盘空间"、"查看进程"）
- 需要执行构建、测试等开发操作

注意：
- 命令输出有长度限制，避免执行会产生大量输出的命令
- 危险操作（如 rm -rf）请谨慎执行
- 如果命令执行超时（30秒），会自动终止`,
    z.object({
      command: z.string().describe('要执行的命令'),
      workingDirectory: z.string().optional().describe('工作目录，默认为当前目录'),
    }),
    async ({ command, workingDirectory }) => {
      const cwd = workingDirectory || process.cwd();

      return new Promise<string>((resolve) => {
        const child = spawn(command, [], { cwd, shell: true, timeout: 30000 });
        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });
        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
        child.on('error', (error) => {
          resolve(`命令启动失败: ${error.message}`);
        });
        child.on('close', (code) => {
          const exitMsg = code === 0 ? '✅ 执行成功' : `❌ 退出码: ${code}`;
          const output = [exitMsg];
          if (stdout) output.push(`\nstdout:\n${stdout}`);
          if (stderr) output.push(`\nstderr:\n${stderr}`);
          resolve(output.join(''));
        });
      });
    },
  );
}
