import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  EMOJI = 'emoji',
  SYSTEM = 'system',
}

@Entity('chat_messages')
@Index(['roomId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @Index()
  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Index()
  @Column({ name: 'reply_to_id', type: 'uuid', nullable: true })
  replyToId: string | null;

  @Column({ name: 'edited_at', type: 'timestamp', nullable: true })
  editedAt: Date | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations - use lazy import to avoid circular dependency
  @ManyToOne(() => require('./room.entity').Room, (room: any) => room.messages)
  @JoinColumn({ name: 'room_id' })
  room: import('./room.entity').Room;

  @ManyToOne(() => require('./user.entity').User)
  @JoinColumn({ name: 'sender_id' })
  sender: import('./user.entity').User;

  @ManyToOne(() => require('./message.entity').Message)
  @JoinColumn({ name: 'reply_to_id' })
  replyTo: import('./message.entity').Message | null;

  @OneToMany('MessageRead', (messageRead: any) => messageRead.message)
  reads: any[];
}
