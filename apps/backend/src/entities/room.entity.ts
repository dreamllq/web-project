import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

export enum RoomType {
  PRIVATE = 'private',
  GROUP = 'group',
  BROADCAST = 'broadcast',
}

@Entity('chat_rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({
    type: 'enum',
    enum: RoomType,
    default: RoomType.PRIVATE,
  })
  type: RoomType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string | null;

  @Index()
  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @Index()
  @Column({ name: 'last_message_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastMessageAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations - use lazy import to avoid circular dependency
  @ManyToOne(() => require('./user.entity').User)
  @JoinColumn({ name: 'owner_id' })
  owner: import('./user.entity').User | null;

  @OneToMany('RoomMember', (member: any) => member.room)
  members: any[];

  @OneToMany('Message', (message: any) => message.room)
  messages: any[];
}
