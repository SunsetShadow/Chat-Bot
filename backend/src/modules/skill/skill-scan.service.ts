import { Injectable } from '@nestjs/common';
import { ScanResult, ScanThreat } from './skill.types';

const MAX_INSTRUCTIONS_SIZE = 64 * 1024; // 64KB

const CODE_INJECTION_PATTERNS = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /\beval\s*\(/,
  /\bexec\s*\(/,
  /\bsystem\s*\(/,
];

const SUSPICIOUS_COMMAND_PATTERNS = [
  /\brm\s+(-\w*r\w*f|--force)/,
  /\bdel\s+\/s/i,
  /\bformat\s+[a-z]:/i,
];

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
  /\/etc\//,
  /[A-Za-z]:\\/,
];

@Injectable()
export class SkillScanService {
  scan(instructions: string, name: string, description: string): ScanResult {
    const threats: ScanThreat[] = [];

    // 大小检查
    if (instructions.length > MAX_INSTRUCTIONS_SIZE) {
      threats.push({
        type: 'size_exceeded',
        severity: 'error',
        message: `Instructions 超过大小限制 (${Math.round(instructions.length / 1024)}KB > 64KB)`,
      });
    }

    // 路径遍历
    const allContent = `${name}\n${description}\n${instructions}`;
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(allContent)) {
        threats.push({
          type: 'path_traversal',
          severity: 'error',
          message: `内容包含疑似路径遍历模式: ${pattern.source}`,
        });
        break;
      }
    }

    // 代码注入（仅检查 instructions）
    for (const pattern of CODE_INJECTION_PATTERNS) {
      if (pattern.test(instructions)) {
        threats.push({
          type: 'code_injection',
          severity: 'error',
          message: `Instructions 包含疑似代码注入: ${pattern.source}`,
        });
        break;
      }
    }

    // YAML 格式
    if (!name || !description) {
      threats.push({
        type: 'invalid_yaml',
        severity: 'error',
        message: 'name 和 description 为必填字段',
      });
    }

    // 可疑命令
    for (const pattern of SUSPICIOUS_COMMAND_PATTERNS) {
      if (pattern.test(instructions)) {
        threats.push({
          type: 'suspicious_command',
          severity: 'warning',
          message: `Instructions 包含可疑命令: ${pattern.source}`,
        });
        break;
      }
    }

    const hasErrors = threats.some(t => t.severity === 'error');
    return { safe: !hasErrors, threats };
  }
}
