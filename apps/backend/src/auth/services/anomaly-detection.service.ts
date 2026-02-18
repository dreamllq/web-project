import { Injectable, Logger } from '@nestjs/common';
import { LoginHistoryService } from '../../users/services/login-history.service';
import { UserDeviceService } from '../../users/services/user-device.service';
// import { MailService } from '../../mail/mail.service'; // TODO: Enable when email alerts implemented

export type RiskLevel = 'low' | 'medium' | 'high';

export interface AnomalyCheckResult {
  riskLevel: RiskLevel;
  reasons: string[];
  requiresAlert: boolean;
}

export interface LoginContext {
  userId: string;
  ipAddress: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);

  // Configuration thresholds
  private readonly BRUTE_FORCE_THRESHOLD = 5; // Failed attempts
  private readonly BRUTE_FORCE_WINDOW = 15 * 60 * 1000; // 15 minutes in ms
  // Reserved for future GeoIP-based travel detection
  // private readonly IMPOSSIBLE_TRAVEL_SPEED = 500; // km/h (max reasonable travel speed)

  constructor(
    private readonly loginHistoryService: LoginHistoryService,
    private readonly userDeviceService: UserDeviceService
    // private readonly mailService: MailService, // TODO: Enable when email alerts implemented
  ) {}

  /**
   * Run all anomaly checks and return combined result
   */
  async checkLogin(userId: string, context: LoginContext): Promise<AnomalyCheckResult> {
    const reasons: string[] = [];
    let maxRisk: RiskLevel = 'low';

    // Check for new device
    const deviceRisk = await this.checkNewDevice(userId, context.deviceFingerprint);
    if (deviceRisk !== 'low') {
      reasons.push('New device detected');
      if (deviceRisk === 'high' || maxRisk === 'low') maxRisk = deviceRisk;
    }

    // Check for new location
    const locationRisk = await this.checkNewLocation(userId, context.ipAddress);
    if (locationRisk !== 'low') {
      reasons.push('Login from new location');
      if (locationRisk === 'high' || (locationRisk === 'medium' && maxRisk === 'low')) {
        maxRisk = locationRisk;
      }
    }

    // Check for impossible travel
    const travelRisk = await this.checkImpossibleTravel(userId, context.ipAddress);
    if (travelRisk !== 'low') {
      reasons.push('Impossible travel detected');
      maxRisk = 'high'; // Impossible travel is always high risk
    }

    // Check for brute force
    const bruteForceRisk = await this.checkBruteForce(userId);
    if (bruteForceRisk !== 'low') {
      reasons.push('Multiple failed login attempts detected');
      if (bruteForceRisk === 'high') maxRisk = 'high';
    }

    const result: AnomalyCheckResult = {
      riskLevel: maxRisk,
      reasons,
      requiresAlert: maxRisk === 'high' || (maxRisk === 'medium' && reasons.length > 1),
    };

    // Send alert if required
    if (result.requiresAlert) {
      await this.sendAlert(userId, reasons, context);
    }

    return result;
  }

  /**
   * Check if login is from a new device
   */
  async checkNewDevice(userId: string, deviceFingerprint?: string): Promise<RiskLevel> {
    if (!deviceFingerprint) return 'low';

    try {
      const devices = await this.userDeviceService.getUserDevices(userId);
      const knownDevice = devices.find((d) => d.deviceFingerprint === deviceFingerprint);

      if (!knownDevice) {
        return 'medium'; // New device is medium risk
      }

      if (!knownDevice.trusted) {
        return 'low'; // Known but untrusted is low risk
      }

      return 'low';
    } catch (error) {
      this.logger.error('Error checking device', error);
      return 'low'; // Fail open for device check
    }
  }

  /**
   * Check if login is from a new IP/location
   */
  async checkNewLocation(userId: string, ipAddress: string): Promise<RiskLevel> {
    if (!ipAddress) return 'low';

    try {
      const loginHistory = await this.loginHistoryService.getLoginHistory(userId, {
        limit: 20,
        success: true,
      });

      const knownIps = new Set(loginHistory.data.map((h) => h.ipAddress).filter(Boolean));

      if (!knownIps.has(ipAddress)) {
        return 'medium';
      }

      return 'low';
    } catch (error) {
      this.logger.error('Error checking location', error);
      return 'low';
    }
  }

  /**
   * Check for impossible travel (logins from distant locations in short time)
   * Note: This is a simplified implementation. Real implementation would use GeoIP.
   */
  async checkImpossibleTravel(userId: string, currentIp: string): Promise<RiskLevel> {
    if (!currentIp) return 'low';

    try {
      const recentLogins = await this.loginHistoryService.getLoginHistory(userId, {
        limit: 5,
        success: true,
      });

      if (recentLogins.data.length === 0) {
        return 'low'; // No previous logins
      }

      const lastLogin = recentLogins.data[0];
      if (!lastLogin?.ipAddress || !lastLogin.createdAt) {
        return 'low';
      }

      // If same IP, no issue
      if (lastLogin.ipAddress === currentIp) {
        return 'low';
      }

      // Check time difference
      const timeDiff = Date.now() - new Date(lastLogin.createdAt).getTime();

      // If more than 24 hours, travel is possible
      if (timeDiff > 24 * 60 * 60 * 1000) {
        return 'low';
      }

      // In a real implementation, we would calculate distance between IPs
      // For now, flag different IP within short time as suspicious
      if (timeDiff < 60 * 60 * 1000) {
        // Within 1 hour
        this.logger.warn(
          `Potential impossible travel for user ${userId}: ${lastLogin.ipAddress} -> ${currentIp} in ${Math.round(timeDiff / 60000)} minutes`
        );
        return 'high';
      }

      return 'low';
    } catch (error) {
      this.logger.error('Error checking impossible travel', error);
      return 'low';
    }
  }

  /**
   * Check for brute force attack patterns
   */
  async checkBruteForce(userId: string): Promise<RiskLevel> {
    try {
      const recentAttempts = await this.loginHistoryService.getLoginHistory(userId, {
        limit: 10,
      });

      const now = Date.now();
      const recentFailures = recentAttempts.data.filter((attempt) => {
        if (attempt.success) return false;
        const attemptTime = new Date(attempt.createdAt).getTime();
        return now - attemptTime < this.BRUTE_FORCE_WINDOW;
      });

      const failureCount = recentFailures.length;

      if (failureCount >= this.BRUTE_FORCE_THRESHOLD) {
        return 'high';
      }

      if (failureCount >= 3) {
        return 'medium';
      }

      return 'low';
    } catch (error) {
      this.logger.error('Error checking brute force', error);
      return 'low';
    }
  }

  /**
   * Send alert email for suspicious activity
   */
  private async sendAlert(userId: string, reasons: string[], context: LoginContext): Promise<void> {
    try {
      // In a real implementation, we would fetch user email and send alert
      this.logger.warn(
        `Security alert for user ${userId}: ${reasons.join(', ')} ` +
          `(IP: ${context.ipAddress}, Device: ${context.deviceFingerprint || 'unknown'})`
      );

      // TODO: Send actual email when user service is available
      // await this.mailService.sendMail({
      //   to: user.email,
      //   subject: 'Security Alert - Suspicious Login Detected',
      //   template: 'security-alert',
      //   context: { reasons, context, timestamp: new Date() },
      // });
    } catch (error) {
      this.logger.error('Failed to send security alert', error);
    }
  }
}
