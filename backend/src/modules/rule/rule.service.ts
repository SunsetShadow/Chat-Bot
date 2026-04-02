import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { generateId } from '../../common/types';
import { CreateRuleDto, RuleCategory, ConflictStrategy } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';

export interface Rule {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
  category: RuleCategory;
  priority: number;
  conflict_strategy: ConflictStrategy;
  is_builtin: boolean;
}

const BUILTIN_RULES: Rule[] = [
  {
    id: 'builtin-concise',
    name: '简洁回复',
    content: '请保持回答简洁明了，避免冗长的解释。',
    enabled: true,
    category: RuleCategory.FORMAT,
    priority: 5,
    conflict_strategy: ConflictStrategy.MERGE,
    is_builtin: true,
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
  },
];

@Injectable()
export class RuleService implements OnModuleInit {
  private rules = new Map<string, Rule>();

  onModuleInit() {
    for (const rule of BUILTIN_RULES) {
      this.rules.set(rule.id, { ...rule });
    }
  }

  findAll(enabledOnly = false): Rule[] {
    const all = Array.from(this.rules.values());
    if (enabledOnly) {
      return all.filter((r) => r.enabled);
    }
    return all;
  }

  findOne(id: string): Rule {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new NotFoundException(`Rule ${id} not found`);
    }
    return rule;
  }

  create(dto: CreateRuleDto): Rule {
    const rule: Rule = {
      id: generateId(),
      name: dto.name,
      content: dto.content,
      enabled: true,
      category: dto.category || RuleCategory.FORMAT,
      priority: 5,
      conflict_strategy: ConflictStrategy.MERGE,
      is_builtin: false,
    };
    this.rules.set(rule.id, rule);
    return rule;
  }

  update(id: string, dto: UpdateRuleDto): Rule {
    const rule = this.findOne(id);
    Object.assign(rule, dto);
    this.rules.set(id, rule);
    return rule;
  }

  remove(id: string): void {
    const rule = this.findOne(id);
    if (rule.is_builtin) {
      throw new BadRequestException('Cannot delete built-in rules');
    }
    this.rules.delete(id);
  }

  getEnabledRules(): Rule[] {
    return this.findAll(true).sort((a, b) => b.priority - a.priority);
  }
}
