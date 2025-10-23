import {
  Equipment,
  EquipmentItem,
  EquipmentSlot,
  EquipmentType,
  EquipmentTier,
  InventoryItem,
  EquipmentStats,
  EQUIPMENT_CATALOG,
} from '@fremen/shared';

interface EquipResult {
  success: boolean;
  equipment: Equipment;
  inventory: InventoryItem[];
  error?: string;
}

interface UnequipResult {
  success: boolean;
  equipment: Equipment;
  inventory: InventoryItem[];
  error?: string;
}

interface ValidationResult {
  valid: boolean;
  item?: EquipmentItem;
  error?: string;
}

interface RemoveResult {
  success: boolean;
  inventory: InventoryItem[];
  error?: string;
}

/**
 * VS3: Equipment System
 *
 * Manages equipment validation, equip/unequip operations,
 * inventory management, and stat calculations.
 */
export class EquipmentManager {
  /**
   * Validate equipment exists in catalog
   */
  validateEquipment(itemId: string): ValidationResult {
    const item = EQUIPMENT_CATALOG[itemId];

    if (!item) {
      return {
        valid: false,
        error: `Equipment ${itemId} not found in catalog`,
      };
    }

    return {
      valid: true,
      item,
    };
  }

  /**
   * Get equipment slot for an item
   */
  getEquipmentSlot(item: EquipmentItem): EquipmentSlot {
    switch (item.type) {
      case EquipmentType.STILLSUIT:
        return EquipmentSlot.BODY;
      case EquipmentType.HEADGEAR:
        return EquipmentSlot.HEAD;
      case EquipmentType.BOOTS:
        return EquipmentSlot.FEET;
      default:
        return EquipmentSlot.BODY;
    }
  }

  /**
   * Convert EquipmentSlot enum to Equipment property key
   */
  private slotToKey(slot: EquipmentSlot): keyof Equipment {
    switch (slot) {
      case EquipmentSlot.HEAD:
        return 'head';
      case EquipmentSlot.BODY:
        return 'body';
      case EquipmentSlot.FEET:
        return 'feet';
    }
  }

  /**
   * Equip item from inventory
   */
  equipItem(
    itemId: string,
    equipment: Equipment,
    inventory: InventoryItem[]
  ): EquipResult {
    // Validate item exists
    const validation = this.validateEquipment(itemId);
    if (!validation.valid) {
      return {
        success: false,
        equipment,
        inventory,
        error: validation.error,
      };
    }

    const item = validation.item!;

    // Check if item is in inventory
    const inventoryItem = this.findInInventory(item.type, item.tier, inventory);
    if (!inventoryItem) {
      return {
        success: false,
        equipment,
        inventory,
        error: `Item ${itemId} not in inventory`,
      };
    }

    // Determine slot
    const slot = this.getEquipmentSlot(item);
    const slotKey = this.slotToKey(slot);

    // Create new equipment object
    const newEquipment = { ...equipment };

    // If slot is occupied, unequip current item back to inventory
    let newInventory = [...inventory];
    if (newEquipment[slotKey]) {
      const currentItem = newEquipment[slotKey]!;
      newInventory = this.addToInventory(currentItem, newInventory, 1);
    }

    // Remove item from inventory
    const removeResult = this.removeFromInventory(item.type, item.tier, newInventory, 1);
    if (!removeResult.success) {
      return {
        success: false,
        equipment,
        inventory,
        error: removeResult.error,
      };
    }

    // Equip item
    newEquipment[slotKey] = item;

    console.log(`Equipped ${itemId} to ${slot}`);

    return {
      success: true,
      equipment: newEquipment,
      inventory: removeResult.inventory,
    };
  }

