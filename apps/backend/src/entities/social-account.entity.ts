import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SocialProvider, SocialAccountStatus } from './social-provider.enum';

export { SocialProvider, SocialAccountStatus };

@Entity('social_accounts')
@Index(['provider', 'providerUserId'], { unique: true })
export class SocialAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: SocialProvider,
  })
  provider: SocialProvider;

  @Column({ name: 'provider_user_id', type: 'varchar', length: 100 })
  providerUserId: string;

  @Column({ name: 'provider_data', type: 'jsonb', nullable: true })
  providerData: Record<string, unknown> | null;

  @Column({ name: 'access_token', type: 'varchar', length: 500, nullable: true })
  accessToken: string | null;

  @Column({ name: 'refresh_token', type: 'varchar', length: 500, nullable: true })
  refreshToken: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamp', nullable: true })
  tokenExpiresAt: Date | null;

  @Column({
    type: 'enum',
    enum: SocialAccountStatus,
    default: SocialAccountStatus.LINKED,
  })
  status: SocialAccountStatus;

  @Column({ name: 'unbound_at', type: 'timestamp', nullable: true })
  unboundAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => require('./user.entity').User, (user: any) => user.socialAccounts)
  @JoinColumn({ name: 'user_id' })
  user: any;
}
