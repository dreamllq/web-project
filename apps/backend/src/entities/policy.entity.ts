import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { PolicyAttribute } from './policy-attribute.entity';
import type { PolicySubject, ConditionExpression } from '../policy/types/policy.types';

export enum PolicyEffect {
  ALLOW = 'allow',
  DENY = 'deny',
}

@Entity('policies')
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: PolicyEffect,
    default: PolicyEffect.ALLOW,
  })
  effect: PolicyEffect;

  @Index()
  @Column({ type: 'jsonb' })
  subject: PolicySubject;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  resource: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  conditions: ConditionExpression | null;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => PolicyAttribute, (policyAttribute) => policyAttribute.policy)
  policyAttributes: PolicyAttribute[];
}
