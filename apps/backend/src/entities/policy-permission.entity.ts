import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import type { Policy } from './policy.entity';
import type { Permission } from './permission.entity';

@Entity('policy_permissions')
@Unique(['policyId', 'permissionId'])
export class PolicyPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'policy_id', type: 'uuid' })
  policyId: string;

  @Index()
  @Column({ name: 'permission_id', type: 'uuid' })
  permissionId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations - use lazy imports to avoid circular dependencies
  @ManyToOne(() => require('./policy.entity').Policy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;

  @ManyToOne(() => require('./permission.entity').Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;
}
