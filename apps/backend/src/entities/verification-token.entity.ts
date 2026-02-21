import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';

export enum VerificationTokenType {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
}

@Entity('verification_tokens')
export class VerificationToken {
  @PrimaryColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  token: string;

  @Column({
    type: 'enum',
    enum: VerificationTokenType,
    name: 'type',
  })
  type: VerificationTokenType;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamp', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relation to User - use lazy import to avoid circular dependency
  // The () => User pattern tells TypeORM to resolve the relation lazily
  @ManyToOne(() => require('./user.entity').User, (user: any) => user.verificationTokens)
  user: any;
}
