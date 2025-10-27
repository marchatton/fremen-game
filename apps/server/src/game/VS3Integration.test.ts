import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Room } from './Room';
import { GameLoop } from './GameLoop';
import type { RoomPlayer } from './Room';
import { PlayerStateEnum, ECONOMY_CONSTANTS, EquipmentType, EQUIPMENT_CATALOG } from '@fremen/shared';
import type { Socket } from 'socket.io';
import { InMemoryPlayerRepository } from './testing/InMemoryPlayerRepository';

describe('VS3: Resource Loop Integration (End-to-End)', () => {
  let room: Room;
  let gameLoop: GameLoop;
  let player: RoomPlayer;
  let repository: InMemoryPlayerRepository;

  beforeEach(async () => {
    vi.useFakeTimers();

    repository = new InMemoryPlayerRepository();
    room = new Room('test-room', repository);
    gameLoop = new GameLoop(room, 12345, repository);

    const mockSocket = {
      emit: vi.fn(),
      on: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as Socket;

    await room.addPlayer(mockSocket, 'player1', 'TestPlayer');
    player = room.getPlayer('player1')!;

    gameLoop.start();
  });

  afterEach(() => {
    gameLoop.stop();
    vi.useRealTimers();
  });

  describe('Spice Harvesting Flow', () => {
    it('should complete full harvest cycle: find node → start harvest → wait 3s → complete', async () => {
      // Find nearby spice node
      const nodes = (gameLoop as any).spiceManager.getNodes();
      const nearbyNode = nodes.find((n: any) =>
        Math.abs(n.position.x) < 50 && Math.abs(n.position.z) < 50
      );
      expect(nearbyNode).toBeDefined();

      // Move player near node
      player.state.position = {
        x: nearbyNode.position.x + 1,
        y: 0,
        z: nearbyNode.position.z + 1
      };

      const initialSpice = player.resources.spice;

      // Start harvest
      const sessionId = (gameLoop as any).spiceManager.startHarvest(
        'player1',
        nearbyNode.id,
        player.state.position
      );
      expect(sessionId).toBeDefined();

      // Wait 3 seconds
      vi.advanceTimersByTime(3000);
      (gameLoop as any).spiceManager.update(3);

      // Complete harvest
      const result = (gameLoop as any).spiceManager.completeHarvest(sessionId);
      expect(result.success).toBe(true);
      expect(result.amount).toBe(ECONOMY_CONSTANTS.SPICE_HARVEST_AMOUNT);

      // Player should have gained spice (would need to update player.resources.spice manually in real game)
      // In actual integration, this would be handled by a handler
    });

    it('should handle multiple harvest cycles on same node', async () => {
      const nodes = (gameLoop as any).spiceManager.getNodes();
      const node = nodes[0];
      player.state.position = { ...node.position };

      let totalHarvested = 0;

      for (let i = 0; i < 5; i++) {
        const sessionId = (gameLoop as any).spiceManager.startHarvest(
          'player1',
          node.id,
          player.state.position
        );

        if (!sessionId) break; // Node depleted

        vi.advanceTimersByTime(3000);
        (gameLoop as any).spiceManager.update(3);

        const result = (gameLoop as any).spiceManager.completeHarvest(sessionId);
        if (result.success) {
          totalHarvested += result.amount;
        }
      }

      expect(totalHarvested).toBeGreaterThan(0);
    });

    it('should deplete node and trigger respawn timer', async () => {
      const nodes = (gameLoop as any).spiceManager.getNodes();
      const node = nodes[0];
      player.state.position = { ...node.position };

      // Deplete node (harvest until empty)
      for (let i = 0; i < 15; i++) {
        const sessionId = (gameLoop as any).spiceManager.startHarvest(
          'player1',
          node.id,
          player.state.position
        );

        if (!sessionId) break;

        vi.advanceTimersByTime(3000);
        (gameLoop as any).spiceManager.update(3);
        (gameLoop as any).spiceManager.completeHarvest(sessionId);
      }

      const depletedNode = (gameLoop as any).spiceManager.getNode(node.id);
      expect(depletedNode.state).toBe('DEPLETED');
      expect(depletedNode.respawnAt).toBeDefined();
    }, 60000);
  });

  describe('Water Depletion & Survival', () => {
    it('should deplete water over time during active gameplay', async () => {
      const initialWater = player.resources.water;
      player.state.state = PlayerStateEnum.ACTIVE;

      // Simulate 5 minutes of gameplay
      for (let i = 0; i < 300; i++) {
        vi.advanceTimersByTime(1000);
        (gameLoop as any).tick();
      }

      expect(player.resources.water).toBeLessThan(initialWater);
    });

    it('should deplete water faster when running', async () => {
      player.state.state = PlayerStateEnum.ACTIVE;
      player.state.velocity = { x: 10, y: 0, z: 10 }; // Running

      const initialWater = player.resources.water;

      // Simulate 2 minutes of running
      for (let i = 0; i < 120; i++) {
        vi.advanceTimersByTime(1000);
        (gameLoop as any).tick();
      }

      const waterLost = initialWater - player.resources.water;
      expect(waterLost).toBeGreaterThan(3); // Should lose significant water
    });

    it('should deplete water slower when riding worm', async () => {
      // Mount worm
      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms[0];
      worm.controlPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 1 },
        { x: 2, y: 0, z: 2 },
      ];
      player.state.position = { x: 0, y: 0, z: 0 };

      gameLoop.handleMountAttempt('player1', worm.id);
      expect(player.state.state).toBe(PlayerStateEnum.RIDING);

      const initialWater = player.resources.water;

      // Simulate 2 minutes of riding
      for (let i = 0; i < 120; i++) {
        vi.advanceTimersByTime(1000);
        (gameLoop as any).tick();
      }

      const waterLost = initialWater - player.resources.water;
      expect(waterLost).toBeLessThan(1); // Minimal water loss
    });

    it('should reduce water depletion with stillsuit equipped', async () => {
      // Equip basic stillsuit from catalog
      player.resources.equipment.body = EQUIPMENT_CATALOG['basic-stillsuit'];

      player.resources.water = 100;

      // Simulate 2 minutes
      for (let i = 0; i < 120; i++) {
        vi.advanceTimersByTime(1000);
        (gameLoop as any).tick();
      }

      const waterWithSuit = player.resources.water;

      // Remove stillsuit and reset water
      player.resources.equipment.body = undefined;
      player.resources.water = 100;

      // Simulate 2 minutes without suit
      for (let i = 0; i < 120; i++) {
        vi.advanceTimersByTime(1000);
        (gameLoop as any).tick();
      }

      const waterWithoutSuit = player.resources.water;

      expect(waterWithSuit).toBeGreaterThan(waterWithoutSuit);
    });

    it('should apply health drain when water is critically low', async () => {
      player.resources.water = 5; // Severe thirst
      const initialHealth = player.health;

      // Simulate 10 seconds
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(1000);
        (gameLoop as any).tick();
      }

      expect(player.health).toBeLessThan(initialHealth);
    });
  });

  describe('Oasis Refill System', () => {
    it('should refill water at oasis', async () => {
      const oases = (gameLoop as any).oasisManager.getOases();
      const oasis = oases[0];

      // Deplete water
      player.resources.water = 30;
      player.state.position = { ...oasis.position };

      const result = (gameLoop as any).oasisManager.refillWater(
        'player1',
        oasis.id,
        player.resources.water,
        player.state.position
      );

      expect(result.success).toBe(true);
      expect(result.newWater).toBeGreaterThan(30);
      expect(result.newWater).toBeLessThanOrEqual(100);
    });

    it('should enforce 5-minute cooldown per oasis', async () => {
      const oases = (gameLoop as any).oasisManager.getOases();
      const oasis = oases[0];

      player.resources.water = 50;
      player.state.position = { ...oasis.position };

      // First refill
      const result1 = (gameLoop as any).oasisManager.refillWater(
        'player1',
        oasis.id,
        player.resources.water,
        player.state.position
      );
      expect(result1.success).toBe(true);

      // Immediate second attempt
      const result2 = (gameLoop as any).oasisManager.refillWater(
        'player1',
        oasis.id,
        result1.newWater,
        player.state.position
      );
      expect(result2.success).toBe(false);
      expect(result2.message).toContain('cooldown');

      // Wait 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Should work now
      const result3 = (gameLoop as any).oasisManager.refillWater(
        'player1',
        oasis.id,
        50,
        player.state.position
      );
      expect(result3.success).toBe(true);
    });

    it('should allow visiting different oases without cooldown', async () => {
      const oases = (gameLoop as any).oasisManager.getOases();
      player.resources.water = 30;

      // Visit oasis 1
      player.state.position = { ...oases[0].position };
      const result1 = (gameLoop as any).oasisManager.refillWater(
        'player1',
        oases[0].id,
        player.resources.water,
        player.state.position
      );
      expect(result1.success).toBe(true);

      // Immediately visit oasis 2
      player.state.position = { ...oases[1].position };
      const result2 = (gameLoop as any).oasisManager.refillWater(
        'player1',
        oases[1].id,
        result1.newWater,
        player.state.position
      );
      expect(result2.success).toBe(true);
    });
  });

  describe('Merchant & Equipment System', () => {
    it('should allow buying equipment at Sietch', async () => {
      const sietchPos = (gameLoop as any).sietchManager.getSietchPosition();
      player.state.position = { ...sietchPos };
      player.resources.spice = 100;

      // Check if can trade
      const canTrade = (gameLoop as any).sietchManager.canTrade(player.state.position);
      expect(canTrade).toBe(true);

      // Buy basic stillsuit
      const result = (gameLoop as any).sietchManager.buyItem(
        'basic-stillsuit',
        player.resources.spice,
        player.resources.inventory
      );

      expect(result.success).toBe(true);
      expect(result.newSpice).toBe(50); // 100 - 50
      expect(result.inventory.length).toBeGreaterThan(0);
    });

    it('should reject trade outside Sietch safe zone', async () => {
      player.state.position = { x: 500, y: 0, z: 500 }; // Far away
      player.resources.spice = 100;

      const canTrade = (gameLoop as any).sietchManager.canTrade(player.state.position);
      expect(canTrade).toBe(false);
    });

    it('should allow selling equipment for spice', async () => {
      // Clear inventory and add only stillsuit
      player.resources.inventory = [{
        id: 'inv-1',
        type: EquipmentType.STILLSUIT,
        tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
        quantity: 1
      }];
      player.resources.spice = 0;

      const sietchPos = (gameLoop as any).sietchManager.getSietchPosition();
      player.state.position = { ...sietchPos };

      const result = (gameLoop as any).sietchManager.sellItem(
        'basic-stillsuit',
        player.resources.spice,
        player.resources.inventory
      );

      expect(result.success).toBe(true);
      expect(result.newSpice).toBeGreaterThan(0);
      expect(result.inventory.length).toBe(0);
    });

    it('should equip item from inventory and apply stats', async () => {
      // Clear inventory and add only stillsuit
      player.resources.inventory = [{
        id: 'inv-1',
        type: EquipmentType.STILLSUIT,
        tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
        quantity: 1
      }];

      const result = (gameLoop as any).equipmentManager.equipItem(
        'basic-stillsuit',
        player.resources.equipment,
        player.resources.inventory
      );

      expect(result.success).toBe(true);
      expect(result.equipment.body).toBeDefined();
      expect(result.inventory.length).toBe(0);

      // Check water reduction
      const waterReduction = (gameLoop as any).equipmentManager.calculateWaterReduction(
        result.equipment
      );
      expect(waterReduction).toBe(0.25);
    });
  });

  describe('Objective Completion & Rewards', () => {
    it('should grant rewards when completing objective on worm', async () => {
      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms[0];
      worm.controlPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 1 },
        { x: 2, y: 0, z: 2 },
      ];

      // Mount worm
      player.state.position = { x: 0, y: 0, z: 0 };
      gameLoop.handleMountAttempt('player1', worm.id);

      const initialSpice = player.resources.spice;
      const initialWater = player.resources.water;
      const initialObjectives = player.resources.stats.objectivesCompleted;

      // Position worm at objective
      const objective = (gameLoop as any).objectiveManager.getActiveObjective();
      if (objective) {
        worm.controlPoints[0] = { ...objective.targetPosition, y: 0 };

        // Tick to trigger objective check
        (gameLoop as any).tick();

        expect(player.resources.spice).toBe(initialSpice + ECONOMY_CONSTANTS.OBJECTIVE_REWARD_SPICE);
        expect(player.resources.water).toBeGreaterThanOrEqual(initialWater); // May be clamped at 100
        expect(player.resources.stats.objectivesCompleted).toBe(initialObjectives + 1);
        expect(player.resources.stats.totalSpiceEarned).toBeGreaterThan(0);
      }
    });
  });

  describe('Death & Respawn System', () => {
    it('should trigger death when water reaches 0', async () => {
      player.resources.water = 0;
      player.state.position = { x: 100, y: 0, z: 200 };
      const initialSpice = player.resources.spice = 100;

      // Trigger game tick
      (gameLoop as any).tick();

      // Player should be respawned at Sietch (x=0, z=0)
      expect(player.state.position.x).toBe(0);
      expect(player.state.position.z).toBe(0);
      expect(player.resources.water).toBe(50); // Respawn water
      expect(player.health).toBe(100);
      expect(player.resources.spice).toBeLessThan(initialSpice); // Lost 20%
      expect(player.resources.stats.deaths).toBe(1);
    });

    it('should create corpse marker with dropped spice', async () => {
      player.resources.water = 0;
      player.resources.spice = 100;
      player.state.position = { x: 100, y: 0, z: 200 };

      (gameLoop as any).tick();

      const corpses = (gameLoop as any).deathManager.getAllActiveCorpses();
      const playerCorpse = corpses.find((c: any) => c.playerId === 'player1');

      expect(playerCorpse).toBeDefined();
      expect(playerCorpse.spiceAmount).toBe(20); // 20% of 100
      expect(playerCorpse.position.x).toBeCloseTo(100, 0);
      expect(playerCorpse.position.z).toBeCloseTo(200, 0);
    });

    it('should allow recovering corpse within 2 minutes', async () => {
      // Die
      player.resources.water = 0;
      player.resources.spice = 100;
      const deathPos = { x: 100, y: 0, z: 200 };
      player.state.position = { ...deathPos };

      (gameLoop as any).tick();

      const corpses = (gameLoop as any).deathManager.getAllActiveCorpses();
      const corpse = corpses[0];

      // Travel back to corpse (respawned at Sietch, need to go back)
      player.state.position = { ...deathPos };

      const recoveryResult = (gameLoop as any).deathManager.recoverCorpse(
        'player1',
        corpse.id,
        player.state.position
      );

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.spiceRecovered).toBe(20);
    });

    it('should expire corpse after 2 minutes', async () => {
      player.resources.water = 0;
      player.resources.spice = 100;
      player.state.position = { x: 100, y: 0, z: 200 };

      (gameLoop as any).tick();

      const corpses = (gameLoop as any).deathManager.getAllActiveCorpses();
      const corpse = corpses[0];

      // Wait 2 minutes
      vi.advanceTimersByTime(2 * 60 * 1000);

      const expiredCorpse = (gameLoop as any).deathManager.getCorpseMarker(corpse.id);
      expect(expiredCorpse).toBeUndefined();
    });

    it('should trigger death from health drain at low water', async () => {
      player.resources.water = 5; // Severe thirst
      player.health = 10;
      player.state.position = { x: 100, y: 0, z: 200 };

      // Run enough ticks to drain health
      for (let i = 0; i < 15; i++) {
        vi.advanceTimersByTime(1000);
        (gameLoop as any).tick();
      }

      // Should have respawned at Sietch (x=0, z=0)
      expect(player.state.position.x).toBe(0);
      expect(player.state.position.z).toBe(0);
      expect(player.health).toBe(100);
    });
  });

  describe('Stat Tracking', () => {
    it('should track distance traveled', async () => {
      const initialDistance = player.resources.stats.distanceTraveled;

      player.state.position = { x: 0, y: 0, z: 0 };
      player.state.velocity = { x: 10, y: 0, z: 0 };

      // Move for 10 ticks
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(1000 / 60); // 60fps
        (gameLoop as any).tick();
      }

      expect(player.resources.stats.distanceTraveled).toBeGreaterThan(initialDistance);
    });

    it('should track worms ridden stat on mount', async () => {
      const initialWormsRidden = player.resources.stats.wormsRidden;

      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms[0];
      worm.controlPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 1 },
        { x: 2, y: 0, z: 2 },
      ];
      player.state.position = { x: 0, y: 0, z: 0 };

      gameLoop.handleMountAttempt('player1', worm.id);

      expect(player.resources.stats.wormsRidden).toBe(initialWormsRidden + 1);
    });

    it('should not increment worms ridden on failed mount', async () => {
      const initialWormsRidden = player.resources.stats.wormsRidden;

      const result = gameLoop.handleMountAttempt('player1', 'nonexistent-worm');

      expect(result.success).toBe(false);
      expect(player.resources.stats.wormsRidden).toBe(initialWormsRidden);
    });
  });

  describe('Complete Gameplay Session', () => {
    it('should complete full resource loop: harvest → buy → equip → objective → death → recover', async () => {
      // 1. Harvest spice
      const nodes = (gameLoop as any).spiceManager.getNodes();
      const node = nodes.find((n: any) => Math.abs(n.position.x) < 50);
      player.state.position = { ...node.position };

      const sessionId = (gameLoop as any).spiceManager.startHarvest(
        'player1',
        node.id,
        player.state.position
      );
      vi.advanceTimersByTime(3000);
      (gameLoop as any).spiceManager.update(3);
      const harvestResult = (gameLoop as any).spiceManager.completeHarvest(sessionId);
      player.resources.spice += harvestResult.amount;

      expect(player.resources.spice).toBeGreaterThan(0);

      // 2. Travel to Sietch and buy stillsuit
      const sietchPos = (gameLoop as any).sietchManager.getSietchPosition();
      player.state.position = { ...sietchPos };
      player.resources.spice = 50; // Ensure enough

      const buyResult = (gameLoop as any).sietchManager.buyItem(
        'basic-stillsuit',
        player.resources.spice,
        player.resources.inventory
      );
      player.resources.spice = buyResult.newSpice;
      player.resources.inventory = buyResult.inventory;

      expect(buyResult.success).toBe(true);

      // 3. Equip stillsuit
      const equipResult = (gameLoop as any).equipmentManager.equipItem(
        'basic-stillsuit',
        player.resources.equipment,
        player.resources.inventory
      );
      player.resources.equipment = equipResult.equipment;
      player.resources.inventory = equipResult.inventory;

      expect(equipResult.equipment.body).toBeDefined();

      // 4. Complete objective on worm
      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms[0];
      worm.controlPoints = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 2 }];
      player.state.position = { x: 0, y: 0, z: 0 };

      gameLoop.handleMountAttempt('player1', worm.id);

      const objective = (gameLoop as any).objectiveManager.getActiveObjective();
      if (objective) {
        worm.controlPoints[0] = { ...objective.targetPosition, y: 0 };
        (gameLoop as any).tick();
      }

      expect(player.resources.stats.objectivesCompleted).toBeGreaterThan(0);

      // 5. Die from water depletion
      player.resources.water = 0;
      const deathPos = { x: 200, y: 0, z: 300 };
      player.state.position = { ...deathPos };
      const spiceBeforeDeath = player.resources.spice;

      (gameLoop as any).tick();

      expect(player.resources.spice).toBeLessThan(spiceBeforeDeath);
      expect(player.state.position.x).toBe(0);
      expect(player.state.position.z).toBe(0);

      // 6. Recover corpse
      const corpses = (gameLoop as any).deathManager.getAllActiveCorpses();
      const corpse = corpses.find((c: any) => c.playerId === 'player1');
      expect(corpse).toBeDefined();

      // Travel exactly to corpse position
      player.state.position = { x: corpse.position.x, y: 0, z: corpse.position.z };

      const recoveryResult = (gameLoop as any).deathManager.recoverCorpse(
        'player1',
        corpse.id,
        player.state.position
      );

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.spiceRecovered).toBeGreaterThan(0);

      // Verify final state
      expect(player.resources.stats.deaths).toBe(1);
      expect(player.resources.stats.wormsRidden).toBeGreaterThan(0);
      expect(player.resources.equipment.body).toBeDefined();
    }, 60000);
  });

  describe('Multi-System Interactions', () => {
    it('should reduce water loss significantly with advanced stillsuit', async () => {
      // Equip advanced stillsuit (75% reduction)
      player.resources.equipment.body = EQUIPMENT_CATALOG['advanced-stillsuit'];

      player.resources.water = 100;

      // Run for 5 minutes
      for (let i = 0; i < 300; i++) {
        vi.advanceTimersByTime(1000);
        (gameLoop as any).tick();
      }

      // Should have lost minimal water
      expect(player.resources.water).toBeGreaterThan(95);
    });

    it('should handle oasis hopping strategy to maintain water', async () => {
      const oases = (gameLoop as any).oasisManager.getOases();
      player.resources.water = 50;

      // Visit all oases
      for (const oasis of oases) {
        player.state.position = { ...oasis.position };
        const result = (gameLoop as any).oasisManager.refillWater(
          'player1',
          oasis.id,
          player.resources.water,
          player.state.position
        );
        if (result.success) {
          player.resources.water = result.newWater;
        }
      }

      expect(player.resources.water).toBe(100);
    });

    it('should allow upgrading equipment: sell basic → buy improved', async () => {
      const sietchPos = (gameLoop as any).sietchManager.getSietchPosition();
      player.state.position = { ...sietchPos };

      // Start with basic stillsuit in inventory
      player.resources.inventory = [{
        id: 'inv-1',
        type: EquipmentType.STILLSUIT,
        tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
        quantity: 1
      }];
      player.resources.spice = 200; // Need enough for improved (200 spice)

      // Sell basic stillsuit (gets back 25 spice = 50% of 50)
      const sellResult = (gameLoop as any).sietchManager.sellItem(
        'basic-stillsuit',
        player.resources.spice,
        player.resources.inventory
      );
      expect(sellResult.success).toBe(true);
      player.resources.spice = sellResult.newSpice;
      player.resources.inventory = sellResult.inventory;

      // Buy improved stillsuit (costs 200 spice)
      const buyResult = (gameLoop as any).sietchManager.buyItem(
        'improved-stillsuit',
        player.resources.spice,
        player.resources.inventory
      );
      player.resources.spice = buyResult.newSpice;
      player.resources.inventory = buyResult.inventory;

      expect(buyResult.success).toBe(true);
      expect(buyResult.inventory.length).toBe(1);
      expect(buyResult.inventory[0].tier).toBe('IMPROVED');
    });
  });
});
