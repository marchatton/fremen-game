import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AlertSystem } from './AlertSystem';
import type { Vector3 } from '@fremen/shared';

describe('VS4: Alert System', () => {
  let alertSystem: AlertSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000000);
    alertSystem = new AlertSystem();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Alert Broadcasting', () => {
    it('should broadcast alert successfully', () => {
      const position: Vector3 = { x: 100, y: 0, z: 200 };

      const alert = alertSystem.broadcastAlert('trooper-1', 'player-1', position, 'outpost-1');

      expect(alert).toBeDefined();
      expect(alert!.playerId).toBe('player-1');
      expect(alert!.position).toEqual(position);
      expect(alert!.alertingTrooperId).toBe('trooper-1');
      expect(alert!.outpostId).toBe('outpost-1');
      expect(alert!.timestamp).toBe(1000000);
    });

    it('should create unique alert IDs', () => {
      const position: Vector3 = { x: 100, y: 0, z: 200 };

      const alert1 = alertSystem.broadcastAlert('trooper-1', 'player-1', position);
      vi.advanceTimersByTime(1000);
      const alert2 = alertSystem.broadcastAlert('trooper-2', 'player-1', position);

      expect(alert1!.id).not.toBe(alert2!.id);
    });

    it('should handle alert without outpost', () => {
      const position: Vector3 = { x: 100, y: 0, z: 200 };

      const alert = alertSystem.broadcastAlert('trooper-1', 'player-1', position);

      expect(alert).toBeDefined();
      expect(alert!.outpostId).toBeUndefined();
    });
  });

  describe('Alert Cooldown', () => {
    it('should enforce cooldown period between broadcasts', () => {
      const position: Vector3 = { x: 100, y: 0, z: 200 };

      const alert1 = alertSystem.broadcastAlert('trooper-1', 'player-1', position);
      expect(alert1).toBeDefined();

      // Try to broadcast again immediately
      const alert2 = alertSystem.broadcastAlert('trooper-1', 'player-1', position);
      expect(alert2).toBeNull();
    });

    it('should allow broadcast after cooldown expires', () => {
      const position: Vector3 = { x: 100, y: 0, z: 200 };

      const alert1 = alertSystem.broadcastAlert('trooper-1', 'player-1', position);
      expect(alert1).toBeDefined();

      // Advance time past cooldown (5 seconds)
      vi.advanceTimersByTime(5001);

      const alert2 = alertSystem.broadcastAlert('trooper-1', 'player-1', position);
      expect(alert2).toBeDefined();
      expect(alert2!.id).not.toBe(alert1!.id);
    });

    it('should have separate cooldowns per trooper', () => {
      const position: Vector3 = { x: 100, y: 0, z: 200 };

      const alert1 = alertSystem.broadcastAlert('trooper-1', 'player-1', position);
      const alert2 = alertSystem.broadcastAlert('trooper-2', 'player-1', position);

      expect(alert1).toBeDefined();
      expect(alert2).toBeDefined();
    });
  });

  describe('Alert Retrieval', () => {
    it('should get alerts within radius for trooper at same outpost', () => {
      const alertPosition: Vector3 = { x: 100, y: 0, z: 100 };
      const trooperPosition: Vector3 = { x: 150, y: 0, z: 150 }; // ~70m away

      alertSystem.broadcastAlert('trooper-1', 'player-1', alertPosition, 'outpost-1');

      const alerts = alertSystem.getAlertsForTrooper('trooper-2', trooperPosition, 'outpost-1');

      expect(alerts.length).toBe(1);
      expect(alerts[0].alertingTrooperId).toBe('trooper-1');
    });

    it('should not get alerts outside radius', () => {
      const alertPosition: Vector3 = { x: 0, y: 0, z: 0 };
      const trooperPosition: Vector3 = { x: 1000, y: 0, z: 1000 }; // Far away

      alertSystem.broadcastAlert('trooper-1', 'player-1', alertPosition, 'outpost-1');

      const alerts = alertSystem.getAlertsForTrooper('trooper-2', trooperPosition, 'outpost-1');

      expect(alerts.length).toBe(0);
    });

    it('should not get alerts from self', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position, 'outpost-1');

      const alerts = alertSystem.getAlertsForTrooper('trooper-1', position, 'outpost-1');

      expect(alerts.length).toBe(0);
    });

    it('should get multiple alerts within radius', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position, 'outpost-1');
      alertSystem.broadcastAlert('trooper-2', 'player-1', { x: 120, y: 0, z: 100 }, 'outpost-1');
      alertSystem.broadcastAlert('trooper-3', 'player-1', { x: 100, y: 0, z: 120 }, 'outpost-1');

      const alerts = alertSystem.getAlertsForTrooper('trooper-4', position, 'outpost-1');

      expect(alerts.length).toBe(3);
    });

    it('should use larger radius for cross-outpost alerts', () => {
      const alertPosition: Vector3 = { x: 0, y: 0, z: 0 };
      const trooperPosition: Vector3 = { x: 400, y: 0, z: 0 }; // 400m away

      alertSystem.broadcastAlert('trooper-1', 'player-1', alertPosition, 'outpost-1');

      // Same outpost: should not see alert (300m radius)
      const sameOutpostAlerts = alertSystem.getAlertsForTrooper('trooper-2', trooperPosition, 'outpost-1');
      expect(sameOutpostAlerts.length).toBe(0);

      // Different outpost: should see alert (500m radius)
      const crossOutpostAlerts = alertSystem.getAlertsForTrooper('trooper-2', trooperPosition, 'outpost-2');
      expect(crossOutpostAlerts.length).toBe(1);
    });
  });

  describe('Alert Expiration', () => {
    it('should not return expired alerts', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position, 'outpost-1');

      // Advance time past alert duration (30 seconds)
      vi.advanceTimersByTime(31000);

      const alerts = alertSystem.getAlertsForTrooper('trooper-2', position, 'outpost-1');

      expect(alerts.length).toBe(0);
    });

    it('should return alerts within duration', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position, 'outpost-1');

      // Advance time but stay within duration
      vi.advanceTimersByTime(29000);

      const alerts = alertSystem.getAlertsForTrooper('trooper-2', position, 'outpost-1');

      expect(alerts.length).toBe(1);
    });

    it('should handle mix of expired and active alerts', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position, 'outpost-1');

      vi.advanceTimersByTime(31000); // First alert expires

      alertSystem.broadcastAlert('trooper-2', 'player-1', position, 'outpost-1');

      const alerts = alertSystem.getAlertsForTrooper('trooper-3', position, 'outpost-1');

      expect(alerts.length).toBe(1);
      expect(alerts[0].alertingTrooperId).toBe('trooper-2');
    });
  });

  describe('Alert Cleanup', () => {
    it('should remove expired alerts', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position);

      expect(alertSystem.getStats().totalAlerts).toBe(1);

      vi.advanceTimersByTime(31000);
      alertSystem.cleanup();

      expect(alertSystem.getStats().totalAlerts).toBe(0);
    });

    it('should keep active alerts', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position);

      vi.advanceTimersByTime(29000);
      alertSystem.cleanup();

      expect(alertSystem.getStats().totalAlerts).toBe(1);
    });

    it('should remove expired cooldowns', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position);

      expect(alertSystem.getStats().cooldowningTroopers).toBe(1);

      vi.advanceTimersByTime(6000);
      alertSystem.cleanup();

      expect(alertSystem.getStats().cooldowningTroopers).toBe(0);
    });
  });

  describe('Alert Queries', () => {
    it('should get alert by ID', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      const alert = alertSystem.broadcastAlert('trooper-1', 'player-1', position);

      const retrieved = alertSystem.getAlert(alert!.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(alert!.id);
    });

    it('should return undefined for non-existent alert ID', () => {
      const alert = alertSystem.getAlert('nonexistent');

      expect(alert).toBeUndefined();
    });

    it('should get all active alerts', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position);
      alertSystem.broadcastAlert('trooper-2', 'player-1', position);

      const activeAlerts = alertSystem.getActiveAlerts();

      expect(activeAlerts.length).toBe(2);
    });

    it('should exclude expired alerts from active list', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position);

      vi.advanceTimersByTime(31000);

      alertSystem.broadcastAlert('trooper-2', 'player-1', position);

      const activeAlerts = alertSystem.getActiveAlerts();

      expect(activeAlerts.length).toBe(1);
      expect(activeAlerts[0].alertingTrooperId).toBe('trooper-2');
    });
  });

  describe('Statistics', () => {
    it('should return correct stats', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position);
      alertSystem.broadcastAlert('trooper-2', 'player-1', position);

      const stats = alertSystem.getStats();

      expect(stats.totalAlerts).toBe(2);
      expect(stats.activeAlerts).toBe(2);
      expect(stats.cooldowningTroopers).toBe(2);
    });

    it('should track active vs total alerts correctly', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position);

      vi.advanceTimersByTime(31000);

      alertSystem.broadcastAlert('trooper-2', 'player-1', position);

      const stats = alertSystem.getStats();

      expect(stats.totalAlerts).toBe(2);
      expect(stats.activeAlerts).toBe(1);
    });
  });

  describe('Reset', () => {
    it('should clear all alerts and cooldowns', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position);
      alertSystem.broadcastAlert('trooper-2', 'player-1', position);

      alertSystem.reset();

      const stats = alertSystem.getStats();
      expect(stats.totalAlerts).toBe(0);
      expect(stats.cooldowningTroopers).toBe(0);
    });

    it('should allow broadcasts after reset', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position);
      alertSystem.reset();

      // Should be able to broadcast immediately (cooldown cleared)
      const alert = alertSystem.broadcastAlert('trooper-1', 'player-1', position);

      expect(alert).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle alert at exact radius boundary (same outpost)', () => {
      const alertPosition: Vector3 = { x: 0, y: 0, z: 0 };
      const trooperPosition: Vector3 = { x: 300, y: 0, z: 0 }; // Exactly 300m

      alertSystem.broadcastAlert('trooper-1', 'player-1', alertPosition, 'outpost-1');

      const alerts = alertSystem.getAlertsForTrooper('trooper-2', trooperPosition, 'outpost-1');

      expect(alerts.length).toBe(1);
    });

    it('should handle alert at exact radius boundary (cross-outpost)', () => {
      const alertPosition: Vector3 = { x: 0, y: 0, z: 0 };
      const trooperPosition: Vector3 = { x: 500, y: 0, z: 0 }; // Exactly 500m

      alertSystem.broadcastAlert('trooper-1', 'player-1', alertPosition, 'outpost-1');

      const alerts = alertSystem.getAlertsForTrooper('trooper-2', trooperPosition, 'outpost-2');

      expect(alerts.length).toBe(1);
    });

    it('should handle trooper with no outpost', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position);

      // Trooper with no outpost uses cross-outpost radius
      const alerts = alertSystem.getAlertsForTrooper('trooper-2', position);

      expect(alerts.length).toBe(1);
    });

    it('should handle multiple alerts for same player', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position, 'outpost-1');
      alertSystem.broadcastAlert('trooper-2', 'player-1', { x: 120, y: 0, z: 100 }, 'outpost-1');

      const alerts = alertSystem.getAlertsForTrooper('trooper-3', position, 'outpost-1');

      expect(alerts.length).toBe(2);
      expect(alerts.every(a => a.playerId === 'player-1')).toBe(true);
    });

    it('should handle alerts for different players', () => {
      const position: Vector3 = { x: 100, y: 0, z: 100 };

      alertSystem.broadcastAlert('trooper-1', 'player-1', position, 'outpost-1');
      alertSystem.broadcastAlert('trooper-2', 'player-2', position, 'outpost-1');

      const alerts = alertSystem.getAlertsForTrooper('trooper-3', position, 'outpost-1');

      expect(alerts.length).toBe(2);
      const playerIds = alerts.map(a => a.playerId);
      expect(playerIds).toContain('player-1');
      expect(playerIds).toContain('player-2');
    });
  });
});
