import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpiceManager } from './SpiceManager.js';
import { SpiceNodeState, ECONOMY_CONSTANTS } from '@fremen/shared';
import type { Vector3 } from '@fremen/shared';

describe('VS3: Spice Harvesting System', () => {
  let manager: SpiceManager;

  beforeEach(() => {
    manager = new SpiceManager(42, 1000);
  });

  describe('Node Generation', () => {
    it('should generate nodes procedurally based on seed', () => {
      const nodes = manager.generateNodes();

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0].id).toBe('spice-node-0');
      expect(nodes[0].supply).toBe(ECONOMY_CONSTANTS.SPICE_NODE_MAX_SUPPLY);
      expect(nodes[0].state).toBe(SpiceNodeState.ACTIVE);
    });

    it('should generate deterministic positions with same seed', () => {
      const manager1 = new SpiceManager(123, 1000);
      const manager2 = new SpiceManager(123, 1000);

      const nodes1 = manager1.generateNodes();
      const nodes2 = manager2.generateNodes();

      expect(nodes1.length).toBe(nodes2.length);
      expect(nodes1[0].position.x).toBe(nodes2[0].position.x);
      expect(nodes1[0].position.z).toBe(nodes2[0].position.z);
    });

    it('should generate different positions with different seeds', () => {
      const manager1 = new SpiceManager(123, 1000);
      const manager2 = new SpiceManager(456, 1000);

      const nodes1 = manager1.generateNodes();
      const nodes2 = manager2.generateNodes();

      expect(nodes1[0].position.x).not.toBe(nodes2[0].position.x);
    });

    it('should generate approximately 1 node per 100m²', () => {
      const worldSize = 1000;
      const expectedCount = (worldSize * worldSize) / 100;

      manager = new SpiceManager(42, worldSize);
      const nodes = manager.generateNodes();

      expect(nodes.length).toBe(expectedCount);
    });

    it('should generate nodes within world bounds', () => {
      const worldSize = 500;
      manager = new SpiceManager(42, worldSize);
      const nodes = manager.generateNodes();

      nodes.forEach(node => {
        expect(Math.abs(node.position.x)).toBeLessThanOrEqual(worldSize / 2);
        expect(Math.abs(node.position.z)).toBeLessThanOrEqual(worldSize / 2);
      });
    });

    it('should set y position to 0 for all nodes', () => {
      const nodes = manager.generateNodes();

      nodes.forEach(node => {
        expect(node.position.y).toBe(0);
      });
    });

    it('should initialize all nodes as ACTIVE', () => {
      const nodes = manager.generateNodes();

      nodes.forEach(node => {
        expect(node.state).toBe(SpiceNodeState.ACTIVE);
        expect(node.supply).toBe(ECONOMY_CONSTANTS.SPICE_NODE_MAX_SUPPLY);
      });
    });
  });

  describe('Harvest Interaction', () => {
    let nodePosition: Vector3;
    let nodeId: string;

    beforeEach(() => {
      const nodes = manager.generateNodes();
      nodeId = nodes[0].id;
      nodePosition = nodes[0].position;
    });

    it('should allow harvest when player is within range', () => {
      const playerPosition = { ...nodePosition };
      const sessionId = manager.startHarvest('player1', nodeId, playerPosition);

      expect(sessionId).not.toBeNull();
      expect(sessionId).toContain('harvest-player1');
    });

    it('should reject harvest when player is too far', () => {
      const playerPosition: Vector3 = {
        x: nodePosition.x + 10,
        y: 0,
        z: nodePosition.z + 10,
      };

      const sessionId = manager.startHarvest('player1', nodeId, playerPosition);

      expect(sessionId).toBeNull();
    });

    it('should reject harvest at exactly distance + 0.1m (boundary)', () => {
      const distance = ECONOMY_CONSTANTS.HARVEST_DISTANCE + 0.1;
      const playerPosition: Vector3 = {
        x: nodePosition.x + distance,
        y: 0,
        z: nodePosition.z,
      };

      const sessionId = manager.startHarvest('player1', nodeId, playerPosition);

      expect(sessionId).toBeNull();
    });

    it('should allow harvest at exactly harvest distance (boundary)', () => {
      const distance = ECONOMY_CONSTANTS.HARVEST_DISTANCE;
      const playerPosition: Vector3 = {
        x: nodePosition.x + distance,
        y: 0,
        z: nodePosition.z,
      };

      const sessionId = manager.startHarvest('player1', nodeId, playerPosition);

      expect(sessionId).not.toBeNull();
    });

    it('should reject harvest when node does not exist', () => {
      const sessionId = manager.startHarvest('player1', 'nonexistent-node', nodePosition);

      expect(sessionId).toBeNull();
    });

    it('should reject harvest when node is depleted', () => {
      const node = manager.getNode(nodeId)!;
      node.state = SpiceNodeState.DEPLETED;
      node.supply = 0;

      const sessionId = manager.startHarvest('player1', nodeId, nodePosition);

      expect(sessionId).toBeNull();
    });

    it('should reject harvest when player already has active session', () => {
      const session1 = manager.startHarvest('player1', nodeId, nodePosition);
      expect(session1).not.toBeNull();

      const nodes = manager.generateNodes();
      const node2 = nodes[1];
      const session2 = manager.startHarvest('player1', node2.id, node2.position);

      expect(session2).toBeNull();
    });

    it('should allow multiple players to harvest same node', () => {
      const session1 = manager.startHarvest('player1', nodeId, nodePosition);
      const session2 = manager.startHarvest('player2', nodeId, nodePosition);

      expect(session1).not.toBeNull();
      expect(session2).not.toBeNull();
    });
  });

  describe('Harvest Completion', () => {
    let nodeId: string;
    let nodePosition: Vector3;

    beforeEach(() => {
      const nodes = manager.generateNodes();
      nodeId = nodes[0].id;
      nodePosition = nodes[0].position;
    });

    it('should complete harvest after sufficient time', async () => {
      const sessionId = manager.startHarvest('player1', nodeId, nodePosition)!;

      // Wait for harvest duration
      await new Promise(resolve => setTimeout(resolve, ECONOMY_CONSTANTS.HARVEST_DURATION + 10));

      const result = manager.completeHarvest(sessionId);

      expect(result.success).toBe(true);
      expect(result.amount).toBe(ECONOMY_CONSTANTS.SPICE_HARVEST_AMOUNT);
    });

    it('should fail harvest if not enough time has passed', () => {
      const sessionId = manager.startHarvest('player1', nodeId, nodePosition)!;

      const result = manager.completeHarvest(sessionId);

      expect(result.success).toBe(false);
      expect(result.amount).toBe(0);
    });

    it('should reduce node supply by harvest amount', async () => {
      const initialSupply = manager.getNode(nodeId)!.supply;
      const sessionId = manager.startHarvest('player1', nodeId, nodePosition)!;

      await new Promise(resolve => setTimeout(resolve, ECONOMY_CONSTANTS.HARVEST_DURATION + 10));
      manager.completeHarvest(sessionId);

      const node = manager.getNode(nodeId)!;
      expect(node.supply).toBe(initialSupply - ECONOMY_CONSTANTS.SPICE_HARVEST_AMOUNT);
    });

    it('should track last harvested player', async () => {
      const sessionId = manager.startHarvest('player1', nodeId, nodePosition)!;

      await new Promise(resolve => setTimeout(resolve, ECONOMY_CONSTANTS.HARVEST_DURATION + 10));
      manager.completeHarvest(sessionId);

      const node = manager.getNode(nodeId)!;
      expect(node.lastHarvestedBy).toBe('player1');
    });

    it('should remove session after completion', async () => {
      const sessionId = manager.startHarvest('player1', nodeId, nodePosition)!;

      await new Promise(resolve => setTimeout(resolve, ECONOMY_CONSTANTS.HARVEST_DURATION + 10));
      manager.completeHarvest(sessionId);

      const session = manager.getPlayerHarvestSession('player1');
      expect(session).toBeUndefined();
    });

    it('should handle non-existent session gracefully', () => {
      const result = manager.completeHarvest('nonexistent-session');

      expect(result.success).toBe(false);
      expect(result.amount).toBe(0);
    });
  });

  describe('Node Depletion', () => {
    let nodeId: string;
    let nodePosition: Vector3;

    beforeEach(() => {
      const nodes = manager.generateNodes();
      nodeId = nodes[0].id;
      nodePosition = nodes[0].position;
    });

    it('should deplete node when supply reaches 0', async () => {
      const harvestsNeeded = ECONOMY_CONSTANTS.SPICE_NODE_MAX_SUPPLY / ECONOMY_CONSTANTS.SPICE_HARVEST_AMOUNT;

      for (let i = 0; i < harvestsNeeded; i++) {
        const sessionId = manager.startHarvest(`player${i}`, nodeId, nodePosition)!;
        await new Promise(resolve => setTimeout(resolve, ECONOMY_CONSTANTS.HARVEST_DURATION + 10));
        manager.completeHarvest(sessionId);
      }

      const node = manager.getNode(nodeId)!;
      expect(node.state).toBe(SpiceNodeState.DEPLETED);
      expect(node.supply).toBe(0);
    }, 35000); // 10 harvests * 3s each + buffer

    it('should set respawn timer when depleted', async () => {
      const node = manager.getNode(nodeId)!;
      node.supply = ECONOMY_CONSTANTS.SPICE_HARVEST_AMOUNT; // Only one harvest left

      const sessionId = manager.startHarvest('player1', nodeId, nodePosition)!;
      await new Promise(resolve => setTimeout(resolve, ECONOMY_CONSTANTS.HARVEST_DURATION + 10));
      manager.completeHarvest(sessionId);

      const depletedNode = manager.getNode(nodeId)!;
      expect(depletedNode.respawnAt).toBeDefined();
      expect(depletedNode.respawnAt).toBeGreaterThan(Date.now());
    });

    it('should reject harvest attempts on depleted nodes', async () => {
      const node = manager.getNode(nodeId)!;
      node.state = SpiceNodeState.DEPLETED;
      node.supply = 0;

      const sessionId = manager.startHarvest('player1', nodeId, nodePosition);

      expect(sessionId).toBeNull();
    });

    it('should handle partial harvest when supply < harvest amount', async () => {
      const node = manager.getNode(nodeId)!;
      node.supply = 5; // Less than SPICE_HARVEST_AMOUNT (10)

      const sessionId = manager.startHarvest('player1', nodeId, nodePosition)!;
      await new Promise(resolve => setTimeout(resolve, ECONOMY_CONSTANTS.HARVEST_DURATION + 10));
      const result = manager.completeHarvest(sessionId);

      expect(result.success).toBe(true);
      expect(result.amount).toBe(5); // Only get what's available
      expect(node.supply).toBe(0);
      expect(node.state).toBe(SpiceNodeState.DEPLETED);
    });
  });

  describe('Node Respawn', () => {
    let nodeId: string;
    let nodePosition: Vector3;

    beforeEach(() => {
      const nodes = manager.generateNodes();
      nodeId = nodes[0].id;
      nodePosition = nodes[0].position;
    });

    it('should respawn node after respawn timer expires', async () => {
      const node = manager.getNode(nodeId)!;
      node.state = SpiceNodeState.DEPLETED;
      node.supply = 0;
      node.respawnAt = Date.now() + 100; // 100ms for testing

      await new Promise(resolve => setTimeout(resolve, 150));
      manager.update(0);

      const respawnedNode = manager.getNode(nodeId)!;
      expect(respawnedNode.state).toBe(SpiceNodeState.ACTIVE);
      expect(respawnedNode.supply).toBe(ECONOMY_CONSTANTS.SPICE_NODE_MAX_SUPPLY);
      expect(respawnedNode.respawnAt).toBeUndefined();
    });

    it('should not respawn node before timer expires', () => {
      const node = manager.getNode(nodeId)!;
      node.state = SpiceNodeState.DEPLETED;
      node.supply = 0;
      node.respawnAt = Date.now() + 10000; // 10 seconds

      manager.update(0);

      const stillDepletedNode = manager.getNode(nodeId)!;
      expect(stillDepletedNode.state).toBe(SpiceNodeState.DEPLETED);
      expect(stillDepletedNode.supply).toBe(0);
    });

    it('should reset lastHarvestedBy on respawn', async () => {
      const node = manager.getNode(nodeId)!;
      node.state = SpiceNodeState.DEPLETED;
      node.supply = 0;
      node.lastHarvestedBy = 'player1';
      node.respawnAt = Date.now() + 100;

      await new Promise(resolve => setTimeout(resolve, 150));
      manager.update(0);

      const respawnedNode = manager.getNode(nodeId)!;
      expect(respawnedNode.lastHarvestedBy).toBeUndefined();
    });
  });

  describe('Session Management', () => {
    let nodeId: string;
    let nodePosition: Vector3;

    beforeEach(() => {
      const nodes = manager.generateNodes();
      nodeId = nodes[0].id;
      nodePosition = nodes[0].position;
    });

    it('should cancel harvest session', () => {
      const sessionId = manager.startHarvest('player1', nodeId, nodePosition)!;
      manager.cancelHarvest(sessionId);

      const session = manager.getPlayerHarvestSession('player1');
      expect(session).toBeUndefined();
    });

    it('should handle cancelling non-existent session gracefully', () => {
      expect(() => {
        manager.cancelHarvest('nonexistent-session');
      }).not.toThrow();
    });

    it('should cancel all player harvests', () => {
      manager.startHarvest('player1', nodeId, nodePosition);

      manager.cancelPlayerHarvests('player1');

      const session = manager.getPlayerHarvestSession('player1');
      expect(session).toBeUndefined();
    });

    it('should get active harvest session for player', () => {
      const sessionId = manager.startHarvest('player1', nodeId, nodePosition)!;

      const session = manager.getPlayerHarvestSession('player1');

      expect(session).toBeDefined();
      expect(session!.id).toBe(sessionId);
      expect(session!.playerId).toBe('player1');
      expect(session!.nodeId).toBe(nodeId);
    });
  });

  describe('Query Methods', () => {
    beforeEach(() => {
      manager.generateNodes();
    });

    it('should get all nodes', () => {
      const nodes = manager.getNodes();

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0]).toHaveProperty('id');
      expect(nodes[0]).toHaveProperty('position');
      expect(nodes[0]).toHaveProperty('supply');
    });

    it('should get nodes near position', () => {
      const nodes = manager.generateNodes();
      const centerNode = nodes[0];

      const nearbyNodes = manager.getNodesNearPosition(centerNode.position, 50);

      expect(nearbyNodes.length).toBeGreaterThan(0);
      nearbyNodes.forEach(node => {
        const distance = Math.sqrt(
          Math.pow(node.position.x - centerNode.position.x, 2) +
          Math.pow(node.position.z - centerNode.position.z, 2)
        );
        expect(distance).toBeLessThanOrEqual(50);
      });
    });

    it('should get active node count', () => {
      const count = manager.getActiveNodeCount();

      expect(count).toBe(10000); // All nodes start active
    });

    it('should get depleted node count', () => {
      const nodes = manager.getNodes();
      nodes[0].state = SpiceNodeState.DEPLETED;
      nodes[1].state = SpiceNodeState.DEPLETED;

      const count = manager.getDepletedNodeCount();

      expect(count).toBe(2);
    });

    it('should get specific node', () => {
      const nodes = manager.getNodes();
      const nodeId = nodes[0].id;

      const node = manager.getNode(nodeId);

      expect(node).toBeDefined();
      expect(node!.id).toBe(nodeId);
    });

    it('should return undefined for non-existent node', () => {
      const node = manager.getNode('nonexistent-node');

      expect(node).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    let nodeId: string;
    let nodePosition: Vector3;

    beforeEach(() => {
      const nodes = manager.generateNodes();
      nodeId = nodes[0].id;
      nodePosition = nodes[0].position;
    });

    it('should handle update with no depleted nodes', () => {
      expect(() => {
        manager.update(1 / 30);
      }).not.toThrow();
    });

    it('should handle concurrent harvest sessions on different nodes', async () => {
      const nodes = manager.getNodes();
      const node1 = nodes[0];
      const node2 = nodes[1];

      const session1 = manager.startHarvest('player1', node1.id, node1.position);
      const session2 = manager.startHarvest('player2', node2.id, node2.position);

      expect(session1).not.toBeNull();
      expect(session2).not.toBeNull();

      await new Promise(resolve => setTimeout(resolve, ECONOMY_CONSTANTS.HARVEST_DURATION + 10));

      const result1 = manager.completeHarvest(session1!);
      const result2 = manager.completeHarvest(session2!);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should handle very small world sizes', () => {
      manager = new SpiceManager(42, 100);
      const nodes = manager.generateNodes();

      expect(nodes.length).toBe(100); // 100x100 / 100 = 100 nodes
    });

    it('should handle zero seed', () => {
      manager = new SpiceManager(0, 1000);
      const nodes = manager.generateNodes();

      expect(nodes.length).toBeGreaterThan(0);
    });

    it('should handle negative seed', () => {
      manager = new SpiceManager(-123, 1000);
      const nodes = manager.generateNodes();

      expect(nodes.length).toBeGreaterThan(0);
    });
  });
});
