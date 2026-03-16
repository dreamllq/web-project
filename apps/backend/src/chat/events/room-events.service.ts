import { Injectable, Logger } from '@nestjs/common';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { Room } from '../../entities/room.entity';
import { RoomMember } from '../../entities/room-member.entity';

@Injectable()
export class RoomEventsService {
  private readonly logger = new Logger(RoomEventsService.name);

  constructor(private readonly websocketGateway: WebsocketGateway) {}

  /**
   * Emit room created event to specific user
   */
  emitRoomCreated(userId: string, room: Partial<Room>): void {
    this.websocketGateway.sendToUser(userId, 'roomCreated', room);
    this.logger.debug(`Emitted roomCreated to user ${userId}, roomId: ${room.id}`);
  }

  /**
   * Emit room updated event to specific user
   */
  emitRoomUpdated(userId: string, room: Partial<Room>): void {
    this.websocketGateway.sendToUser(userId, 'roomUpdated', room);
    this.logger.debug(`Emitted roomUpdated to user ${userId}, roomId: ${room.id}`);
  }

  /**
   * Emit room deleted event to specific user
   */
  emitRoomDeleted(userId: string, roomId: string): void {
    this.websocketGateway.sendToUser(userId, 'roomDeleted', { roomId });
    this.logger.debug(`Emitted roomDeleted to user ${userId}, roomId: ${roomId}`);
  }

  /**
   * Emit member added event (broadcast to room - will be handled by room members)
   * Note: Caller should iterate over room members and call this for each
   */
  emitMemberAdded(userId: string, roomId: string, member: Partial<RoomMember>): void {
    this.websocketGateway.sendToUser(userId, 'memberAdded', { roomId, member });
    this.logger.debug(`Emitted memberAdded to user ${userId}, roomId: ${roomId}`);
  }

  /**
   * Emit member removed event to specific user
   */
  emitMemberRemoved(userId: string, roomId: string): void {
    this.websocketGateway.sendToUser(userId, 'memberRemoved', { roomId });
    this.logger.debug(`Emitted memberRemoved to user ${userId}, roomId: ${roomId}`);
  }

  /**
   * Emit unread count updated event to specific user
   */
  emitUnreadUpdated(userId: string, roomId: string, count: number): void {
    this.websocketGateway.sendToUser(userId, 'unreadUpdated', { roomId, count });
    this.logger.debug(
      `Emitted unreadUpdated to user ${userId}, roomId: ${roomId}, count: ${count}`
    );
  }
}
