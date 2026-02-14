import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { OAuthToken } from './oauth-token.entity';

@Entity('oauth_clients')
export class OAuthClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'client_id', type: 'varchar', length: 100 })
  clientId: string;

  @Column({ name: 'client_secret', type: 'varchar', length: 255 })
  clientSecret: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'redirect_uris', type: 'jsonb' })
  redirectUris: string[];

  @Column({ name: 'allowed_scopes', type: 'jsonb' })
  allowedScopes: string[];

  @Column({ name: 'is_confidential', type: 'boolean', default: true })
  isConfidential: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => OAuthToken, (token) => token.client)
  tokens: OAuthToken[];
}
