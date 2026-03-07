import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Version,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { ApiKeyService, CreateApiKeyData } from './api-key.service';

@ApiTags('api-keys')
@Controller('api-keys')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @Version('1')
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({ status: 201, description: 'API key created successfully' })
  async create(
    @CurrentUser() user: User,
    @Body() body: { name: string; scopes?: string[]; expiresAt?: Date }
  ): Promise<{ id: string; name: string; key: string; createdAt: Date }> {
    const data: CreateApiKeyData = {
      name: body.name,
      userId: user.id,
      scopes: body.scopes,
      expiresAt: body.expiresAt,
    };

    const { apiKey, plainKey } = await this.apiKeyService.create(data);

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: plainKey,
      createdAt: apiKey.createdAt,
    };
  }

  @Get()
  @Version('1')
  @ApiOperation({ summary: 'Get all API keys for current user' })
  @ApiResponse({ status: 200, description: 'List of API keys' })
  async findAll(@CurrentUser() user: User) {
    const apiKeys = await this.apiKeyService.findByUser(user.id);

    return apiKeys.map((apiKey) => ({
      id: apiKey.id,
      name: apiKey.name,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
      revokedAt: apiKey.revokedAt,
    }));
  }

  @Delete(':id')
  @Version('1')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an API key' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({ status: 204, description: 'API key deleted successfully' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User): Promise<void> {
    const apiKey = await this.apiKeyService.findById(id);

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    if (apiKey.userId !== user.id) {
      throw new ForbiddenException('You can only delete your own API keys');
    }

    await this.apiKeyService.delete(id);
  }
}
