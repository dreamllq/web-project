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
import { OAuthClient } from './oauth-client.entity';

@Entity('oauth_tokens')
export class OAuthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Index({ unique: true })
  @Column({ name: 'access_token', type: 'varchar', length: 255 })
  accessToken: string;

  @Column({ name: 'refresh_token', type: 'varchar', length: 255, nullable: true, unique: true })
  refreshToken: string | null;

  @Column({ type: 'jsonb' })
  scopes: string[];

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => OAuthClient, (client) => client.tokens)
  @JoinColumn({ name: 'client_id' })
  client: OAuthClient;

  @ManyToOne(() => User, (user) => user.oauthTokens)
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
