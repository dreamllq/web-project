import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserStatus } from '../entities/user.entity';

export interface RegisterResponse {
  id: string;
  username: string;
  status: UserStatus;
  createdAt: Date;
}

export interface LoginResponse {
  user: {
    id: string;
    username: string;
    email: string | null;
    phone: string | null;
    status: UserStatus;
  };
  message: string;
}

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 10;

  constructor(private readonly usersService: UsersService) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async register(registerDto: RegisterDto): Promise<RegisterResponse> {
    const { username, password, email, phone } = registerDto;

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const user = await this.usersService.create({
      username,
      passwordHash,
      email,
      phone,
    });

    return {
      id: user.id,
      username: user.username,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  async login(loginDto: LoginDto, ip?: string): Promise<LoginResponse> {
    const { username, password } = loginDto;

    // Find user by username
    const user = await this.usersService.findByUsername(username);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user has a password (might be OAuth-only user)
    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is disabled
    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException('User account is disabled');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id, ip);

    // If user was pending, activate them after first login
    if (user.status === UserStatus.PENDING) {
      await this.usersService.updateStatus(user.id, UserStatus.ACTIVE);
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        status: user.status,
      },
      message: 'Login successful',
    };
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.usersService.findById(userId);
  }
}
