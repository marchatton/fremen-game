import type { Vector3 } from '@fremen/shared';

export interface Alert {
  id: string;
  playerId: string;
  position: Vector3;
  timestamp: number;
  alertingTrooperId: string;
  outpostId?: string;
}

export interface AlertResponse {
  trooperId: string;
  alert: Alert;
}

/**
 * VS4: Alert System
 *
 * Manages Harkonnen coordination through alerts:
 * - Troopers broadcast alerts when detecting players
 * - Nearby troopers respond to alerts
 * - Alert radius and cooldown management
 * - Alert expiration
 */
export class AlertSystem {
  private alerts: Map<string, Alert> = new Map();
  private trooperAlertCooldowns: Map<string, number> = new Map();

  // Configuration
  private readonly ALERT_RADIUS = 300; // meters
  private readonly ALERT_DURATION = 30000; // 30 seconds
  private readonly ALERT_COOLDOWN = 5000; // 5 seconds between broadcasts per trooper
  private readonly CROSS_OUTPOST_ALERT_RADIUS = 500; // meters for alerts across outposts

  /**
   * Broadcast an alert from a trooper
   */
  broadcastAlert(
    alertingTrooperId: string,
    playerId: string,
    position: Vector3,
    outpostId?: string
  ): Alert | null {
    const now = Date.now();

    // Check cooldown
    const lastAlertTime = this.trooperAlertCooldowns.get(alertingTrooperId);
    if (lastAlertTime && now - lastAlertTime < this.ALERT_COOLDOWN) {
      return null; // Still on cooldown
    }

    // Create alert
    const alert: Alert = {
      id: `alert-${alertingTrooperId}-${now}`,
      playerId,
      position,
      timestamp: now,
      alertingTrooperId,
      outpostId,
    };

    this.alerts.set(alert.id, alert);
    this.trooperAlertCooldowns.set(alertingTrooperId, now);

    console.log(`Alert broadcast by ${alertingTrooperId} at outpost ${outpostId || 'none'}: player ${playerId} spotted at (${position.x.toFixed(0)}, ${position.z.toFixed(0)})`);

    return alert;
  }

  /**
   * Get all active alerts within radius of a trooper
   */
  getAlertsForTrooper(
    trooperId: string,
    trooperPosition: Vector3,
    trooperOutpostId?: string
  ): Alert[] {
    const now = Date.now();
    const activeAlerts: Alert[] = [];

    for (const alert of this.alerts.values()) {
      // Skip expired alerts
      if (now - alert.timestamp > this.ALERT_DURATION) {
        continue;
      }

      // Skip alerts from self
      if (alert.alertingTrooperId === trooperId) {
        continue;
      }

      // Calculate distance
      const distance = this.getDistance(trooperPosition, alert.position);

      // Determine alert radius based on outpost
      const alertRadius =
        trooperOutpostId && alert.outpostId === trooperOutpostId
          ? this.ALERT_RADIUS // Same outpost
          : this.CROSS_OUTPOST_ALERT_RADIUS; // Different outpost

      if (distance <= alertRadius) {
        activeAlerts.push(alert);
      }
    }

    return activeAlerts;
  }

  /**
   * Get specific alert by ID
   */
  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    const now = Date.now();
    return Array.from(this.alerts.values()).filter(
      alert => now - alert.timestamp <= this.ALERT_DURATION
    );
  }

  /**
   * Clean up expired alerts
   */
  cleanup(): void {
    const now = Date.now();
    const expiredAlerts: string[] = [];

    for (const [id, alert] of this.alerts.entries()) {
      if (now - alert.timestamp > this.ALERT_DURATION) {
        expiredAlerts.push(id);
      }
    }

    for (const id of expiredAlerts) {
      this.alerts.delete(id);
    }

    // Clean up old cooldowns (older than cooldown period)
    const expiredCooldowns: string[] = [];
    for (const [trooperId, timestamp] of this.trooperAlertCooldowns.entries()) {
      if (now - timestamp > this.ALERT_COOLDOWN) {
        expiredCooldowns.push(trooperId);
      }
    }

    for (const trooperId of expiredCooldowns) {
      this.trooperAlertCooldowns.delete(trooperId);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalAlerts: number;
    activeAlerts: number;
    cooldowningTroopers: number;
  } {
    const now = Date.now();
    const activeAlerts = Array.from(this.alerts.values()).filter(
      alert => now - alert.timestamp <= this.ALERT_DURATION
    ).length;

    return {
      totalAlerts: this.alerts.size,
      activeAlerts,
      cooldowningTroopers: this.trooperAlertCooldowns.size,
    };
  }

  /**
   * Clear all alerts (for testing)
   */
  reset(): void {
    this.alerts.clear();
    this.trooperAlertCooldowns.clear();
  }

  /**
   * Calculate 2D distance between positions
   */
  private getDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
