import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { RuleEntity, RuleCategory, ConflictStrategy, RuleScope } from '../../common/entities/rule.entity';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';

const BUILTIN_RULES: Partial<RuleEntity>[] = [
  {
    id: 'builtin-concise',
    name: '简洁回复',
    content: '请保持回答简洁明了，避免冗长的解释。',
    enabled: true,
    category: RuleCategory.FORMAT,
    priority: 5,
    conflict_strategy: ConflictStrategy.MERGE,
    is_builtin: true,
    scope: RuleScope.GENERAL,
  },
  {
    id: 'builtin-detailed',
    name: '详细解释',
    content: '请提供详细的解释和示例，帮助用户深入理解。',
    enabled: false,
    category: RuleCategory.FORMAT,
    priority: 5,
    conflict_strategy: ConflictStrategy.MERGE,
    is_builtin: true,
    scope: RuleScope.GENERAL,
  },
  {
    id: 'builtin-polite',
    name: '礼貌用语',
    content: '使用礼貌、专业的语言与用户交流。',
    enabled: true,
    category: RuleCategory.BEHAVIOR,
    priority: 6,
    conflict_strategy: ConflictStrategy.MERGE,
    is_builtin: true,
    scope: RuleScope.GENERAL,
  },
  {
    id: 'builtin-no-emoji',
    name: '不用表情',
    content: '不要使用表情符号，保持正式的回复风格。',
    enabled: false,
    category: RuleCategory.CONSTRAINT,
    priority: 7,
    conflict_strategy: ConflictStrategy.OVERRIDE,
    is_builtin: true,
    scope: RuleScope.GENERAL,
  },
  {
    id: 'builtin-code-highlight',
    name: '代码高亮',
    content: '代码块请使用正确的语法高亮标记语言类型。',
    enabled: true,
    category: RuleCategory.FORMAT,
    priority: 5,
    conflict_strategy: ConflictStrategy.MERGE,
    is_builtin: true,
    scope: RuleScope.GLOBAL,
  },
];

@Injectable()
export class RuleService implements OnModuleInit {
  constructor(
    @InjectRepository(RuleEntity)
    private ruleRepo: Repository<RuleEntity>,
  ) {}

  async onModuleInit() {
    for (const rule of BUILTIN_RULES) {
      const exists = await this.ruleRepo.existsBy({ id: rule.id });
      if (!exists) {
        await this.ruleRepo.save(this.ruleRepo.create(rule));
      } else {
        const existing = await this.ruleRepo.findOneBy({ id: rule.id });
        if (existing && rule.scope && existing.scope !== rule.scope) {
          existing.scope = rule.scope;
          await this.ruleRepo.save(existing);
        }
      }
    }
  }

  async findAll(enabledOnly = false): Promise<RuleEntity[]> {
    if (enabledOnly) {
      return this.ruleRepo.find({ where: { enabled: true } });
    }
    return this.ruleRepo.find();
  }

  async findOne(id: string): Promise<RuleEntity> {
    const rule = await this.ruleRepo.findOneBy({ id });
    if (!rule) {
      throw new NotFoundException(`Rule ${id} not found`);
    }
    return rule;
  }

  async create(dto: CreateRuleDto): Promise<RuleEntity> {
    const rule = this.ruleRepo.create({
      id: randomUUID(),
      name: dto.name,
      content: dto.content,
      enabled: true,
      category: dto.category || RuleCategory.FORMAT,
      priority: 5,
      conflict_strategy: ConflictStrategy.MERGE,
      is_builtin: false,
      scope: dto.scope || RuleScope.GENERAL,
    });
    return this.ruleRepo.save(rule);
  }

  async update(id: string, dto: UpdateRuleDto): Promise<RuleEntity> {
    const rule = await this.findOne(id);
    Object.assign(rule, dto);
    return this.ruleRepo.save(rule);
  }

  async remove(id: string): Promise<void> {
    const rule = await this.findOne(id);
    if (rule.is_builtin) {
      throw new BadRequestException('Cannot delete built-in rules');
    }
    await this.ruleRepo.delete(id);
  }

  async getEnabledRules(): Promise<RuleEntity[]> {
    const rules = await this.findAll(true);
    return rules.sort((a, b) => b.priority - a.priority);
  }

  async getGlobalRules(): Promise<RuleEntity[]> {
    return this.ruleRepo.find({
      where: { enabled: true, scope: RuleScope.GLOBAL },
    });
  }

  async getRulesByIds(ids: string[]): Promise<RuleEntity[]> {
    if (!ids || ids.length === 0) return [];
    return this.ruleRepo.find({
      where: ids.map((id) => ({ id })),
    });
  }
}
