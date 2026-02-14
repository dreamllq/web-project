import { Injectable, Logger, UnauthorizedException, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../entities/user.entity';
import {
  RegisterClientDto,
  RegisterClientResponse,
  AuthorizeDto,
  TokenDto,
  TokenEndpointResponse,
  UserInfoResponse,
  GrantType,
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthAccessToken,
} from './dto/oauth.dto';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly AUTHORIZATION_CODE_TTL = 600; // 10 minutes in seconds
  private readonly ACCESS_TOKEN_TTL = 3600; // 1 hour in seconds
  private readonly CLIENT_PREFIX = 'oauth:client:';
  private readonly AUTH_CODE_PREFIX = 'oauth:code:';
  private readonly ACCESS_TOKEN_PREFIX = 'oauth:token:';

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Register a new OAuth client
   */
  async registerClient(userId: string, dto: RegisterClientDto): Promise<RegisterClientResponse> {
    const clientId = this.generateClientId();
    const clientSecret = this.generateClientSecret();
    const id = this.generateId();

    const client: OAuthClient = {
      id,
      clientId,
      clientSecret,
      name: dto.name,
      redirectUris: dto.redirectUris,
      scopes: dto.scopes || ['openid', 'profile', 'email'],
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store client in cache (in production, use database)
    await this.cacheManager.set(
      `${this.CLIENT_PREFIX}${clientId}`,
      client,
      365 * 24 * 60 * 60 * 1000, // 1 year TTL for client
    );

    this.logger.log(`Registered new OAuth client: ${clientId} for user: ${userId}`);

    return {
      id: client.id,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      name: client.name,
      redirect_uris: client.redirectUris,
      scopes: client.scopes,
      created_at: client.createdAt,
    };
  }

  /**
   * Generate authorization code and redirect URL
   */
  async authorize(userId: string, dto: AuthorizeDto): Promise<string> {
    // Validate client
    const client = await this.getClient(dto.client_id);
    if (!client) {
      throw new UnauthorizedException('Invalid client_id');
    }

    // Validate redirect URI
    if (!client.redirectUris.includes(dto.redirect_uri)) {
      throw new BadRequestException('Invalid redirect_uri');
    }

    // Validate scopes (default to client scopes if not provided)
    const scopes = dto.scope ? dto.scope.split(' ') : client.scopes;
    const validScopes = scopes.filter(s => client.scopes.includes(s));

    // Generate authorization code
    const code = this.generateCode();
    const authCode: OAuthAuthorizationCode = {
      code,
      clientId: client.clientId,
      redirectUri: dto.redirect_uri,
      userId,
      scopes: validScopes,
      expiresAt: Date.now() + this.AUTHORIZATION_CODE_TTL * 1000,
    };

    // Store authorization code in cache
    await this.cacheManager.set(
      `${this.AUTH_CODE_PREFIX}${code}`,
      authCode,
      this.AUTHORIZATION_CODE_TTL * 1000,
    );

    this.logger.log(`Generated authorization code for user: ${userId}, client: ${dto.client_id}`);

    // Build redirect URL
    const redirectUrl = new URL(dto.redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (dto.state) {
      redirectUrl.searchParams.set('state', dto.state);
    }

    return redirectUrl.toString();
  }

  /**
   * Exchange authorization code or client credentials for access token
   */
  async token(dto: TokenDto): Promise<TokenEndpointResponse> {
    // Validate client credentials
    const client = await this.validateClient(dto.client_id, dto.client_secret);
    if (!client) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    switch (dto.grant_type) {
      case GrantType.AUTHORIZATION_CODE:
        return this.handleAuthorizationCodeGrant(client, dto);
      case GrantType.CLIENT_CREDENTIALS:
        return this.handleClientCredentialsGrant(client, dto);
      default:
        throw new BadRequestException('Unsupported grant_type');
    }
  }

  /**
   * Get user info from access token
   */
  async userinfo(authHeader: string): Promise<UserInfoResponse> {
    const token = this.extractToken(authHeader);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const tokenData = await this.getAccessToken(token);
    if (!tokenData) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    // For client_credentials, there's no user
    if (!tokenData.userId) {
      throw new UnauthorizedException('Token does not have user context');
    }

    const user = await this.usersService.findById(tokenData.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Return user info based on scopes
    const response: UserInfoResponse = {
      sub: user.id,
      username: user.username,
    };

    if (tokenData.scopes.includes('email') || tokenData.scopes.includes('openid')) {
      response.email = user.email;
    }

    if (tokenData.scopes.includes('phone')) {
      response.phone = user.phone;
    }

    if (tokenData.scopes.includes('profile')) {
      response.nickname = user.nickname;
      response.avatar_url = user.avatarUrl;
    }

    return response;
  }

  // ==================== Private Methods ====================

  /**
   * Handle authorization_code grant
   */
  private async handleAuthorizationCodeGrant(
    client: OAuthClient,
    dto: TokenDto,
  ): Promise<TokenEndpointResponse> {
    if (!dto.code) {
      throw new BadRequestException('Missing code parameter');
    }

    const authCode = await this.getAuthorizationCode(dto.code);
    if (!authCode) {
      throw new UnauthorizedException('Invalid or expired authorization code');
    }

    // Validate code belongs to this client
    if (authCode.clientId !== client.clientId) {
      throw new UnauthorizedException('Authorization code does not belong to this client');
    }

    // Validate redirect URI matches
    if (dto.redirect_uri && authCode.redirectUri !== dto.redirect_uri) {
      throw new BadRequestException('redirect_uri mismatch');
    }

    // Delete the authorization code (single use)
    await this.cacheManager.del(`${this.AUTH_CODE_PREFIX}${dto.code}`);

    // Generate access token
    const accessToken = this.generateAccessToken();
    const tokenData: OAuthAccessToken = {
      accessToken,
      clientId: client.clientId,
      userId: authCode.userId,
      scopes: authCode.scopes,
      expiresAt: Date.now() + this.ACCESS_TOKEN_TTL * 1000,
    };

    await this.cacheManager.set(
      `${this.ACCESS_TOKEN_PREFIX}${accessToken}`,
      tokenData,
      this.ACCESS_TOKEN_TTL * 1000,
    );

    this.logger.log(`Issued access token for user: ${authCode.userId}, client: ${client.clientId}`);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.ACCESS_TOKEN_TTL,
      scope: authCode.scopes.join(' '),
    };
  }

  /**
   * Handle client_credentials grant
   */
  private async handleClientCredentialsGrant(
    client: OAuthClient,
    dto: TokenDto,
  ): Promise<TokenEndpointResponse> {
    // Determine scopes
    const requestedScopes = dto.scope ? dto.scope.split(' ') : client.scopes;
    const scopes = requestedScopes.filter(s => client.scopes.includes(s));

    // Generate access token
    const accessToken = this.generateAccessToken();
    const tokenData: OAuthAccessToken = {
      accessToken,
      clientId: client.clientId,
      userId: undefined, // No user for client_credentials
      scopes,
      expiresAt: Date.now() + this.ACCESS_TOKEN_TTL * 1000,
    };

    await this.cacheManager.set(
      `${this.ACCESS_TOKEN_PREFIX}${accessToken}`,
      tokenData,
      this.ACCESS_TOKEN_TTL * 1000,
    );

    this.logger.log(`Issued client credentials token for client: ${client.clientId}`);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.ACCESS_TOKEN_TTL,
      scope: scopes.join(' '),
    };
  }

  /**
   * Get client by client_id
   */
  private async getClient(clientId: string): Promise<OAuthClient | null> {
    const client = await this.cacheManager.get<OAuthClient>(`${this.CLIENT_PREFIX}${clientId}`);
    return client || null;
  }

  /**
   * Validate client credentials
   */
  private async validateClient(clientId: string, clientSecret: string): Promise<OAuthClient | null> {
    const client = await this.getClient(clientId);
    if (!client || client.clientSecret !== clientSecret) {
      return null;
    }
    return client;
  }

  /**
   * Get authorization code from cache
   */
  private async getAuthorizationCode(code: string): Promise<OAuthAuthorizationCode | null> {
    const authCode = await this.cacheManager.get<OAuthAuthorizationCode>(
      `${this.AUTH_CODE_PREFIX}${code}`,
    );
    return authCode || null;
  }

  /**
   * Get access token data from cache
   */
  private async getAccessToken(token: string): Promise<OAuthAccessToken | null> {
    const tokenData = await this.cacheManager.get<OAuthAccessToken>(
      `${this.ACCESS_TOKEN_PREFIX}${token}`,
    );
    return tokenData || null;
  }

  /**
   * Extract token from Authorization header
   */
  private extractToken(authHeader: string): string | null {
    if (!authHeader) {
      return null;
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return null;
    }
    return parts[1];
  }

  /**
   * Generate random client ID
   */
  private generateClientId(): string {
    return `client_${this.randomString(16)}`;
  }

  /**
   * Generate random client secret
   */
  private generateClientSecret(): string {
    return this.randomString(32);
  }

  /**
   * Generate random ID
   */
  private generateId(): string {
    return this.randomString(16);
  }

  /**
   * Generate random authorization code
   */
  private generateCode(): string {
    return this.randomString(32);
  }

  /**
   * Generate random access token
   */
  private generateAccessToken(): string {
    return this.randomString(64);
  }

  /**
   * Generate random string
   */
  private randomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
