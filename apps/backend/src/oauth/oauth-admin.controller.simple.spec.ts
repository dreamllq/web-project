import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { OAuthAdminController } from './oauth-admin.controller';
import { OAuthClientService } from './oauth-client.service';
import { OAuthProviderService } from './oauth-provider.service';

describe('OAuthAdminController - Basic', () => {
  let controller: OAuthAdminController;

  const mockClientService = {
    list: mock(async () => ({ data: [], total: 0 })),
    findById: mock(async () => null),
    create: mock(async () => ({})),
    update: mock(async () => ({})),
    delete: mock(async () => undefined),
    regenerateSecret: mock(async () => ({})),
    toResponse: mock((client: any) => ({ ...client, clientSecret: '••••••••' })),
  };

  const mockProviderService = {
    getProvidersMetadata: mock(async () => []),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuthAdminController],
      providers: [
        { provide: OAuthClientService, useValue: mockClientService },
        { provide: OAuthProviderService, useValue: mockProviderService },
      ],
    }).compile();

    controller = module.get<OAuthAdminController>(OAuthAdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have listClients method', () => {
    expect(controller.listClients).toBeDefined();
  });

  it('should have createClient method', () => {
    expect(controller.createClient).toBeDefined();
  });

  it('should have getClient method', () => {
    expect(controller.getClient).toBeDefined();
  });

  it('should have updateClient method', () => {
    expect(controller.updateClient).toBeDefined();
  });

  it('should have deleteClient method', () => {
    expect(controller.deleteClient).toBeDefined();
  });

  it('should have regenerateSecret method', () => {
    expect(controller.regenerateSecret).toBeDefined();
  });
});
