import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Policy } from '../entities/policy.entity';
import { PolicyAttribute } from '../entities/policy-attribute.entity';
import { Attribute } from '../entities/attribute.entity';
import { PolicyService } from './policy.service';
import { PolicyEvaluatorService } from './policy-evaluator.service';
import { PolicyController } from './policy.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Policy, PolicyAttribute, Attribute])],
  controllers: [PolicyController],
  providers: [PolicyService, PolicyEvaluatorService],
  exports: [PolicyService, PolicyEvaluatorService],
})
export class PolicyModule {}
