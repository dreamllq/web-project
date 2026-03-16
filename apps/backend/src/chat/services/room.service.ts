import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, QueryFailedError } from 'typeorm';
import { Room, RoomType } from '../../entities/room.entity';
import { RoomMember, RoomMemberRole } from '../../entities/room-member.entity';
import { RoomEventsService } from '../events/room-events.service';

export interface CreateRoomData {
  type: RoomType;
  name?: string;
  avatar?: string;
  ownerId?: string;
  memberIds?: string[];
  userPairKey?: string;
}

export interface RoomWithMembers extends Room {
  members: RoomMember[];
}

export interface UserRoomResult {
  room: Room;
  role: RoomMemberRole;
  unreadCount: number;
  lastReadAt: Date;
}

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomMember)
    private readonly memberRepo: Repository<RoomMember>,
    private readonly dataSource: DataSource,
    private readonly roomEventsService: RoomEventsService
  ) {}

  /**
   * Create a new room
   * - Private rooms: auto-create two members
   * - Group rooms: require owner
   * - Broadcast rooms: only system users can join
   */
  async create(data: CreateRoomData): Promise<Room> {
    // Validate based on room type
    this.validateCreateData(data);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create room
      const room = queryRunner.manager.create(Room, {
        type: data.type,
        name: data.name ?? null,
        avatar: data.avatar ?? null,
        ownerId: data.ownerId ?? null,
        lastMessageAt: new Date(),
        userPairKey: data.userPairKey ?? null,
      });

      const savedRoom = await queryRunner.manager.save(room);

      // Create members based on room type
      if (data.type === RoomType.PRIVATE) {
        // Private room: must have exactly 2 members
        if (!data.memberIds || data.memberIds.length !== 2) {
          throw new BadRequestException('Private room requires exactly 2 members');
        }

        await this.createMembers(
          queryRunner.manager,
          savedRoom.id,
          data.memberIds,
          RoomMemberRole.MEMBER
        );

        this.logger.debug(
          `Private room created: id=${savedRoom.id}, members=${data.memberIds.join(',')}`
        );
      } else if (data.type === RoomType.GROUP) {
        // Group room: owner is required
        if (!data.ownerId) {
          throw new BadRequestException('Group room requires an owner');
        }

        // Add owner with owner role
        await queryRunner.manager.save(
          queryRunner.manager.create(RoomMember, {
            roomId: savedRoom.id,
            userId: data.ownerId,
            role: RoomMemberRole.OWNER,
          })
        );

        // Add other members if provided
        if (data.memberIds && data.memberIds.length > 0) {
          const otherMemberIds = data.memberIds.filter((id) => id !== data.ownerId);
          if (otherMemberIds.length > 0) {
            await this.createMembers(
              queryRunner.manager,
              savedRoom.id,
              otherMemberIds,
              RoomMemberRole.MEMBER
            );
          }
        }

        this.logger.debug(
          `Group room created: id=${savedRoom.id}, owner=${data.ownerId}, members=${data.memberIds?.length ?? 0}`
        );
      }
      // Broadcast rooms don't have members initially - only system users join later

      await queryRunner.commitTransaction();

      // Return room with relations
      const roomWithRelations = await this.findByIdOrFail(savedRoom.id);

      // Emit roomCreated event to all members
      const members = await this.getMembers(savedRoom.id);
      for (const member of members) {
        this.roomEventsService.emitRoomCreated(member.userId, roomWithRelations);
      }

      return roomWithRelations;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validate room creation data based on type
   */
  private validateCreateData(data: CreateRoomData): void {
    if (data.type === RoomType.PRIVATE) {
      // Private room should not have a name (use member names)
      if (data.name) {
        throw new BadRequestException('Private room should not have a name');
      }
    } else if (data.type === RoomType.GROUP) {
      // Group room should have a name
      if (!data.name) {
        throw new BadRequestException('Group room requires a name');
      }
    } else if (data.type === RoomType.BROADCAST) {
      // Broadcast room should have a name
      if (!data.name) {
        throw new BadRequestException('Broadcast room requires a name');
      }
    }
  }

  /**
   * Create multiple members for a room
   */
  private async createMembers(
    manager: ReturnType<DataSource['createQueryRunner']>['manager'],
    roomId: string,
    userIds: string[],
    role: RoomMemberRole
  ): Promise<void> {
    const members = userIds.map((userId) =>
      manager.create(RoomMember, {
        roomId,
        userId,
        role,
      })
    );

    await manager.save(members);
  }

  /**
   * Find a room by ID
   */
  async findById(id: string): Promise<Room | null> {
    return this.roomRepo.findOne({
      where: { id },
      relations: ['owner', 'members'],
    });
  }

  /**
   * Find a room by ID or throw NotFoundException
   */
  async findByIdOrFail(id: string): Promise<Room> {
    const room = await this.findById(id);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return room;
  }

  /**
   * Find all rooms for a user
   * Returns rooms with member info and unread counts
   * Only returns rooms that are not hidden by the user
   */
  async findByUser(userId: string): Promise<UserRoomResult[]> {
    // Get all room memberships for the user (excluding hidden rooms)
    const memberships = await this.memberRepo.find({
      where: { userId, isHidden: false },
      relations: ['room'],
      order: { room: { lastMessageAt: 'DESC' } },
    });

    // Build result with room info
    const results: UserRoomResult[] = [];

    for (const membership of memberships) {
      results.push({
        room: membership.room,
        role: membership.role,
        unreadCount: 0, // Will be calculated by MessageService
        lastReadAt: membership.lastReadAt,
      });
    }

    return results;
  }

  /**
   * Generate userPairKey for two users
   * Sorts userIds and joins with ':'
   */
  private generateUserPairKey(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join(':');
  }

  /**
   * Find a private room between two users using userPairKey
   * Returns null if no such room exists
   */
  async findPrivateRoom(userId1: string, userId2: string): Promise<Room | null> {
    const userPairKey = this.generateUserPairKey(userId1, userId2);

    const result = await this.roomRepo.findOne({
      where: {
        type: RoomType.PRIVATE,
        userPairKey,
      },
      relations: ['members'],
    });

    return result;
  }

  /**
   * Get or create a private room between two users
   * Handles concurrent creation with PostgreSQL unique constraint
   */
  async getOrCreatePrivateRoom(userId1: string, userId2: string): Promise<Room> {
    const userPairKey = this.generateUserPairKey(userId1, userId2);

    // Check if room already exists
    const existingRoom = await this.findPrivateRoom(userId1, userId2);
    if (existingRoom) {
      // Update room's updatedAt timestamp
      await this.roomRepo.update(existingRoom.id, { updatedAt: new Date() });

      // Unhide both members (set isHidden = false)
      await this.memberRepo.update(
        { roomId: existingRoom.id, userId: In([userId1, userId2]) },
        { isHidden: false }
      );

      // Return room with updated relations
      const updatedRoom = await this.findByIdOrFail(existingRoom.id);

      // Emit roomUpdated to both users
      this.roomEventsService.emitRoomUpdated(userId1, updatedRoom);
      this.roomEventsService.emitRoomUpdated(userId2, updatedRoom);

      return updatedRoom;
    }

    // Try to create new private room
    try {
      return await this.create({
        type: RoomType.PRIVATE,
        memberIds: [userId1, userId2],
        userPairKey,
      });
    } catch (error) {
      // Handle concurrent creation (unique constraint violation)
      if (error instanceof QueryFailedError) {
        const dbError = error as QueryFailedError & { code?: string };
        if (dbError.code === '23505') {
          // Another concurrent request created the room, fetch and return it
          this.logger.debug(
            `Concurrent private room creation detected for userPairKey=${userPairKey}, fetching existing room`
          );
          const room = await this.findPrivateRoom(userId1, userId2);
          if (room) {
            return room;
          }
        }
      }
      throw error;
    }
  }

  /**
   * Add a member to a room
   * - Private rooms: cannot add members (only 2 members allowed)
   * - Group rooms: only owner/admin can add members
   * - Broadcast rooms: only system users can join
   */
  async addMember(
    roomId: string,
    userId: string,
    operatorId: string,
    role: RoomMemberRole = RoomMemberRole.MEMBER
  ): Promise<RoomMember> {
    const room = await this.findByIdOrFail(roomId);

    // Check if room allows adding members
    if (room.type === RoomType.PRIVATE) {
      throw new ForbiddenException('Cannot add members to a private room');
    }

    // Check operator permission
    if (room.type === RoomType.GROUP) {
      const operatorRole = await this.getMemberRole(roomId, operatorId);
      if (
        !operatorRole ||
        (operatorRole !== RoomMemberRole.OWNER && operatorRole !== RoomMemberRole.ADMIN)
      ) {
        throw new ForbiddenException('Only owner or admin can add members');
      }
    }

    // Check if already a member
    const existingMember = await this.memberRepo.findOne({
      where: { roomId, userId },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this room');
    }

    // Get existing members before adding the new one (for notification)
    const existingMembers = await this.getMembers(roomId);

    // Create member
    const member = this.memberRepo.create({
      roomId,
      userId,
      role,
    });

    const savedMember = await this.memberRepo.save(member);

    // Emit memberAdded event to all existing room members
    for (const existingMember of existingMembers) {
      this.roomEventsService.emitMemberAdded(existingMember.userId, roomId, savedMember);
    }

    this.logger.debug(`Member added: roomId=${roomId}, userId=${userId}, role=${role}`);

    return savedMember;
  }

  /**
   * Remove a member from a room
   * - Private rooms: cannot remove members
   * - Group rooms: owner/admin can remove members, members can remove themselves
   * - Broadcast rooms: members can leave
   */
  async removeMember(roomId: string, userId: string, operatorId: string): Promise<void> {
    const room = await this.findByIdOrFail(roomId);

    // Check if room allows removing members
    if (room.type === RoomType.PRIVATE) {
      throw new ForbiddenException('Cannot remove members from a private room');
    }

    // Get member to remove
    const member = await this.memberRepo.findOne({
      where: { roomId, userId },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this room');
    }

    // Self-removal is always allowed
    if (userId === operatorId) {
      await this.memberRepo.remove(member);
      this.logger.debug(`Member left: roomId=${roomId}, userId=${userId}`);
      return;
    }

    // Check operator permission for removing others
    if (room.type === RoomType.GROUP) {
      const operatorRole = await this.getMemberRole(roomId, operatorId);
      if (
        !operatorRole ||
        (operatorRole !== RoomMemberRole.OWNER && operatorRole !== RoomMemberRole.ADMIN)
      ) {
        throw new ForbiddenException('Only owner or admin can remove members');
      }

      // Cannot remove owner
      if (member.role === RoomMemberRole.OWNER) {
        throw new ForbiddenException('Cannot remove the room owner');
      }

      // Admin cannot remove another admin
      if (operatorRole === RoomMemberRole.ADMIN && member.role === RoomMemberRole.ADMIN) {
        throw new ForbiddenException('Admin cannot remove another admin');
      }
    }

    await this.memberRepo.remove(member);

    // Emit memberRemoved event to the kicked user
    this.roomEventsService.emitMemberRemoved(userId, roomId);

    this.logger.debug(`Member removed: roomId=${roomId}, userId=${userId}, operator=${operatorId}`);
  }

  /**
   * Check if a user is a member of a room
   */
  async isMember(roomId: string, userId: string): Promise<boolean> {
    const count = await this.memberRepo.count({
      where: { roomId, userId },
    });

    return count > 0;
  }

  /**
   * Get a user's role in a room
   * Returns null if user is not a member
   */
  async getMemberRole(roomId: string, userId: string): Promise<RoomMemberRole | null> {
    const member = await this.memberRepo.findOne({
      where: { roomId, userId },
      select: ['role'],
    });

    return member?.role ?? null;
  }

  /**
   * Get all members of a room
   */
  async getMembers(roomId: string): Promise<RoomMember[]> {
    return this.memberRepo.find({
      where: { roomId },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });
  }

  /**
   * Get member info for a specific user in a room
   */
  async getMemberInfo(roomId: string, userId: string): Promise<RoomMember | null> {
    return this.memberRepo.findOne({
      where: { roomId, userId },
      relations: ['user'],
    });
  }

  /**
   * Update member's last read timestamp
   */
  async updateLastRead(roomId: string, userId: string): Promise<void> {
    await this.memberRepo.update({ roomId, userId }, { lastReadAt: new Date() });
  }

  /**
   * Update member settings (e.g., isHidden)
   * Only allows user to update their own settings
   */
  async updateMemberSettings(
    roomId: string,
    userId: string,
    settings: { isHidden?: boolean }
  ): Promise<RoomMember> {
    // Verify user is a member of the room
    const member = await this.memberRepo.findOne({
      where: { roomId, userId },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this room');
    }

    // Update settings
    if (settings.isHidden !== undefined) {
      member.isHidden = settings.isHidden;
    }

    const updatedMember = await this.memberRepo.save(member);

    this.logger.debug(
      `Member settings updated: roomId=${roomId}, userId=${userId}, isHidden=${settings.isHidden}`
    );

    return updatedMember;
  }

  /**
   * Update room's last message timestamp
   */
  async updateLastMessageAt(roomId: string): Promise<void> {
    await this.roomRepo.update(roomId, { lastMessageAt: new Date() });
  }

  /**
   * Transfer room ownership (group rooms only)
   */
  async transferOwnership(
    roomId: string,
    currentOwnerId: string,
    newOwnerId: string
  ): Promise<void> {
    const room = await this.findByIdOrFail(roomId);

    if (room.type !== RoomType.GROUP) {
      throw new BadRequestException('Can only transfer ownership of group rooms');
    }

    // Verify current owner
    if (room.ownerId !== currentOwnerId) {
      throw new ForbiddenException('Only the current owner can transfer ownership');
    }

    // Verify new owner is a member
    const newOwnerMember = await this.memberRepo.findOne({
      where: { roomId, userId: newOwnerId },
    });

    if (!newOwnerMember) {
      throw new NotFoundException('New owner must be a member of the room');
    }

    // Update roles
    await this.dataSource.transaction(async (manager) => {
      // Demote current owner to admin
      await manager.update(
        RoomMember,
        { roomId, userId: currentOwnerId },
        { role: RoomMemberRole.ADMIN }
      );

      // Promote new owner
      await manager.update(
        RoomMember,
        { roomId, userId: newOwnerId },
        { role: RoomMemberRole.OWNER }
      );

      // Update room owner
      await manager.update(Room, roomId, { ownerId: newOwnerId });
    });

    this.logger.debug(
      `Ownership transferred: roomId=${roomId}, from=${currentOwnerId}, to=${newOwnerId}`
    );
  }

  /**
   * Update member role (group rooms only)
   */
  async updateMemberRole(
    roomId: string,
    userId: string,
    operatorId: string,
    newRole: RoomMemberRole
  ): Promise<RoomMember> {
    const room = await this.findByIdOrFail(roomId);

    if (room.type !== RoomType.GROUP) {
      throw new BadRequestException('Can only update member roles in group rooms');
    }

    // Check operator permission
    const operatorRole = await this.getMemberRole(roomId, operatorId);
    if (operatorRole !== RoomMemberRole.OWNER) {
      throw new ForbiddenException('Only the room owner can update member roles');
    }

    // Cannot change owner's role
    if (userId === room.ownerId) {
      throw new ForbiddenException("Cannot change the owner's role");
    }

    // Get member
    const member = await this.memberRepo.findOne({
      where: { roomId, userId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Update role
    member.role = newRole;
    const updatedMember = await this.memberRepo.save(member);

    this.logger.debug(`Member role updated: roomId=${roomId}, userId=${userId}, role=${newRole}`);

    return updatedMember;
  }

  /**
   * Delete a room (soft delete - owner only)
   */
  async delete(roomId: string, userId: string): Promise<void> {
    const room = await this.findByIdOrFail(roomId);

    if (room.type === RoomType.BROADCAST) {
      throw new ForbiddenException('Cannot delete broadcast rooms');
    }

    if (room.type === RoomType.GROUP && room.ownerId !== userId) {
      throw new ForbiddenException('Only the room owner can delete the room');
    }

    // For private rooms, any member can "delete" (which just removes them)
    if (room.type === RoomType.PRIVATE) {
      const isRoomMember = await this.isMember(roomId, userId);
      if (!isRoomMember) {
        throw new ForbiddenException('Only room members can delete the room');
      }
    }

    // Get all members before deletion to emit events
    const members = await this.getMembers(roomId);

    // Emit roomDeleted event to all members
    for (const member of members) {
      this.roomEventsService.emitRoomDeleted(member.userId, roomId);
    }

    // Delete all members first
    await this.memberRepo.delete({ roomId });

    // Delete the room
    await this.roomRepo.delete(roomId);

    this.logger.debug(`Room deleted: id=${roomId}, by=${userId}`);
  }

  /**
   * Check if multiple users are members of a room
   */
  async areMembers(roomId: string, userIds: string[]): Promise<Map<string, boolean>> {
    const members = await this.memberRepo.find({
      where: {
        roomId,
        userId: In(userIds),
      },
      select: ['userId'],
    });

    const memberUserIds = new Set(members.map((m) => m.userId));
    const result = new Map<string, boolean>();

    for (const userId of userIds) {
      result.set(userId, memberUserIds.has(userId));
    }

    return result;
  }

  /**
   * Get member count for a room
   */
  async getMemberCount(roomId: string): Promise<number> {
    return this.memberRepo.count({
      where: { roomId },
    });
  }
}
