import { Injectable, Logger } from '@nestjs/common';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { Room } from '../../entities/room.entity';
import { RoomMember } from '../../entities/room-member.entity';

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

  constructor(private readonly websocketGateway: WebsocketGateway) {}

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
    this.websocketGateway.sendToUser(userId, 'roomCreated', payload);
    this.logger.log(`[roomCreated] userId=${userId}, roomId=${room.id}`);
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
    this.websocketGateway.sendToUser(userId, 'roomUpdated', payload);
    this.logger.log(`[roomUpdated] userId=${userId}, roomId=${room.id}, isHidden=${isHidden}`);
  }

  /**
   * Emit room deleted event to specific user
   */
  emitRoomDeleted(userId: string, roomId: string): void {
    this.websocketGateway.sendToUser(userId, 'roomDeleted', { roomId });
    this.logger.log(`[roomDeleted] userId=${userId}, roomId=${roomId}`);
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
    this.websocketGateway.sendToUser(userId, 'memberAdded', payload);
    this.logger.log(
      `[memberAdded] userId=${userId}, roomId=${roomId}, newMemberId=${member.userId ?? 'unknown'}`
    );
  }

  /**
   * Emit member removed event to specific user
   */
  emitMemberRemoved(userId: string, roomId: string): void {
    this.websocketGateway.sendToUser(userId, 'memberRemoved', { roomId });
    this.logger.log(`[memberRemoved] userId=${userId}, roomId=${roomId}`);
  }

  /**
   * Emit unread count updated event to specific user
   */
  emitUnreadUpdated(userId: string, roomId: string, count: number): void {
    this.websocketGateway.sendToUser(userId, 'unreadUpdated', { roomId, count });
    this.logger.log(`[unreadUpdated] userId=${userId}, roomId=${roomId}, count=${count}`);
  }
}
