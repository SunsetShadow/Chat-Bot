import { Injectable } from '@nestjs/common';
import { join, resolve } from 'node:path';
import { readFile, writeFile, mkdir, rm, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { SkillApproval, ScanResult } from './skill.types';
import { SkillService } from './skill.service';
import { SkillScanService } from './skill-scan.service';
import { randomUUID } from 'node:crypto';

const DEFAULT_APPROVALS_DIR = homedir() + '/.aniclaw/skills';

@Injectable()
export class SkillApprovalService {
  private approvalsPath: string;
  private approvals: Map<string, SkillApproval> = new Map();
  private pendingDir: string;

  constructor(
    private readonly skillService: SkillService,
    private readonly scanService: SkillScanService,
  ) {
    this.approvalsPath = resolve(DEFAULT_APPROVALS_DIR, '.skill-approvals.json');
    this.pendingDir = resolve(DEFAULT_APPROVALS_DIR, '.pending');
  }

  async onModuleInit() {
    await this.loadApprovals();
  }

  private async loadApprovals() {
    try {
      const raw = await readFile(this.approvalsPath, 'utf-8');
      const records: SkillApproval[] = JSON.parse(raw);
      for (const r of records) {
        this.approvals.set(r.id, r);
      }
    } catch {
      // 文件不存在，使用空 Map
    }
  }

  private async saveApprovals() {
    const dir = resolve(this.approvalsPath, '..');
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const records = Array.from(this.approvals.values());
    const tmp = this.approvalsPath + '.tmp';
    await writeFile(tmp, JSON.stringify(records, null, 2), 'utf-8');
    await rename(tmp, this.approvalsPath);
  }

  private async getSkillsBaseDir(): Promise<string> {
    const dirs = await (this.skillService as any).getSkillsDirs() as string[];
    return dirs[0] || DEFAULT_APPROVALS_DIR;
  }

  async submit(params: {
    skillName: string;
    type: 'create' | 'update';
    content: string;
    oldContent?: string;
    patchDescription?: string;
    agentId?: string;
  }): Promise<{ approvalId: string; scanResult: ScanResult }> {
    const { skillName, type, content, oldContent, patchDescription, agentId } = params;

    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    let fmName = skillName;
    let fmDesc = '';
    if (fmMatch) {
      const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m);
      const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m);
      if (nameMatch) fmName = nameMatch[1].trim();
      if (descMatch) fmDesc = descMatch[1].trim();
    }

    const scanResult = this.scanService.scan(content, fmName, fmDesc);

    const baseDir = await this.getSkillsBaseDir();
    const pendingDir = resolve(baseDir, '.pending', skillName);
    if (!existsSync(pendingDir)) await mkdir(pendingDir, { recursive: true });

    const tmpFile = resolve(pendingDir, 'SKILL.md.tmp');
    const finalFile = resolve(pendingDir, 'SKILL.md');
    await writeFile(tmpFile, content, 'utf-8');
    await rename(tmpFile, finalFile);

    const approval: SkillApproval = {
      id: randomUUID(),
      skillName,
      type,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      contentSnapshot: content,
      oldContentSnapshot: oldContent,
      patchDescription,
      agentId,
    };

    this.approvals.set(approval.id, approval);
    await this.saveApprovals();

    return { approvalId: approval.id, scanResult };
  }

  async approve(approvalId: string): Promise<{ success: boolean; message: string }> {
    const approval = this.approvals.get(approvalId);
    if (!approval || approval.status !== 'pending') {
      return { success: false, message: '审批记录不存在或已处理' };
    }

    const baseDir = await this.getSkillsBaseDir();
    const pendingFile = resolve(baseDir, '.pending', approval.skillName, 'SKILL.md');
    const targetDir = resolve(baseDir, approval.skillName);

    try {
      if (!existsSync(targetDir)) await mkdir(targetDir, { recursive: true });
      const targetFile = resolve(targetDir, 'SKILL.md');
      const tmp = targetFile + '.tmp';
      const content = await readFile(pendingFile, 'utf-8');
      await writeFile(tmp, content, 'utf-8');
      await rename(tmp, targetFile);

      await rm(resolve(baseDir, '.pending', approval.skillName), { recursive: true, force: true });

      approval.status = 'approved';
      approval.reviewedAt = new Date().toISOString();
      await this.saveApprovals();

      await this.skillService.refresh();

      return { success: true, message: `Skill "${approval.skillName}" 已通过审批` };
    } catch (err) {
      return { success: false, message: `审批处理失败: ${(err as Error).message}` };
    }
  }

  async reject(approvalId: string): Promise<{ success: boolean; message: string }> {
    const approval = this.approvals.get(approvalId);
    if (!approval || approval.status !== 'pending') {
      return { success: false, message: '审批记录不存在或已处理' };
    }

    const baseDir = await this.getSkillsBaseDir();
    const pendingDir = resolve(baseDir, '.pending', approval.skillName);

    try {
      await rm(pendingDir, { recursive: true, force: true });
    } catch {
      // 文件可能已不存在
    }

    approval.status = 'rejected';
    approval.reviewedAt = new Date().toISOString();
    await this.saveApprovals();

    return { success: true, message: `Skill "${approval.skillName}" 已拒绝` };
  }

  listPending(): SkillApproval[] {
    return Array.from(this.approvals.values())
      .filter(a => a.status === 'pending')
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  getHistory(skillName: string): SkillApproval[] {
    return Array.from(this.approvals.values())
      .filter(a => a.skillName === skillName)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }
}
