import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Version,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { RoomService, CreateRoomData, UserRoomResult } from './services/room.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { Message } from '../entities/message.entity';
import { Room, RoomType } from '../entities/room.entity';
import { RoomMember } from '../entities/room-member.entity';
import { CreateRoomDto, AddMemberDto, EditMessageDto, MessageQueryDto } from './dto';

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly roomService: RoomService
  ) {}

  /**
   * Create a new room
   * POST /api/v1/chat/rooms
   */
  @Post('rooms')
  @Version('1')
  @ApiOperation({ summary: 'Create a new chat room' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid room data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createRoom(@CurrentUser() user: User, @Body() dto: CreateRoomDto): Promise<RoomResponse> {
    const createData: CreateRoomData = {
      type: dto.type,
      name: dto.name,
      avatar: dto.avatar,
      ownerId: dto.type === RoomType.GROUP ? user.id : undefined,
      memberIds: dto.memberIds,
    };

    // For private rooms, ensure current user is included in members
    if (dto.type === RoomType.PRIVATE) {
      if (!dto.memberIds || dto.memberIds.length !== 1) {
        createData.memberIds = [user.id, ...(dto.memberIds ?? [])];
      } else {
        createData.memberIds = [user.id, dto.memberIds[0]];
      }
    } else if (dto.type === RoomType.GROUP) {
      // For group rooms, add owner to members if not already included
      if (!dto.memberIds || !dto.memberIds.includes(user.id)) {
        createData.memberIds = [user.id, ...(dto.memberIds ?? [])];
      }
    }

    const room = await this.roomService.create(createData);
    return this.toRoomResponse(room);
  }

  /**
   * Get my rooms list
   * GET /api/v1/chat/rooms
   */
  @Get('rooms')
  @Version('1')
  @ApiOperation({ summary: 'Get list of rooms for current user' })
  @ApiResponse({ status: 200, description: 'List of rooms' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyRooms(@CurrentUser() user: User): Promise<RoomListResponse> {
    const userRooms = await this.roomService.findByUser(user.id);

    // Get unread counts for each room
    const roomsWithUnread = await Promise.all(
      userRooms.map(async (roomData) => {
        const unreadCount = await this.chatService.getUnreadCount(roomData.room.id, user.id);
        return {
          ...roomData,
          unreadCount,
        };
      })
    );

    return {
      data: roomsWithUnread.map((roomData) => this.toUserRoomResponse(roomData)),
    };
  }

  /**
   * Get room messages with pagination
   * GET /api/v1/chat/rooms/:id/messages
   */
  @Get('rooms/:id/messages')
  @Version('1')
  @ApiOperation({ summary: 'Get messages for a room with cursor pagination' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'List of messages with pagination info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a member of this room' })
  async getRoomMessages(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) roomId: string,
    @Query() query: MessageQueryDto
  ): Promise<MessageListResponse> {
    const result = await this.chatService.getRoomMessages(roomId, user.id, {
      cursor: query.cursor,
      limit: query.limit,
      order: query.order,
    });

    return {
      data: result.data.map((message) => this.toMessageResponse(message)),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  /**
   * Edit a message
   * PATCH /api/v1/chat/messages/:id
   */
  @Patch('messages/:id')
  @Version('1')
  @ApiOperation({ summary: 'Edit a message' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message edited successfully' })
  @ApiResponse({ status: 400, description: 'Message not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not authorized to edit this message' })
  async editMessage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) messageId: string,
    @Body() dto: EditMessageDto
  ): Promise<MessageResponse> {
    const message = await this.chatService.editMessage(messageId, user.id, {
      content: dto.content,
    });

    return this.toMessageResponse(message);
  }

  /**
   * Recall (soft delete) a message
   * DELETE /api/v1/chat/messages/:id
   */
  @Delete('messages/:id')
  @Version('1')
  @ApiOperation({ summary: 'Recall a message (soft delete)' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message recalled successfully' })
  @ApiResponse({ status: 400, description: 'Message not found or already recalled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Can only recall own messages within 5 minutes' })
  async recallMessage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) messageId: string
  ): Promise<MessageResponse> {
    const message = await this.chatService.recallMessage(messageId, user.id);
    return this.toMessageResponse(message);
  }

  /**
   * Add member to a room
   * POST /api/v1/chat/rooms/:id/members
   */
  @Post('rooms/:id/members')
  @Version('1')
  @ApiOperation({ summary: 'Add a member to a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid room or user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not authorized to add members' })
  @ApiResponse({ status: 409, description: 'User is already a member' })
  async addMember(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) roomId: string,
    @Body() dto: AddMemberDto
  ): Promise<MemberResponse> {
    const member = await this.roomService.addMember(roomId, dto.userId, user.id);
    return this.toMemberResponse(member);
  }

  // ========== Private Helper Methods ==========

  private toRoomResponse(room: Room): RoomResponse {
    return {
      id: room.id,
      type: room.type,
      name: room.name,
      avatar: room.avatar,
      ownerId: room.ownerId,
      lastMessageAt: room.lastMessageAt,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  private toUserRoomResponse(roomData: UserRoomResult & { unreadCount: number }): UserRoomResponse {
    return {
      room: this.toRoomResponse(roomData.room),
      role: roomData.role,
      unreadCount: roomData.unreadCount,
      lastReadAt: roomData.lastReadAt,
    };
  }

  private toMessageResponse(message: Message): MessageResponse {
    return {
      id: message.id,
      roomId: message.roomId,
      senderId: message.senderId,
      senderName: message.sender?.username,
      type: message.type,
      content: message.content,
      metadata: message.metadata,
      replyToId: message.replyToId,
      editedAt: message.editedAt,
      deletedAt: message.deletedAt,
      createdAt: message.createdAt,
    };
  }

  private toMemberResponse(member: RoomMember): MemberResponse {
    return {
      id: member.id,
      roomId: member.roomId,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      lastReadAt: member.lastReadAt,
    };
  }
}

// ========== Response Interfaces ==========

export interface RoomResponse {
  id: string;
  type: RoomType;
  name: string | null;
  avatar: string | null;
  ownerId: string | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRoomResponse {
  room: RoomResponse;
  role: string;
  unreadCount: number;
  lastReadAt: Date;
}

export interface RoomListResponse {
  data: UserRoomResponse[];
}

export interface MessageResponse {
  id: string;
  roomId: string;
  senderId: string;
  senderName?: string;
  type: string;
  content: string | null;
  metadata: Record<string, unknown> | null;
  replyToId: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface MessageListResponse {
  data: MessageResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface MemberResponse {
  id: string;
  roomId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  lastReadAt: Date;
}
