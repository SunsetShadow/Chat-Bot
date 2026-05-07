import { Injectable } from '@nestjs/common';
import { ScanResult, ScanThreat } from './skill.types';

const MAX_INSTRUCTIONS_SIZE = 64 * 1024; // 64KB

// ── 路径遍历（8 patterns）──
const PATH_TRAVERSAL_PATTERNS: [RegExp, string][] = [
  [/\.{2,}[/\\]/, '路径遍历 (../)'],
  [/\/etc\//, '绝对路径引用 /etc/'],
  [/\/proc\//, '绝对路径引用 /proc/'],
  [/\/var\/log\//, '日志目录访问 /var/log/'],
  [/[A-Za-z]:\\/, 'Windows 绝对路径'],
  [/\\~\//, 'Home 目录引用 ~/'],
  [/\/root\//, 'Root 目录访问'],
  [/\/tmp\/\.X/, '临时隐藏文件访问'],
];

// ── 代码注入（12 patterns）──
const CODE_INJECTION_PATTERNS: [RegExp, string][] = [
  [/<script[\s>]/i, 'HTML script 标签注入'],
  [/javascript\s*:/i, 'JavaScript protocol 注入'],
  [/\beval\s*\(/, 'eval() 动态代码执行'],
  [/\bexec\s*\(/, 'exec() 命令执行'],
  [/\bsystem\s*\(/, 'system() 系统命令'],
  [/\bpopen\s*\(/, 'popen() 进程管道'],
  [/\bsubprocess\s*\.\s*(call|run|Popen)/, 'subprocess 模块调用'],
  [/\bos\s*\.\s*(system|popen|exec)/, 'os.system/popen 调用'],
  [/\bchild_process\b/, 'Node.js child_process 模块'],
  [/on\w+\s*=\s*["']/, 'HTML 事件处理器注入'],
  [/data\s*:\s*text\/html/i, 'data URI HTML 注入'],
  [/vbscript\s*:/i, 'VBScript protocol 注入'],
];

// ── 可疑命令（15 patterns）──
const SUSPICIOUS_COMMAND_PATTERNS: [RegExp, string][] = [
  [/\brm\s+(-\w*r\w*f|--force|-rf|-fr)/, 'rm -rf 强制递归删除'],
  [/\brm\s+--no-preserve-root/, 'rm 跳过 root 保护'],
  [/\bdel\s+\/s/i, 'Windows 批量删除'],
  [/\bformat\s+[a-z]:/i, '磁盘格式化'],
  [/\bmkfs\b/i, '文件系统格式化'],
  [/\bdd\s+if=\/dev\/zero/, 'dd 覆写磁盘'],
  [/>\s*\/dev\/sd/, '直接写入块设备'],
  [/\bchmod\s+(-R\s+)?777/, 'chmod 777 全权限'],
  [/\bchown\s+(-R\s+)?root/, 'chown root 提权'],
  [/\bsudo\s+rm/, 'sudo 删除'],
  [/\biptables\s+-F/, '防火墙规则清除'],
  [/\bkill\s+(-9\s+)?-1\b/, 'kill 所有进程'],
  [/\bshutdown\b/, '系统关机'],
  [/\breboot\b/, '系统重启'],
  [/\bcrontab\s+-r/, '清除所有 cron 任务'],
];

// ── 环境变量泄露（10 patterns）──
const ENV_LEAK_PATTERNS: [RegExp, string][] = [
  [/\bAWS_[A-Z_]+\b/, 'AWS 凭证变量引用'],
  [/\bGITHUB_TOKEN\b/i, 'GitHub Token 变量引用'],
  [/\bOPENAI_API_KEY\b/i, 'OpenAI API Key 变量引用'],
  [/\bDATABASE_URL\b/i, '数据库连接字符串引用'],
  [/\bSECRET[A-Z_]*\b/, 'SECRET 类变量引用'],
  [/\bPRIVATE[_ ]?KEY\b/i, '私钥变量引用'],
  [/\bAPI[_ ]?KEY\b/i, 'API Key 变量引用'],
  [/\bACCESS[_ ]?TOKEN\b/i, 'Access Token 引用'],
  [/\b(sk|pk|ghp|gho|ghs|ghc)_[a-zA-Z0-9]{20,}/, '疑似硬编码密钥/Token'],
  [/password\s*[:=]\s*["'][^"']{4,}/i, '硬编码密码'],
];

// ── 网络请求（10 patterns）──
const NETWORK_PATTERNS: [RegExp, string][] = [
  [/\bfetch\s*\(\s*["']https?:\/\//, 'fetch() HTTP 请求'],
  [/\baxios\s*\.\s*(get|post|put|delete|patch)\s*\(/, 'axios HTTP 请求'],
  [/\bhttp\.get\s*\(/, 'Node.js http.get'],
  [/\brequest\s*\(\s*["']https?:\/\//, 'request() HTTP 调用'],
  [/\burllib\b/, 'urllib 网络库'],
  [/\brequests\s*\.\s*(get|post|put)\s*\(/, 'Python requests'],
  [/\bWebSocket\s*\(/, 'WebSocket 连接'],
  [/\bsocket\.io\b/i, 'Socket.IO 连接'],
  [/new\s+XMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\b\.send\s*\(\s*.*\b(Buffer|buffer)\b/, '原始数据发送'],
];

// ── 文件系统危险操作（10 patterns）──
const FILESYSTEM_PATTERNS: [RegExp, string][] = [
  [/\bfs\s*\.\s*(unlink|rmdir|rm)\s*\(/, 'Node.js 文件删除'],
  [/\bfs\s*\.\s*(writeFile|appendFile)\s*\(.*\.\.\//, 'Node.js 写入路径遍历'],
  [/\bos\s*\.\s*remove\s*\(/, 'Python os.remove'],
  [/\bshutil\s*\.\s*rmtree\s*\(/, 'Python shutil.rmtree'],
  [/\bopen\s*\([^)]*["']w["']/, 'Python 文件写入'],
  [/\bchmod\s*\(/, 'chmod 系统调用'],
  [/\bchown\s*\(/, 'chown 系统调用'],
  [/\bsymlink\s*\(/, '符号链接创建'],
  [/\bhardlink\s*\(/, '硬链接创建'],
  [/\bmount\s*\(/, '文件系统挂载'],
];

// ── Symlink 转义（5 patterns）──
const SYMLINK_PATTERNS: [RegExp, string][] = [
  [/\bsymlink\s*\(\s*["']\//, '符号链接到绝对路径'],
  [/\breadlink\s*\(/, 'readlink 读取符号链接'],
  [/\blstat\s*\(/, 'lstat 不跟随符号链接'],
  [/ln\s+-s\s+\//, 'ln -s 创建绝对符号链接'],
  [/\/\.\./, '路径中的隐藏遍历'],
];

// ── 反弹 Shell / C2（8 patterns）──
const C2_PATTERNS: [RegExp, string][] = [
  [/bash\s+-i\s*>&/, 'Bash 反弹 Shell'],
  [/nc\s+-[elp]/, 'Netcat 监听/反弹'],
  [/\/dev\/tcp\//, 'Bash /dev/tcp 网络连接'],
  [/python\s+-c\s+.*socket/, 'Python socket 反弹'],
  [/\bpowercat\b/, 'PowerShell 反弹 Shell'],
  [/\bmeterpreter\b/i, 'Meterpreter 引用'],
  [/\breverse[_ ]?shell\b/i, '反弹 Shell 关键字'],
  [/\bconnect[_ ]?back\b/i, '回调连接关键字'],
];

// ── 权限提升（7 patterns）──
const PRIVILEGE_PATTERNS: [RegExp, string][] = [
  [/\bsudo\s+/, 'sudo 提权'],
  [/\bsu\s+/, 'su 切换用户'],
  [/\bdoas\s+/, 'doas 提权'],
  [/\bpkexec\b/, 'pkexec PolicyKit 提权'],
  [/\bgpasswd\b/, 'gpasswd 组权限修改'],
  [/\busermod\b/, 'usermod 用户修改'],
  [/\bpasswd\s+\w+/, 'passwd 修改密码'],
];

export type TrustLevel = 'trusted' | 'review' | 'untrusted';

@Injectable()
export class SkillScanService {
  /** 扫描 Skill 内容，trust level 影响检测严格度 */
  scan(
    instructions: string,
    name: string,
    description: string,
    trust: TrustLevel = 'review',
  ): ScanResult {
    const threats: ScanThreat[] = [];
    const allContent = `${name}\n${description}\n${instructions}`;

    // trusted 级别仅做基础检查
    const fullScan = trust !== 'trusted';

    // ── 基础检查（所有信任级别）──
    this.checkSize(instructions, threats);
    this.checkYaml(name, description, threats);

    if (fullScan) {
      // ── 路径遍历 ──
      this.checkPatterns(allContent, PATH_TRAVERSAL_PATTERNS, 'path_traversal', 'error', threats);

      // ── 代码注入 ──
      this.checkPatterns(instructions, CODE_INJECTION_PATTERNS, 'code_injection', 'error', threats);

      // ── 可疑命令 ──
      this.checkPatterns(instructions, SUSPICIOUS_COMMAND_PATTERNS, 'suspicious_command', 'warning', threats);

      // ── 环境变量泄露 ──
      this.checkPatterns(allContent, ENV_LEAK_PATTERNS, 'env_leak', 'warning', threats);

      // ── 网络请求 ──
      this.checkPatterns(instructions, NETWORK_PATTERNS, 'network_request', 'warning', threats);

      // ── 文件系统危险操作 ──
      this.checkPatterns(instructions, FILESYSTEM_PATTERNS, 'filesystem_op', 'warning', threats);

      // ── Symlink 转义 ──
      this.checkPatterns(instructions, SYMLINK_PATTERNS, 'symlink_escape', 'error', threats);

      // ── 反弹 Shell / C2 ──
      this.checkPatterns(instructions, C2_PATTERNS, 'c2_activity', 'error', threats);

      // ── 权限提升 ──
      this.checkPatterns(instructions, PRIVILEGE_PATTERNS, 'privilege_escalation', 'warning', threats);
    }

    // untrusted 额外严格检查
    if (trust === 'untrusted') {
      this.checkUntrustedExtra(instructions, allContent, threats);
    }

    // 去重（相同 type + pattern 不重复）
    const seen = new Set<string>();
    const unique = threats.filter(t => {
      const key = `${t.type}:${t.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const hasErrors = unique.some(t => t.severity === 'error');
    return { safe: !hasErrors, threats: unique };
  }

  private checkSize(instructions: string, threats: ScanThreat[]) {
    if (instructions.length > MAX_INSTRUCTIONS_SIZE) {
      threats.push({
        type: 'size_exceeded',
        severity: 'error',
        message: `Instructions 超过大小限制 (${Math.round(instructions.length / 1024)}KB > 64KB)`,
      });
    }
  }

  private checkYaml(name: string, description: string, threats: ScanThreat[]) {
    if (!name || !description) {
      threats.push({
        type: 'invalid_yaml',
        severity: 'error',
        message: 'name 和 description 为必填字段',
      });
    }
  }

  private checkPatterns(
    content: string,
    patterns: [RegExp, string][],
    type: ScanThreat['type'],
    severity: ScanThreat['severity'],
    threats: ScanThreat[],
  ) {
    for (const [pattern, desc] of patterns) {
      if (pattern.test(content)) {
        threats.push({ type, severity, message: desc });
      }
    }
  }

  /** untrusted 来源的额外严格检查 */
  private checkUntrustedExtra(instructions: string, allContent: string, threats: ScanThreat[]) {
    // 检查是否尝试读取敏感文件
    if (/\/etc\/(passwd|shadow|ssh|hosts)/.test(allContent)) {
      threats.push({
        type: 'path_traversal',
        severity: 'error',
        message: '尝试读取系统敏感文件',
      });
    }

    // 检查是否尝试安装额外依赖
    if (/\b(npm\s+install|pip\s+install|gem\s+install|cargo\s+install)/.test(instructions)) {
      threats.push({
        type: 'suspicious_command',
        severity: 'warning',
        message: '尝试安装外部依赖包',
      });
    }

    // 检查 base64 编码的可疑内容
    if (/base64\s*[-d]\s/.test(instructions) || /atob\s*\(/.test(instructions)) {
      threats.push({
        type: 'code_injection',
        severity: 'warning',
        message: '包含 Base64 解码操作，可能隐藏恶意内容',
      });
    }

    // 检查 Shell 管道链
    if (/\|\s*(nc|curl|wget|bash|sh|python|perl)\b/.test(instructions)) {
      threats.push({
        type: 'c2_activity',
        severity: 'error',
        message: '可疑 Shell 管道链，可能是远程命令执行',
      });
    }
  }
}