  /**
   * Unequip item to inventory
   */
  unequipItem(
    slot: EquipmentSlot,
    equipment: Equipment,
    inventory: InventoryItem[]
  ): UnequipResult {
    const slotKey = this.slotToKey(slot);
    const item = equipment[slotKey];

    if (!item) {
      return {
        success: false,
        equipment,
        inventory,
        error: `No item equipped in slot ${slot}`,
      };
    }

    // Add to inventory
    const newInventory = this.addToInventory(item, inventory, 1);

    // Remove from equipment
    const newEquipment = { ...equipment };
    delete newEquipment[slotKey];

    console.log(`Unequipped ${item.id} from ${slot}`);

    return {
      success: true,
      equipment: newEquipment,
      inventory: newInventory,
    };
  }

  /**
   * Calculate total water reduction from equipped items
   */
  calculateWaterReduction(equipment: Equipment): number {
    let totalReduction = 0;

    // Check all equipment slots
    const slotKeys: Array<keyof Equipment> = ['head', 'body', 'feet'];

    for (const slotKey of slotKeys) {
      const item = equipment[slotKey];
      if (item && item.stats.waterReduction) {
        totalReduction += item.stats.waterReduction;
      }
    }

    return totalReduction;
  }

  /**
   * Calculate total stats from all equipped items
   */
  calculateTotalStats(equipment: Equipment): EquipmentStats {
    const stats: EquipmentStats = {
      waterReduction: 0,
      speedBoost: 0,
      healthBoost: 0,
    };

    const slotKeys: Array<keyof Equipment> = ['head', 'body', 'feet'];

    for (const slotKey of slotKeys) {
      const item = equipment[slotKey];
      if (item && item.stats) {
        if (item.stats.waterReduction) {
          stats.waterReduction! += item.stats.waterReduction;
        }
        if (item.stats.speedBoost) {
          stats.speedBoost! += item.stats.speedBoost;
        }
        if (item.stats.healthBoost) {
          stats.healthBoost! += item.stats.healthBoost;
        }
      }
    }

    return stats;
  }

  /**
   * Add item to inventory (stacks if possible)
   */
  addToInventory(
    item: EquipmentItem,
    inventory: InventoryItem[],
    quantity: number
  ): InventoryItem[] {
    const newInventory = [...inventory];

    // Try to find existing stack
    const existingItem = newInventory.find(
      i => i.type === item.type && i.tier === item.tier
    );

    if (existingItem) {
      // Stack with existing
      existingItem.quantity += quantity;
    } else {
      // Add new stack
      newInventory.push({
        id: `inv-${Date.now()}-${Math.random()}`,
        type: item.type,
        tier: item.tier,
        quantity,
      });
    }

    return newInventory;
  }

  /**
   * Remove item from inventory
   */
  removeFromInventory(
    type: EquipmentType,
    tier: EquipmentTier,
    inventory: InventoryItem[],
    quantity: number
  ): RemoveResult {
    const item = this.findInInventory(type, tier, inventory);

    if (!item) {
      return {
        success: false,
        inventory,
        error: `Item ${type} (${tier}) not found in inventory`,
      };
    }

    if (item.quantity < quantity) {
      return {
        success: false,
        inventory,
        error: `Insufficient quantity (has ${item.quantity}, need ${quantity})`,
      };
    }

    const newInventory = [...inventory];
    const itemIndex = newInventory.findIndex(i => i.type === type && i.tier === tier);

    if (item.quantity === quantity) {
      // Remove entire stack
      newInventory.splice(itemIndex, 1);
    } else {
      // Reduce quantity
      newInventory[itemIndex] = {
        ...item,
        quantity: item.quantity - quantity,
      };
    }

    return {
      success: true,
      inventory: newInventory,
    };
  }

  /**
   * Find item in inventory
   */
  findInInventory(
    type: EquipmentType,
    tier: EquipmentTier,
    inventory: InventoryItem[]
  ): InventoryItem | undefined {
    return inventory.find(i => i.type === type && i.tier === tier);
  }

  /**
   * Get equipment by ID from catalog
   */
  getEquipmentById(itemId: string): EquipmentItem | undefined {
    return EQUIPMENT_CATALOG[itemId];
  }

  /**
   * Get all equipment of a specific type
   */
  getEquipmentByType(type: EquipmentType): EquipmentItem[] {
    return Object.values(EQUIPMENT_CATALOG).filter(item => item.type === type);
  }
}
