import { Entity, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('user_roles')
export class UserRole {
  @Index()
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
