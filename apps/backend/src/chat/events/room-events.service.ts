import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ChatGateway } from '../chat.gateway';
import { Room } from '../../entities/room.entity';
import { RoomMember } from '../../entities/room-member.entity';

/**
 * User-specific room name prefix for Socket.IO rooms
 * Users automatically join 'user:{userId}' room on connection
 */
export const USER_ROOM_PREFIX = 'user:';

export interface RoomUpdatedPayload {
  id: string;
  name?: string | null;
  type?: string;
  avatar?: string | null;
  ownerId?: string | null;
  lastMessageAt?: Date;
  isHidden?: boolean;
}

@Injectable()
export class RoomEventsService {
  private readonly logger = new Logger(RoomEventsService.name);

  constructor(
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway
  ) {}

  /**
   * Get the user-specific room name for a user ID
   */
  static getUserRoom(userId: string): string {
    return `${USER_ROOM_PREFIX}${userId}`;
  }

  /**
   * Emit room created event to specific user
   */
  emitRoomCreated(userId: string, room: Partial<Room>): void {
    const payload = {
      id: room.id,
      name: room.name,
      type: room.type,
      avatar: room.avatar,
      ownerId: room.ownerId,
      lastMessageAt: room.lastMessageAt,
    };
    const userRoom = RoomEventsService.getUserRoom(userId);
    this.chatGateway.server.to(userRoom).emit('roomCreated', payload);
    this.logger.log(`[roomCreated] userId=${userId}, roomId=${room.id}, room=${userRoom}`);
  }

  /**
   * Emit room updated event to specific user
   */
  emitRoomUpdated(userId: string, room: Partial<Room>, isHidden = false): void {
    const payload: RoomUpdatedPayload = {
      id: room.id!,
      name: room.name,
      type: room.type,
      avatar: room.avatar,
      ownerId: room.ownerId,
      lastMessageAt: room.lastMessageAt,
      isHidden,
    };
    const userRoom = RoomEventsService.getUserRoom(userId);
    this.chatGateway.server.to(userRoom).emit('roomUpdated', payload);
    this.logger.log(
      `[roomUpdated] userId=${userId}, roomId=${room.id}, isHidden=${isHidden}, room=${userRoom}`
    );
  }

  /**
   * Emit room deleted event to specific user
   */
  emitRoomDeleted(userId: string, roomId: string): void {
    const userRoom = RoomEventsService.getUserRoom(userId);
    this.chatGateway.server.to(userRoom).emit('roomDeleted', { roomId });
    this.logger.log(`[roomDeleted] userId=${userId}, roomId=${roomId}, room=${userRoom}`);
  }

  /**
   * Emit member added event (broadcast to room - will be handled by room members)
   * Note: Caller should iterate over room members and call this for each
   */
  emitMemberAdded(userId: string, roomId: string, member: Partial<RoomMember>): void {
    const payload = {
      roomId,
      member: {
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
      },
    };
    const userRoom = RoomEventsService.getUserRoom(userId);
    this.chatGateway.server.to(userRoom).emit('memberAdded', payload);
    this.logger.log(
      `[memberAdded] userId=${userId}, roomId=${roomId}, newMemberId=${member.userId ?? 'unknown'}, room=${userRoom}`
    );
  }

  /**
   * Emit member removed event to specific user
   */
  emitMemberRemoved(userId: string, roomId: string): void {
    const userRoom = RoomEventsService.getUserRoom(userId);
    this.chatGateway.server.to(userRoom).emit('memberRemoved', { roomId });
    this.logger.log(`[memberRemoved] userId=${userId}, roomId=${roomId}, room=${userRoom}`);
  }

  /**
   * Emit unread count updated event to specific user
   */
  emitUnreadUpdated(userId: string, roomId: string, count: number): void {
    const userRoom = RoomEventsService.getUserRoom(userId);
    this.chatGateway.server.to(userRoom).emit('unreadUpdated', { roomId, count });
    this.logger.log(
      `[unreadUpdated] userId=${userId}, roomId=${roomId}, count=${count}, room=${userRoom}`
    );
  }
}
