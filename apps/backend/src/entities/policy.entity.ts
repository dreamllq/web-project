import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import type { PolicyAttribute } from './policy-attribute.entity';

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
  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  resource: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  conditions: Record<string, unknown> | null;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  // Use lazy import to avoid circular dependency
  @OneToMany(
    () => require('./policy-attribute.entity').PolicyAttribute,
    (policyAttribute: PolicyAttribute) => policyAttribute.policy
  )
  policyAttributes: PolicyAttribute[];
}
