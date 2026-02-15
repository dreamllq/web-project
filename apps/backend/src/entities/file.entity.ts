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

export enum StorageProvider {
  LOCAL = 'local',
  SUPABASE = 'supabase',
  R2 = 'r2',
}

@Entity('files')
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ length: 255 })
  filename: string;

  @Index()
  @Column({ name: 'stored_name', length: 255, unique: true })
  storedName: string;

  @Column({ name: 'mime_type', length: 100 })
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({
    name: 'storage_provider',
    type: 'enum',
    enum: StorageProvider,
    default: StorageProvider.LOCAL,
  })
  storageProvider: StorageProvider;

  @Column({ name: 'storage_path', length: 500 })
  storagePath: string;

  @Column({ length: 1000 })
  url: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.files)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
