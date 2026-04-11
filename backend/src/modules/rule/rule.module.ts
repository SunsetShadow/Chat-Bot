import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuleEntity } from '../../common/entities/rule.entity';
import { RuleController } from './rule.controller';
import { RuleService } from './rule.service';

@Module({
  imports: [TypeOrmModule.forFeature([RuleEntity])],
  controllers: [RuleController],
  providers: [RuleService],
  exports: [RuleService],
})
export class RuleModule {}
