import { SpiceNode, SpiceNodeState, ECONOMY_CONSTANTS } from '@fremen/shared';
import type { Vector3 } from '@fremen/shared';
import { seededRandom } from '../utils/random.js';

interface HarvestSession {
  id: string;
  playerId: string;
  nodeId: string;
  startTime: number;
}

/**
 * VS3: Spice Harvesting System
 *
 * Manages procedurally generated spice nodes, harvest interactions,
 * and node lifecycle (depletion/respawn).
 */
export class SpiceManager {
  private nodes: Map<string, SpiceNode> = new Map();
  private activeSessions: Map<string, HarvestSession> = new Map();
  private seed: number;
  private worldSize: number;

  constructor(seed: number = 42, worldSize: number = 1000) {
    this.seed = seed;
    this.worldSize = worldSize;
  }

  /**
   * Generate spice nodes procedurally based on seed
   * Density: 1 node per 100m² in viable zones
   */
  generateNodes(): SpiceNode[] {
    const nodes: SpiceNode[] = [];
    const rng = seededRandom(this.seed);

    // Calculate number of nodes: worldSize² / 100
    // For 1000x1000 world: 1,000,000 / 100 = 10,000 nodes
    const totalArea = this.worldSize * this.worldSize;
    const nodeCount = Math.floor(totalArea / 100);

    console.log(`Generating ${nodeCount} spice nodes for ${this.worldSize}x${this.worldSize} world`);

    for (let i = 0; i < nodeCount; i++) {
      const x = (rng() - 0.5) * this.worldSize;
      const z = (rng() - 0.5) * this.worldSize;

      const node: SpiceNode = {
        id: `spice-node-${i}`,
        position: { x, y: 0, z },
        supply: ECONOMY_CONSTANTS.SPICE_NODE_MAX_SUPPLY,
        maxSupply: ECONOMY_CONSTANTS.SPICE_NODE_MAX_SUPPLY,
        state: SpiceNodeState.ACTIVE,
      };

      nodes.push(node);
      this.nodes.set(node.id, node);
    }

    return nodes;
  }

  /**
   * Start a harvest session for a player at a node
   * Returns session ID if successful, null if validation fails
   */
  startHarvest(playerId: string, nodeId: string, playerPosition: Vector3): string | null {
    const node = this.nodes.get(nodeId);

    // Validation
    if (!node) {
      console.warn(`Cannot harvest: Node ${nodeId} not found`);
      return null;
    }

    if (node.state !== SpiceNodeState.ACTIVE) {
      console.warn(`Cannot harvest: Node ${nodeId} is ${node.state}`);
      return null;
    }

    if (node.supply <= 0) {
      console.warn(`Cannot harvest: Node ${nodeId} has no supply`);
      return null;
    }

    // Distance check
    const distance = Math.sqrt(
      Math.pow(playerPosition.x - node.position.x, 2) +
      Math.pow(playerPosition.z - node.position.z, 2)
    );

    if (distance > ECONOMY_CONSTANTS.HARVEST_DISTANCE) {
      console.warn(`Cannot harvest: Player too far from node (${distance.toFixed(1)}m > ${ECONOMY_CONSTANTS.HARVEST_DISTANCE}m)`);
      return null;
    }

    // Check if player already has active session
    const existingSession = Array.from(this.activeSessions.values()).find(s => s.playerId === playerId);
    if (existingSession) {
      console.warn(`Cannot harvest: Player ${playerId} already harvesting at ${existingSession.nodeId}`);
      return null;
    }

    // Create session
    const sessionId = `harvest-${playerId}-${Date.now()}`;
    const session: HarvestSession = {
      id: sessionId,
      playerId,
      nodeId,
      startTime: Date.now(),
    };

    this.activeSessions.set(sessionId, session);
    console.log(`Player ${playerId} started harvesting node ${nodeId} (session: ${sessionId})`);

    return sessionId;
  }

  /**
   * Complete a harvest session
   * Returns amount of spice harvested, or 0 if failed
   */
  completeHarvest(sessionId: string): { success: boolean; amount: number; nodeId: string } {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      console.warn(`Cannot complete harvest: Session ${sessionId} not found`);
      return { success: false, amount: 0, nodeId: '' };
    }

