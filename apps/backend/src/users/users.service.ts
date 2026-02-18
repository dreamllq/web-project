import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
}
