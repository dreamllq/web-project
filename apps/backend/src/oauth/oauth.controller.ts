import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { OAuthService } from './oauth.service';
import {
  RegisterClientDto,
  AuthorizeDto,
  TokenDto,
  RegisterClientResponse,
  TokenEndpointResponse,
  UserInfoResponse,
} from './dto/oauth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { Public } from '../auth/decorators/public.decorator';

@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  /**
   * Register a new OAuth client
   * POST /api/oauth/clients
   */
  @Post('clients')
  @UseGuards(JwtAuthGuard)
  async registerClient(
    @CurrentUser() user: User,
    @Body() dto: RegisterClientDto,
  ): Promise<RegisterClientResponse> {
    return this.oauthService.registerClient(user.id, dto);
  }

  /**
   * Authorization endpoint
   * GET /api/oauth/authorize
   * Returns redirect URL with authorization code
   */
  @Get('authorize')
  @UseGuards(JwtAuthGuard)
  async authorize(
    @CurrentUser() user: User,
    @Query() query: AuthorizeDto,
  ): Promise<{ redirect_url: string }> {
    const redirectUrl = await this.oauthService.authorize(user.id, query);
    return { redirect_url: redirectUrl };
  }

  /**
   * Token endpoint
   * POST /api/oauth/token
   * Exchange authorization code or client credentials for access token
   */
  @Public()
  @Post('token')
  async token(@Body() dto: TokenDto): Promise<TokenEndpointResponse> {
    return this.oauthService.token(dto);
  }

  /**
   * User info endpoint
   * GET /api/oauth/userinfo
   * Returns user information based on access token scopes
   */
  @Public()
  @Get('userinfo')
  async userinfo(
    @Headers('authorization') auth: string,
  ): Promise<UserInfoResponse> {
    return this.oauthService.userinfo(auth);
  }
}
