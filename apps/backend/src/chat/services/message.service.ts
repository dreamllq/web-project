import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan, In, Not } from 'typeorm';
import { Message, MessageType } from '../../entities/message.entity';
import { MessageRead } from '../../entities/message-read.entity';
import { RoomMember } from '../../entities/room-member.entity';
import { Room } from '../../entities/room.entity';
import { RoomEventsService } from '../events/room-events.service';

export interface CreateMessageData {
  roomId: string;
  senderId: string;
  type?: MessageType;
  content: string;
  metadata?: Record<string, unknown> | null;
  replyToId?: string | null;
}

export interface EditMessageData {
  content: string;
}

export interface CursorPaginationOptions {
  cursor?: string;
  limit?: number;
  order?: 'ASC' | 'DESC';
}

export interface PaginatedMessagesResult {
  data: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ReadUserInfo {
  id: string;
  username: string;
  avatarUrl: string | null;
  readAt: Date;
}

/**
 * Message recall time limit in milliseconds (5 minutes)
 */
const MESSAGE_RECALL_LIMIT_MS = 5 * 60 * 1000;

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(MessageRead)
    private readonly messageReadRepo: Repository<MessageRead>,
    @InjectRepository(RoomMember)
    private readonly memberRepo: Repository<RoomMember>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    private readonly roomEventsService: RoomEventsService
  ) {}

  /**
   * Create a new message
   */
  async create(data: CreateMessageData): Promise<Message> {
    const message = this.messageRepo.create({
      roomId: data.roomId,
      senderId: data.senderId,
      type: data.type ?? MessageType.TEXT,
      content: data.content,
      metadata: data.metadata ?? null,
      replyToId: data.replyToId ?? null,
      editedAt: null,
      deletedAt: null,
    });

    const savedMessage = await this.messageRepo.save(message);

    this.logger.debug(
      `Message created: id=${savedMessage.id}, roomId=${savedMessage.roomId}, senderId=${savedMessage.senderId}`
    );

    // Handle hidden rooms and emit unread events to recipients
    await this.handleMessageEventsForRecipients(data.roomId, data.senderId);

    return savedMessage;
  }

  /**
   * Handle event emissions for message recipients
   * - Unhide rooms for hidden recipients
   * - Emit unreadUpdated events
   */
  private async handleMessageEventsForRecipients(roomId: string, senderId: string): Promise<void> {
    this.logger.log(
      `[handleMessageEventsForRecipients] START - roomId=${roomId}, senderId=${senderId}`
    );

    // Get the room
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
    });

    if (!room) {
      this.logger.warn(`[handleMessageEventsForRecipients] Room not found: ${roomId}`);
      return;
    }

    // Get all room members except the sender
    const recipients = await this.memberRepo.find({
      where: { roomId },
    });

    this.logger.log(`[handleMessageEventsForRecipients] Found ${recipients.length} total members`);

    const recipientMembers = recipients.filter((m) => m.userId !== senderId);
    this.logger.log(
      `[handleMessageEventsForRecipients] Processing ${recipientMembers.length} recipients (excluding sender)`
    );

    for (const recipient of recipientMembers) {
      this.logger.log(
        `[handleMessageEventsForRecipients] Checking recipient ${recipient.userId}: isHidden=${recipient.isHidden}`
      );

      // Check if room is hidden for this recipient
      if (recipient.isHidden) {
        this.logger.log(
          `[handleMessageEventsForRecipients] 🔄 Room is HIDDEN for user ${recipient.userId}, unhiding...`
        );

        // Unhide the room
        recipient.isHidden = false;
        await this.memberRepo.save(recipient);

        this.logger.log(
          `[handleMessageEventsForRecipients] ✅ Room unhidden, emitting roomUpdated to user ${recipient.userId}`
        );

        // Emit roomUpdated to recipient with isHidden=false
        this.roomEventsService.emitRoomUpdated(recipient.userId, room, false);
      }

      // Emit unreadUpdated to recipient
      const unreadCount = await this.getUnreadCount(roomId, recipient.userId, recipient.lastReadAt);
      this.logger.log(
        `[handleMessageEventsForRecipients] Emitting unreadUpdated to user ${recipient.userId}: count=${unreadCount}`
      );
      this.roomEventsService.emitUnreadUpdated(recipient.userId, roomId, unreadCount);
    }

    this.logger.log(`[handleMessageEventsForRecipients] END`);
  }

  /**
   * Find a single message by ID
   * @param id - Message ID
   * @param includeDeleted - Whether to include soft-deleted messages
   */
  async findById(id: string, includeDeleted = false): Promise<Message | null> {
    const query = this.messageRepo.createQueryBuilder('message').where('message.id = :id', { id });

    if (!includeDeleted) {
      query.andWhere('message.deletedAt IS NULL');
    }

    return query.getOne();
  }

  /**
   * Find a message by ID or throw NotFoundException
   */
  async findByIdOrFail(id: string, includeDeleted = false): Promise<Message> {
    const message = await this.findById(id, includeDeleted);
    if (!message) {
      throw new NotFoundException(`Message with ID "${id}" not found`);
    }
    return message;
  }

  /**
   * Find messages by room ID with cursor-based pagination
   * Messages are ordered by createdAt (default: DESC for newest first)
   */
  async findByRoom(
    roomId: string,
    options: CursorPaginationOptions = {}
  ): Promise<PaginatedMessagesResult> {
    const { cursor, limit = 20, order = 'DESC' } = options;
    const take = Math.min(limit, 100);

    const query = this.messageRepo
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.roomId = :roomId', { roomId })
      .andWhere('message.deletedAt IS NULL');

    // Apply cursor filter
    if (cursor) {
      const cursorMessage = await this.findById(cursor, true);
      if (cursorMessage) {
        if (order === 'DESC') {
          // Get messages older than cursor
          query.andWhere('message.createdAt < :cursorCreatedAt', {
            cursorCreatedAt: cursorMessage.createdAt,
          });
        } else {
          // Get messages newer than cursor
          query.andWhere('message.createdAt > :cursorCreatedAt', {
            cursorCreatedAt: cursorMessage.createdAt,
          });
        }
      }
    }

    // Order by createdAt
    query.orderBy('message.createdAt', order).take(take + 1);

    const messages = await query.getMany();

    // Determine if there are more messages
    const hasMore = messages.length > take;
    const data = hasMore ? messages.slice(0, take) : messages;

    // Calculate next cursor
    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const lastMessage = data[data.length - 1];
      nextCursor = lastMessage.id;
    }

    return {
      data,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Edit a message (updates content and editedAt timestamp)
   * Only the message sender can edit
   */
  async edit(messageId: string, userId: string, data: EditMessageData): Promise<Message> {
    const message = await this.findByIdOrFail(messageId);

    // Check ownership
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    // Check if message is deleted
    if (message.deletedAt) {
      throw new BadRequestException('Cannot edit a deleted message');
    }

    // Update content and editedAt
    message.content = data.content;
    message.editedAt = new Date();

    const updatedMessage = await this.messageRepo.save(message);

    this.logger.debug(`Message edited: id=${messageId}, userId=${userId}`);

    return updatedMessage;
  }

  /**
   * Soft delete a message (set deletedAt timestamp)
   * Only the message sender can delete
   * Time limit: 5 minutes from creation
   */
  async softDelete(messageId: string, userId: string): Promise<Message> {
    const message = await this.findByIdOrFail(messageId);

    // Check ownership
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    // Check if already deleted
    if (message.deletedAt) {
      throw new BadRequestException('Message is already deleted');
    }

    // Check time limit (5 minutes)
    const now = new Date();
    const messageCreatedAt = new Date(message.createdAt);
    const timeDiff = now.getTime() - messageCreatedAt.getTime();

    if (timeDiff > MESSAGE_RECALL_LIMIT_MS) {
      throw new ForbiddenException('Message can only be recalled within 5 minutes of sending');
    }

    // Soft delete
    message.deletedAt = now;
    const deletedMessage = await this.messageRepo.save(message);

    this.logger.debug(`Message soft deleted: id=${messageId}, userId=${userId}`);

    return deletedMessage;
  }

  /**
   * Mark a message as read by a user
   * Creates a MessageRead record if not already exists
   */
  async markAsRead(messageId: string, userId: string): Promise<MessageRead> {
    // Verify message exists and is not deleted
    const message = await this.findByIdOrFail(messageId);

    if (message.deletedAt) {
      throw new BadRequestException('Cannot mark a deleted message as read');
    }

    // Check if already marked as read
    const existingRead = await this.messageReadRepo.findOne({
      where: { messageId, userId },
    });

    if (existingRead) {
      return existingRead;
    }

    // Create new read record
    const messageRead = this.messageReadRepo.create({
      messageId,
      userId,
    });

    const savedRead = await this.messageReadRepo.save(messageRead);

    this.logger.debug(`Message marked as read: messageId=${messageId}, userId=${userId}`);

    return savedRead;
  }

  /**
   * Mark multiple messages as read by a user
   * Batch operation for efficiency
   */
  async markMultipleAsRead(messageIds: string[], userId: string): Promise<number> {
    if (messageIds.length === 0) {
      return 0;
    }

    // Find messages that exist and are not deleted
    const messages = await this.messageRepo.find({
      where: {
        id: In(messageIds),
        deletedAt: IsNull(),
      },
      select: ['id'],
    });

    const validMessageIds = messages.map((m) => m.id);

    if (validMessageIds.length === 0) {
      return 0;
    }

    // Find already read message IDs
    const existingReads = await this.messageReadRepo.find({
      where: {
        messageId: In(validMessageIds),
        userId,
      },
      select: ['messageId'],
    });

    const alreadyReadIds = new Set(existingReads.map((r) => r.messageId));

    // Filter out already read messages
    const newReadIds = validMessageIds.filter((id) => !alreadyReadIds.has(id));

    if (newReadIds.length === 0) {
      return 0;
    }

    // Batch insert new read records
    const readRecords = newReadIds.map((messageId) =>
      this.messageReadRepo.create({
        messageId,
        userId,
      })
    );

    await this.messageReadRepo.save(readRecords);

    this.logger.debug(`Batch marked ${newReadIds.length} messages as read for user ${userId}`);

    return newReadIds.length;
  }

  /**
   * Get all users who have read a message
   * Returns user info with read timestamp
   */
  async getReadUsers(messageId: string): Promise<ReadUserInfo[]> {
    // Verify message exists
    await this.findByIdOrFail(messageId);

    const readRecords = await this.messageReadRepo
      .createQueryBuilder('mr')
      .innerJoinAndSelect('mr.user', 'user')
      .where('mr.messageId = :messageId', { messageId })
      .orderBy('mr.readAt', 'ASC')
      .getMany();

    return readRecords.map((record) => ({
      id: record.user.id,
      username: record.user.username,
      avatarUrl: record.user.avatarUrl,
      readAt: record.readAt,
    }));
  }

  /**
   * Get unread message count for a user in a room
   * Counts messages after the user's last read timestamp
   */
  async getUnreadCount(roomId: string, userId: string, lastReadAt: Date): Promise<number> {
    return this.messageRepo.count({
      where: {
        roomId,
        senderId: Not(userId), // Don't count own messages
        createdAt: MoreThan(lastReadAt),
        deletedAt: IsNull(),
      },
    });
  }

  /**
   * Get the latest message in a room
   */
  async getLatestMessage(roomId: string): Promise<Message | null> {
    return this.messageRepo.findOne({
      where: {
        roomId,
        deletedAt: IsNull(),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Count total messages in a room (excluding deleted)
   */
  async countByRoom(roomId: string): Promise<number> {
    return this.messageRepo.count({
      where: {
        roomId,
        deletedAt: IsNull(),
      },
    });
  }
}
