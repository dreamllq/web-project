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
  ForbiddenException,
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
import {
  CreateRoomDto,
  AddMemberDto,
  EditMessageDto,
  MessageQueryDto,
  UpdateMemberSettingsDto,
} from './dto';

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
      data: await Promise.all(
        roomsWithUnread.map((roomData) => this.toUserRoomResponse(roomData, user.id))
      ),
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

  /**
   * Update current user's member settings (e.g., hide/show room)
   * PATCH /api/v1/chat/rooms/:id/members/me
   */
  @Patch('rooms/:id/members/me')
  @Version('1')
  @ApiOperation({ summary: "Update current user's member settings for a room" })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Member settings updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Member not found in this room' })
  async updateMemberSettings(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) roomId: string,
    @Body() dto: UpdateMemberSettingsDto
  ): Promise<MemberResponse> {
    const member = await this.roomService.updateMemberSettings(roomId, user.id, {
      isHidden: dto.isHidden,
    });
    return this.toMemberResponse(member);
  }

  /**
   * Leave a room
   * DELETE /api/v1/chat/rooms/:id/members/me
   */
  @Delete('rooms/:id/members/me')
  @Version('1')
  @ApiOperation({ summary: 'Leave a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Left room successfully' })
  @ApiResponse({ status: 403, description: 'Cannot leave private rooms' })
  async leaveRoom(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) roomId: string
  ): Promise<{ success: boolean }> {
    await this.roomService.removeMember(roomId, user.id, user.id);
    return { success: true };
  }

  /**
   * Get members of a room
   * GET /api/v1/chat/rooms/:id/members
   */
  @Get('rooms/:id/members')
  @Version('1')
  @ApiOperation({ summary: 'Get members of a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'List of members' })
  @ApiResponse({ status: 403, description: 'Not a member of this room' })
  async getRoomMembers(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) roomId: string
  ): Promise<RoomMembersResponse> {
    // Verify user is a member first
    const isMember = await this.roomService.isMember(roomId, user.id);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this room');
    }
    const members = await this.roomService.getMembers(roomId);
    return { data: members.map((m) => this.toMemberWithUserResponse(m)) };
  }

  /**
   * Remove a member from a room
   * DELETE /api/v1/chat/rooms/:id/members/:userId
   */
  @Delete('rooms/:id/members/:userId')
  @Version('1')
  @ApiOperation({ summary: 'Remove a member from a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiParam({ name: 'userId', description: 'User ID to remove' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized to remove members' })
  async removeMember(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) roomId: string,
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<{ success: boolean }> {
    await this.roomService.removeMember(roomId, userId, user.id);
    return { success: true };
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

  private async toUserRoomResponse(
    roomData: UserRoomResult & { unreadCount: number },
    currentUserId: string
  ): Promise<UserRoomResponse> {
    let otherUser: OtherUserResponse | undefined;

    // For private rooms, get the other user's info
    if (roomData.room.type === RoomType.PRIVATE) {
      const members = await this.roomService.getMembers(roomData.room.id);
      const otherMember = members.find((m) => m.userId !== currentUserId);
      if (otherMember?.user) {
        otherUser = {
          id: otherMember.user.id,
          username: otherMember.user.username,
          nickname: otherMember.user.nickname,
          avatarUrl: otherMember.user.avatarUrl,
        };
      }
    }

    return {
      room: this.toRoomResponse(roomData.room),
      role: roomData.role,
      unreadCount: roomData.unreadCount,
      lastReadAt: roomData.lastReadAt,
      otherUser,
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

  private toMemberWithUserResponse(member: RoomMember): MemberWithUserResponse {
    return {
      id: member.id,
      roomId: member.roomId,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      lastReadAt: member.lastReadAt,
      user: member.user
        ? {
            id: member.user.id,
            username: member.user.username,
            nickname: member.user.nickname,
            avatarUrl: member.user.avatarUrl,
          }
        : undefined,
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
  otherUser?: OtherUserResponse;
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

export interface OtherUserResponse {
  id: string;
  username: string;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface MemberWithUserResponse {
  id: string;
  roomId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  lastReadAt: Date;
  user?: OtherUserResponse;
}

export interface RoomMembersResponse {
  data: MemberWithUserResponse[];
}
