import { Test, TestingModule } from '@nestjs/testing';
import { WebsocketService } from './websocket.service';
import { WebsocketGateway } from './websocket.gateway';

describe('WebsocketService', () => {
  let service: WebsocketService;

  const mockGateway = {
    pushNotification: jest.fn(),
    pushSystemMessage: jest.fn(),
    broadcastSystemMessage: jest.fn(),
    isUserConnected: jest.fn(),
    getConnectedUsersCount: jest.fn(),
    getTotalConnectionsCount: jest.fn(),
    disconnectUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebsocketService,
        {
          provide: WebsocketGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = module.get<WebsocketService>(WebsocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('should send notification to a user', async () => {
      const userId = 'user-123';
      const notificationData = {
        id: 'notif-1',
        type: 'message' as const,
        title: 'New Message',
        content: 'You have a new message',
        read: false,
      };

      await service.sendNotification(userId, notificationData);

      expect(mockGateway.pushNotification).toHaveBeenCalledTimes(1);
      expect(mockGateway.pushNotification).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          ...notificationData,
          timestamp: expect.any(Date),
        }),
      );
    });

    it('should include timestamp in notification', async () => {
      const beforeTime = new Date();

      await service.sendNotification('user-123', {
        id: 'notif-1',
        type: 'system',
        title: 'Test',
        content: 'Test content',
      });

      const afterTime = new Date();
      const callArgs = mockGateway.pushNotification.mock.calls[0][1];

      expect(callArgs.timestamp).toBeInstanceOf(Date);
      expect(callArgs.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(callArgs.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should send notification with system type', async () => {
      await service.sendNotification('user-123', {
        id: 'notif-1',
        type: 'system',
        title: 'System Update',
        content: 'System will be updated',
      });

      expect(mockGateway.pushNotification).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          type: 'system',
        }),
      );
    });

    it('should send notification with security type', async () => {
      await service.sendNotification('user-123', {
        id: 'notif-1',
        type: 'security',
        title: 'Security Alert',
        content: 'New login detected',
      });

      expect(mockGateway.pushNotification).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          type: 'security',
        }),
      );
    });
  });

  describe('sendSystemMessage', () => {
    it('should send system message to a user', async () => {
      const userId = 'user-123';
      const message = 'System maintenance scheduled';

      await service.sendSystemMessage(userId, message);

      expect(mockGateway.pushSystemMessage).toHaveBeenCalledTimes(1);
      expect(mockGateway.pushSystemMessage).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          message,
          type: 'info',
          timestamp: expect.any(Date),
        }),
      );
    });

    it('should send system message with warning type', async () => {
      await service.sendSystemMessage('user-123', 'Warning message', 'warning');

      expect(mockGateway.pushSystemMessage).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          message: 'Warning message',
          type: 'warning',
        }),
      );
    });

    it('should send system message with error type', async () => {
      await service.sendSystemMessage('user-123', 'Error occurred', 'error');

      expect(mockGateway.pushSystemMessage).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          message: 'Error occurred',
          type: 'error',
        }),
      );
    });

    it('should default to info type if not specified', async () => {
      await service.sendSystemMessage('user-123', 'Info message');

      expect(mockGateway.pushSystemMessage).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          type: 'info',
        }),
      );
    });

    it('should include timestamp in system message', async () => {
      await service.sendSystemMessage('user-123', 'Test message');

      const callArgs = mockGateway.pushSystemMessage.mock.calls[0][1];
      expect(callArgs.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('broadcastSystemMessage', () => {
    it('should broadcast system message to all users', async () => {
      const message = 'Server will restart in 10 minutes';

      await service.broadcastSystemMessage(message);

      expect(mockGateway.broadcastSystemMessage).toHaveBeenCalledTimes(1);
      expect(mockGateway.broadcastSystemMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message,
          type: 'info',
          timestamp: expect.any(Date),
        }),
      );
    });

    it('should broadcast warning message', async () => {
      await service.broadcastSystemMessage('Warning: High load detected', 'warning');

      expect(mockGateway.broadcastSystemMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
        }),
      );
    });

    it('should broadcast error message', async () => {
      await service.broadcastSystemMessage('Critical error occurred', 'error');

      expect(mockGateway.broadcastSystemMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
        }),
      );
    });
  });

  describe('isUserConnected', () => {
    it('should return true if user is connected', () => {
      mockGateway.isUserConnected.mockReturnValue(true);

      const result = service.isUserConnected('user-123');

      expect(result).toBe(true);
      expect(mockGateway.isUserConnected).toHaveBeenCalledWith('user-123');
    });

    it('should return false if user is not connected', () => {
      mockGateway.isUserConnected.mockReturnValue(false);

      const result = service.isUserConnected('user-456');

      expect(result).toBe(false);
      expect(mockGateway.isUserConnected).toHaveBeenCalledWith('user-456');
    });
  });

  describe('getConnectedUsersCount', () => {
    it('should return count of connected users', () => {
      mockGateway.getConnectedUsersCount.mockReturnValue(5);

      const result = service.getConnectedUsersCount();

      expect(result).toBe(5);
      expect(mockGateway.getConnectedUsersCount).toHaveBeenCalled();
    });

    it('should return 0 when no users connected', () => {
      mockGateway.getConnectedUsersCount.mockReturnValue(0);

      const result = service.getConnectedUsersCount();

      expect(result).toBe(0);
    });
  });

  describe('getTotalConnectionsCount', () => {
    it('should return total connection count', () => {
      mockGateway.getTotalConnectionsCount.mockReturnValue(8);

      const result = service.getTotalConnectionsCount();

      expect(result).toBe(8);
      expect(mockGateway.getTotalConnectionsCount).toHaveBeenCalled();
    });

    it('should return 0 when no connections', () => {
      mockGateway.getTotalConnectionsCount.mockReturnValue(0);

      const result = service.getTotalConnectionsCount();

      expect(result).toBe(0);
    });
  });

  describe('disconnectUser', () => {
    it('should disconnect all sockets for a user', () => {
      service.disconnectUser('user-123');

      expect(mockGateway.disconnectUser).toHaveBeenCalledWith('user-123');
    });
  });
});