    const node = this.nodes.get(session.nodeId);
    if (!node) {
      this.activeSessions.delete(sessionId);
      return { success: false, amount: 0, nodeId: session.nodeId };
    }

    // Check if enough time has passed
    const elapsed = Date.now() - session.startTime;
    if (elapsed < ECONOMY_CONSTANTS.HARVEST_DURATION) {
      console.warn(`Cannot complete harvest: Not enough time elapsed (${elapsed}ms < ${ECONOMY_CONSTANTS.HARVEST_DURATION}ms)`);
      return { success: false, amount: 0, nodeId: session.nodeId };
    }

    // Calculate harvest amount (min of harvest amount or remaining supply)
    const harvestAmount = Math.min(ECONOMY_CONSTANTS.SPICE_HARVEST_AMOUNT, node.supply);

    // Update node
    node.supply -= harvestAmount;
    node.lastHarvestedBy = session.playerId;

    // Check if node is depleted
    if (node.supply <= 0) {
      this.depleteNode(node.id);
    }

    // Clean up session
    this.activeSessions.delete(sessionId);

    console.log(`Player ${session.playerId} harvested ${harvestAmount} spice from node ${session.nodeId} (${node.supply} remaining)`);

    return { success: true, amount: harvestAmount, nodeId: session.nodeId };
  }

  /**
   * Cancel a harvest session (player moved away, interrupted, etc.)
   */
  cancelHarvest(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      console.log(`Cancelled harvest session ${sessionId} for player ${session.playerId}`);
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Cancel all harvest sessions for a player
   */
  cancelPlayerHarvests(playerId: string): void {
    const sessions = Array.from(this.activeSessions.values()).filter(s => s.playerId === playerId);
    sessions.forEach(session => {
      this.activeSessions.delete(session.id);
    });

    if (sessions.length > 0) {
      console.log(`Cancelled ${sessions.length} harvest session(s) for player ${playerId}`);
    }
  }

  /**
   * Mark node as depleted and schedule respawn
   */
  private depleteNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.state = SpiceNodeState.DEPLETED;
    node.supply = 0;
    node.respawnAt = Date.now() + ECONOMY_CONSTANTS.SPICE_NODE_RESPAWN;

    console.log(`Node ${nodeId} depleted, respawning at ${new Date(node.respawnAt).toISOString()}`);
  }

  /**
   * Update system (check for respawns)
   */
  update(deltaTime: number): void {
    const now = Date.now();

    for (const node of this.nodes.values()) {
      if (node.state === SpiceNodeState.DEPLETED && node.respawnAt && now >= node.respawnAt) {
        this.respawnNode(node.id);
      }
    }
  }

  /**
   * Respawn a depleted node
   */
  private respawnNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.state = SpiceNodeState.ACTIVE;
    node.supply = node.maxSupply;
    node.respawnAt = undefined;
    node.lastHarvestedBy = undefined;

    console.log(`Node ${nodeId} respawned with ${node.supply} supply`);
  }

  /**
   * Get all nodes (for network sync)
   */
  getNodes(): SpiceNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get nodes near a position (for client optimization)
   */
  getNodesNearPosition(position: Vector3, radius: number): SpiceNode[] {
    return Array.from(this.nodes.values()).filter(node => {
      const distance = Math.sqrt(
        Math.pow(position.x - node.position.x, 2) +
        Math.pow(position.z - node.position.z, 2)
      );
      return distance <= radius;
    });
  }

  /**
   * Get a specific node
   */
  getNode(nodeId: string): SpiceNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get active harvest session for a player
   */
  getPlayerHarvestSession(playerId: string): HarvestSession | undefined {
    return Array.from(this.activeSessions.values()).find(s => s.playerId === playerId);
  }

  /**
   * Get number of active nodes
   */
  getActiveNodeCount(): number {
    return Array.from(this.nodes.values()).filter(n => n.state === SpiceNodeState.ACTIVE).length;
  }

  /**
   * Get number of depleted nodes
   */
  getDepletedNodeCount(): number {
    return Array.from(this.nodes.values()).filter(n => n.state === SpiceNodeState.DEPLETED).length;
  }
}
