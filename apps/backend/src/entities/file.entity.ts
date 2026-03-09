import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum StorageProvider {
  LOCAL = 'local',
  S3 = 's3',
  MINIO = 'minio',
}

@Entity('files')
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Index()
  @Column({ name: 'stored_name', type: 'varchar', length: 255, unique: true })
  storedName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
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

  @Column({ name: 'storage_path', type: 'varchar', length: 500 })
  storagePath: string;

  @Column({ type: 'varchar', length: 1000 })
  url: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne('User')
  @JoinColumn({ name: 'user_id' })
  user: any;
}
