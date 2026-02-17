import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let mailerService: MailerService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'FRONTEND_URL') {
        return 'http://localhost:3000';
      }
      if (key === 'mail') {
        return {
          host: 'localhost',
          port: 587,
          secure: false,
          auth: {
            user: 'test@example.com',
            pass: 'password',
          },
          from: 'noreply@example.com',
        };
      }
      return null;
    }),
  };

  const mockMailerService = {
    sendMail: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mailerService = module.get<MailerService>(MailerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('module initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email with correct parameters', async () => {
      const to = 'test@example.com';
      const token = 'verification-token-123';
      const username = 'testuser';

      await service.sendVerificationEmail(to, token, username);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to,
        subject: 'Verify Your Email Address',
        template: 'verification',
        context: {
          username,
          token,
          baseUrl: 'http://localhost:3000',
          expiresIn: '24 hours',
        },
      });
    });

    it('should throw error when mailer fails', async () => {
      const error = new Error('SMTP error');
      mockMailerService.sendMail.mockRejectedValueOnce(error);

      await expect(
        service.sendVerificationEmail('test@example.com', 'token', 'testuser')
      ).rejects.toThrow('SMTP error');
    });

    it('should log email sending attempt', async () => {
      const logSpy = jest.spyOn(
        (service as unknown as { logger: { log: jest.Mock } }).logger,
        'log'
      );

      await service.sendVerificationEmail('test@example.com', 'token', 'testuser');

      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Sending verification email'));
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with correct parameters', async () => {
      const to = 'test@example.com';
      const token = 'reset-token-456';
      const username = 'testuser';

      await service.sendPasswordResetEmail(to, token, username);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to,
        subject: 'Reset Your Password',
        template: 'reset-password',
        context: {
          username,
          token,
          baseUrl: 'http://localhost:3000',
          expiresIn: '1 hour',
        },
      });
    });

    it('should throw error when mailer fails', async () => {
      const error = new Error('SMTP error');
      mockMailerService.sendMail.mockRejectedValueOnce(error);

      await expect(
        service.sendPasswordResetEmail('test@example.com', 'token', 'testuser')
      ).rejects.toThrow('SMTP error');
    });

    it('should log email sending attempt', async () => {
      const logSpy = jest.spyOn(
        (service as unknown as { logger: { log: jest.Mock } }).logger,
        'log'
      );

      await service.sendPasswordResetEmail('test@example.com', 'token', 'testuser');

      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Sending password reset email'));
    });
  });

  describe('sendMail', () => {
    it('should send email with custom options', async () => {
      const options = {
        to: 'test@example.com',
        subject: 'Custom Subject',
        template: 'custom-template',
        context: { name: 'John' },
      };

      await service.sendMail(options);

      expect(mailerService.sendMail).toHaveBeenCalledWith(options);
    });

    it('should send email with html body', async () => {
      const options = {
        to: 'test@example.com',
        subject: 'HTML Email',
        html: '<h1>Hello</h1>',
      };

      await service.sendMail(options);

      expect(mailerService.sendMail).toHaveBeenCalledWith(options);
    });

    it('should send email to multiple recipients', async () => {
      const options = {
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Multi-recipient Email',
        text: 'Hello everyone',
      };

      await service.sendMail(options);

      expect(mailerService.sendMail).toHaveBeenCalledWith(options);
    });

    it('should throw error when mailer fails', async () => {
      const error = new Error('SMTP error');
      mockMailerService.sendMail.mockRejectedValueOnce(error);

      await expect(service.sendMail({ to: 'test@example.com', subject: 'Test' })).rejects.toThrow(
        'SMTP error'
      );
    });

    it('should log email sending attempt', async () => {
      const logSpy = jest.spyOn(
        (service as unknown as { logger: { log: jest.Mock } }).logger,
        'log'
      );

      await service.sendMail({ to: 'test@example.com', subject: 'Test' });

      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Sending email'));
    });
  });

  describe('email masking', () => {
    it('should mask email addresses in logs for privacy', async () => {
      const logSpy = jest.spyOn(
        (service as unknown as { logger: { log: jest.Mock } }).logger,
        'log'
      );

      await service.sendVerificationEmail('john.doe@example.com', 'token', 'testuser');

      const logCalls = logSpy.mock.calls.map((call) => call[0]);
      const hasMaskedEmail = logCalls.some(
        (call) => typeof call === 'string' && call.includes('j***@example.com')
      );

      expect(hasMaskedEmail).toBe(true);
    });
  });
});
