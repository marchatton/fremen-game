import {
  MERCHANT_PRICES,
  EQUIPMENT_CATALOG,
  EquipmentItem,
  InventoryItem,
  MerchantItem,
} from '@fremen/shared';
import type { Vector3 } from '@fremen/shared';
import { EquipmentManager } from './EquipmentManager.js';

interface TradeResult {
  success: boolean;
  newSpice: number;
  inventory: InventoryItem[];
  error?: string;
}

/**
 * VS3: Sietch Hub & Merchant System
 *
 * Manages the safe zone at Sietch, merchant buy/sell transactions,
 * and trade validation.
 */
export class SietchManager {
  private equipmentManager: EquipmentManager;
  private sietchPosition: Vector3 = { x: 0, y: 0, z: 0 }; // Center of map
  private safeZoneRadius: number = 30; // 30m radius

  // Sell price is 50% of buy price
  private readonly SELL_PRICE_MULTIPLIER = 0.5;

  constructor() {
    this.equipmentManager = new EquipmentManager();
  }

  /**
   * Get Sietch position
   */
  getSietchPosition(): Vector3 {
    return { ...this.sietchPosition };
  }

  /**
   * Get safe zone radius
   */
  getSafeZoneRadius(): number {
    return this.safeZoneRadius;
  }

  /**
   * Check if position is in safe zone
   */
  isInSafeZone(position: Vector3): boolean {
    const distance = this.calculateDistance(position, this.sietchPosition);
    return distance <= this.safeZoneRadius;
  }

  /**
   * Check if player can trade (must be in safe zone)
   */
  canTrade(playerPosition: Vector3): boolean {
    return this.isInSafeZone(playerPosition);
  }

  /**
   * Buy item from merchant
   */
  buyItem(itemId: string, spice: number, inventory: InventoryItem[]): TradeResult {
    // Validate item exists
    const item = EQUIPMENT_CATALOG[itemId];
    if (!item) {
      return {
        success: false,
        newSpice: spice,
        inventory,
        error: `Item ${itemId} not found in catalog`,
      };
    }

    // Check if merchant sells this item
    const price = MERCHANT_PRICES[itemId];
    if (price === undefined) {
      return {
        success: false,
        newSpice: spice,
        inventory,
        error: `Item ${itemId} not sold by merchant`,
      };
    }

    // Check if player has enough spice
    if (spice < price) {
      return {
        success: false,
        newSpice: spice,
        inventory,
        error: `Insufficient spice (have ${spice}, need ${price})`,
      };
    }

    // Add item to inventory
    const newInventory = this.equipmentManager.addToInventory(item, inventory, 1);

    console.log(`Bought ${itemId} for ${price} spice`);

    return {
      success: true,
      newSpice: spice - price,
      inventory: newInventory,
    };
  }

  /**
   * Sell item to merchant
   */
  sellItem(itemId: string, spice: number, inventory: InventoryItem[]): TradeResult {
    // Validate item exists
    const item = EQUIPMENT_CATALOG[itemId];
    if (!item) {
      return {
        success: false,
        newSpice: spice,
        inventory,
        error: `Item ${itemId} not found in catalog`,
      };
    }

    // Check if player has item in inventory
    const inventoryItem = this.equipmentManager.findInInventory(item.type, item.tier, inventory);
    if (!inventoryItem) {
      return {
        success: false,
        newSpice: spice,
        inventory,
        error: `Item ${itemId} not in inventory`,
      };
    }

    // Calculate sell price
    const sellPrice = this.calculateSellPrice(itemId);

    // Remove item from inventory
    const removeResult = this.equipmentManager.removeFromInventory(
      item.type,
      item.tier,
      inventory,
      1
    );

    if (!removeResult.success) {
      return {
        success: false,
        newSpice: spice,
        inventory,
        error: removeResult.error,
      };
    }

    console.log(`Sold ${itemId} for ${sellPrice} spice`);

    return {
      success: true,
      newSpice: spice + sellPrice,
      inventory: removeResult.inventory,
    };
  }

  /**
   * Calculate sell price (50% of buy price)
   */
  calculateSellPrice(itemId: string): number {
    const buyPrice = MERCHANT_PRICES[itemId];
    if (buyPrice === undefined) return 0;

    return Math.floor(buyPrice * this.SELL_PRICE_MULTIPLIER);
  }

  /**
   * Get merchant catalog
   */
  getMerchantCatalog(): MerchantItem[] {
    const catalog: MerchantItem[] = [];

    for (const [itemId, price] of Object.entries(MERCHANT_PRICES)) {
      const item = EQUIPMENT_CATALOG[itemId];
      if (item) {
        catalog.push({
          id: `merchant-${itemId}`,
          item,
          price,
          stock: -1, // Infinite stock
        });
      }
    }

    return catalog;
  }

  /**
   * Get distance from position to Sietch
   */
  getDistanceToSietch(position: Vector3): number {
    return this.calculateDistance(position, this.sietchPosition);
  }

  /**
   * Calculate distance between two positions
   */
  private calculateDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
