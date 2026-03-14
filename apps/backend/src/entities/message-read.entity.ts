import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('chat_message_reads')
@Index(['messageId', 'userId'], { unique: true })
export class MessageRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @CreateDateColumn({ name: 'read_at' })
  readAt: Date;

  // Relations - use lazy import to avoid circular dependency
  @ManyToOne(() => require('./message.entity').Message, (message: any) => message.reads)
  @JoinColumn({ name: 'message_id' })
  message: import('./message.entity').Message;

  @ManyToOne(() => require('./user.entity').User)
  @JoinColumn({ name: 'user_id' })
  user: import('./user.entity').User;
}
