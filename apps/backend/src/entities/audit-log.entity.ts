import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Index()
  @Column({ name: 'resource_type', type: 'varchar', length: 50 })
  resourceType: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 100, nullable: true })
  resourceId: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45 })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ name: 'request_data', type: 'jsonb', nullable: true })
  requestData: Record<string, unknown> | null;

  @Column({ name: 'response_status', type: 'int' })
  responseStatus: number;

  @Column({ name: 'error_message', type: 'varchar', length: 1000, nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
