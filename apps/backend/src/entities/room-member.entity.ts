import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum RoomMemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Entity('chat_room_members')
@Index(['roomId', 'userId'], { unique: true })
export class RoomMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: RoomMemberRole,
    default: RoomMemberRole.MEMBER,
  })
  role: RoomMemberRole;

  @Column({ name: 'last_read_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastReadAt: Date;

  @Column({ type: 'boolean', default: false })
  muted: boolean;

  @Column({ name: 'is_hidden', type: 'boolean', default: false })
  isHidden: boolean;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  // Relations - use lazy import to avoid circular dependency
  @ManyToOne(() => require('./room.entity').Room, (room: any) => room.members)
  @JoinColumn({ name: 'room_id' })
  room: import('./room.entity').Room;

  @ManyToOne(() => require('./user.entity').User)
  @JoinColumn({ name: 'user_id' })
  user: import('./user.entity').User;
}
