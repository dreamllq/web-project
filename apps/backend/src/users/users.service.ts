import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from '../entities/user.entity';
import { SocialAccount, SocialProvider } from '../entities/social-account.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface CreateUserData {
  username: string;
  passwordHash: string;
  email?: string;
  phone?: string;
}

export interface CreateOAuthUserData {
  username: string;
  nickname?: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
}

// Admin user management interfaces
export interface AdminUserQueryDto {
  keyword?: string;
  status?: UserStatus;
  limit?: number;
  offset?: number;
}

export interface AdminCreateUserData {
  username: string;
  password: string;
  email?: string;
  phone?: string;
  nickname?: string;
  status?: UserStatus;
}

export interface AdminUpdateUserData {
  email?: string;
  phone?: string;
  nickname?: string;
  status?: UserStatus;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(SocialAccount)
    private socialAccountsRepository: Repository<SocialAccount>
  ) {}

  async create(data: CreateUserData): Promise<User> {
    // Check if username already exists
    const existingUser = await this.findByUsername(data.username);
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    // Check if email already exists (if provided)
    if (data.email) {
      const existingEmail = await this.findByEmail(data.email);
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    // Check if phone already exists (if provided)
    if (data.phone) {
      const existingPhone = await this.findByPhone(data.phone);
      if (existingPhone) {
        throw new ConflictException('Phone already exists');
      }
    }

    const user = this.usersRepository.create({
      username: data.username,
      passwordHash: data.passwordHash,
      email: data.email || null,
      phone: data.phone || null,
      status: UserStatus.PENDING,
    });

    return this.usersRepository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { phone } });
  }

  async updateLastLogin(id: string, ip?: string): Promise<void> {
    await this.usersRepository.update(id, {
      lastLoginAt: new Date(),
      lastLoginIp: ip || null,
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<void> {
    await this.usersRepository.update(id, { status });
  }

  async updateEmailVerifiedAt(id: string, verifiedAt: Date): Promise<void> {
    await this.usersRepository.update(id, { emailVerifiedAt: verifiedAt });
  }

  /**
   * Create an OAuth user (no password required)
   */
  async createOAuthUser(data: CreateOAuthUserData): Promise<User> {
    // Check if username already exists
    const existingUser = await this.findByUsername(data.username);
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    // Check if email already exists (if provided)
    if (data.email) {
      const existingEmail = await this.findByEmail(data.email);
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    // Check if phone already exists (if provided)
    if (data.phone) {
      const existingPhone = await this.findByPhone(data.phone);
      if (existingPhone) {
        throw new ConflictException('Phone already exists');
      }
    }

    const user = this.usersRepository.create({
      username: data.username,
      passwordHash: null, // OAuth users don't have passwords initially
      nickname: data.nickname || null,
      avatarUrl: data.avatarUrl || null,
      email: data.email || null,
      phone: data.phone || null,
      status: UserStatus.ACTIVE, // OAuth users are active immediately
    });

    return this.usersRepository.save(user);
  }

  /**
   * Find social account by provider and provider user ID
   */
  async findSocialAccount(
    provider: SocialProvider,
    providerUserId: string
  ): Promise<SocialAccount | null> {
    return this.socialAccountsRepository.findOne({
      where: { provider, providerUserId },
      relations: ['user'],
    });
  }

  /**
   * Create a social account linking to a user
   */
  async createSocialAccount(
    userId: string,
    provider: SocialProvider,
    providerUserId: string,
    providerData?: Record<string, unknown>
  ): Promise<SocialAccount> {
    const socialAccount = this.socialAccountsRepository.create({
      userId,
      provider,
      providerUserId,
      providerData: providerData || null,
    });

    return this.socialAccountsRepository.save(socialAccount);
  }

  /**
   * Generate a unique username for OAuth users
   */
  generateOAuthUsername(provider: SocialProvider, providerUserId: string): string {
    const prefix = provider.replace('_', '');
    const shortId = providerUserId.substring(0, 8).toLowerCase();
    return `${prefix}_${shortId}`;
  }

  /**
   * Update user's password
   */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.usersRepository.update(id, { passwordHash });
  }

  /**
   * Update user profile (nickname, locale)
   */
  async updateProfile(id: string, updateData: UpdateProfileDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Build update object with only provided fields
    const updatePayload: { nickname?: string; locale?: string } = {};
    if (updateData.nickname !== undefined) {
      updatePayload.nickname = updateData.nickname;
    }
    if (updateData.locale !== undefined) {
      updatePayload.locale = updateData.locale;
    }

    if (Object.keys(updatePayload).length > 0) {
      await this.usersRepository.update(id, updatePayload);
    }

    return (await this.findById(id))!;
  }

  /**
   * Change user password (requires old password verification)
   */
  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if user has a password set
    if (!user.passwordHash) {
      throw new BadRequestException('User does not have a password set');
    }

    // Verify old password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid old password');
    }

    // Hash and update new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.update(id, { passwordHash: newPasswordHash });
  }

  /**
   * Soft delete user account (set deletedAt timestamp)
   */
  async softDelete(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Use TypeORM's soft delete mechanism
    await this.usersRepository.softDelete(id);
  }

  /**
   * Update user's avatar URL
   */
  async updateAvatarUrl(id: string, avatarUrl: string): Promise<void> {
    await this.usersRepository.update(id, { avatarUrl });
  }

  /**
   * Generic update method for user fields
   */
  async update(
    id: string,
    updateData: Partial<
      Pick<
        User,
        | 'phone'
        | 'phoneVerifiedAt'
        | 'email'
        | 'emailVerifiedAt'
        | 'nickname'
        | 'avatarUrl'
        | 'locale'
        | 'status'
      >
    >
  ): Promise<void> {
    await this.usersRepository.update(id, updateData);
  }

  // ==================== Admin User Management Methods ====================

  /**
   * Paginated user list with filtering
   */
  async findAll(query: AdminUserQueryDto): Promise<{ data: User[]; total: number }> {
    const { keyword, status, limit = 10, offset = 0 } = query;

    const qb = this.usersRepository.createQueryBuilder('user');

    // Filter by status if provided
    if (status) {
      qb.andWhere('user.status = :status', { status });
    }

    // Search by keyword if provided (username/email/phone LIKE)
    if (keyword) {
      qb.andWhere(
        '(user.username ILIKE :keyword OR user.email ILIKE :keyword OR user.phone ILIKE :keyword)',
        { keyword: `%${keyword}%` }
      );
    }

    // Order by createdAt DESC
    qb.orderBy('user.createdAt', 'DESC');

    // Get total count before pagination
    const total = await qb.getCount();

    // Apply pagination
    qb.skip(offset).take(limit);

    const data = await qb.getMany();

    return { data, total };
  }

  /**
   * Search users by keyword (for autocomplete/quick search)
   */
  async searchUsers(keyword: string): Promise<User[]> {
    if (!keyword || keyword.trim() === '') {
      return [];
    }

    return this.usersRepository.find({
      where: [
        { username: ILike(`%${keyword}%`) },
        { email: ILike(`%${keyword}%`) },
        { phone: ILike(`%${keyword}%`) },
      ],
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  /**
   * Admin create user with validation
   */
  async adminCreate(data: AdminCreateUserData): Promise<User> {
    // Check if username already exists
    const existingUser = await this.findByUsername(data.username);
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    // Check if email already exists (if provided)
    if (data.email) {
      const existingEmail = await this.findByEmail(data.email);
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    // Check if phone already exists (if provided)
    if (data.phone) {
      const existingPhone = await this.findByPhone(data.phone);
      if (existingPhone) {
        throw new ConflictException('Phone already exists');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = this.usersRepository.create({
      username: data.username,
      passwordHash,
      email: data.email || null,
      phone: data.phone || null,
      nickname: data.nickname || null,
      status: data.status || UserStatus.PENDING,
    });

    return this.usersRepository.save(user);
  }

  /**
   * Admin update user (can update status)
   */
  async adminUpdate(id: string, data: AdminUpdateUserData): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate uniqueness for email if changing
    if (data.email && data.email !== user.email) {
      const existingEmail = await this.findByEmail(data.email);
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    // Validate uniqueness for phone if changing
    if (data.phone && data.phone !== user.phone) {
      const existingPhone = await this.findByPhone(data.phone);
      if (existingPhone) {
        throw new ConflictException('Phone already exists');
      }
    }

    // Build update object with only provided fields
    const updatePayload: {
      email?: string | null;
      phone?: string | null;
      nickname?: string | null;
      status?: UserStatus;
    } = {};
    if (data.email !== undefined) {
      updatePayload.email = data.email || null;
    }
    if (data.phone !== undefined) {
      updatePayload.phone = data.phone || null;
    }
    if (data.nickname !== undefined) {
      updatePayload.nickname = data.nickname || null;
    }
    if (data.status !== undefined) {
      updatePayload.status = data.status;
    }

    if (Object.keys(updatePayload).length > 0) {
      await this.usersRepository.update(id, updatePayload);
    }

    return (await this.findById(id))!;
  }
}
