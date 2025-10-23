import { describe, it, expect, beforeEach } from 'vitest';
import { EquipmentManager } from './EquipmentManager.js';
import {
  EquipmentSlot,
  EquipmentType,
  EQUIPMENT_CATALOG,
  type Equipment,
  type InventoryItem,
  type PlayerResources
} from '@fremen/shared';

describe('VS3: Equipment System', () => {
  let manager: EquipmentManager;

  beforeEach(() => {
    manager = new EquipmentManager();
  });

  describe('Equipment Validation', () => {
    it('should validate equipment item exists in catalog', () => {
      const result = manager.validateEquipment('basic-stillsuit');

      expect(result.valid).toBe(true);
      expect(result.item).toBeDefined();
      expect(result.item!.id).toBe('basic-stillsuit');
    });

    it('should reject non-existent equipment', () => {
      const result = manager.validateEquipment('nonexistent-item');

      expect(result.valid).toBe(false);
      expect(result.item).toBeUndefined();
      expect(result.error).toContain('not found');
    });

    it('should validate correct slot for stillsuit', () => {
      const item = EQUIPMENT_CATALOG['basic-stillsuit'];
      const slot = manager.getEquipmentSlot(item);

      expect(slot).toBe(EquipmentSlot.BODY);
    });

    it('should get correct slot for different equipment types', () => {
      const stillsuit = EQUIPMENT_CATALOG['basic-stillsuit'];

      expect(manager.getEquipmentSlot(stillsuit)).toBe(EquipmentSlot.BODY);
    });
  });

  describe('Equip Operation', () => {
    let equipment: Equipment;
    let inventory: InventoryItem[];

    beforeEach(() => {
      equipment = {};
      inventory = [
        {
          id: 'inv-1',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          quantity: 1,
        },
      ];
    });

    it('should equip item from inventory', () => {
      const result = manager.equipItem('basic-stillsuit', equipment, inventory);

      expect(result.success).toBe(true);
      expect(result.equipment.body).toBeDefined();
      expect(result.equipment.body!.id).toBe('basic-stillsuit');
    });

    it('should remove equipped item from inventory', () => {
      const result = manager.equipItem('basic-stillsuit', equipment, inventory);

      expect(result.success).toBe(true);
      expect(result.inventory.length).toBe(0);
    });

    it('should reject equip when item not in inventory', () => {
      const emptyInventory: InventoryItem[] = [];
      const result = manager.equipItem('basic-stillsuit', equipment, emptyInventory);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not in inventory');
    });

    it('should reject equip when item does not exist', () => {
      const result = manager.equipItem('nonexistent-item', equipment, inventory);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should replace existing equipped item in same slot', () => {
      // Equip basic stillsuit first
      const result1 = manager.equipItem('basic-stillsuit', equipment, inventory);

      // Add improved stillsuit to inventory
      result1.inventory.push({
        id: 'inv-2',
        type: EquipmentType.STILLSUIT,
        tier: EQUIPMENT_CATALOG['improved-stillsuit'].tier,
        quantity: 1,
      });

      // Equip improved stillsuit
      const result2 = manager.equipItem('improved-stillsuit', result1.equipment, result1.inventory);

      expect(result2.success).toBe(true);
      expect(result2.equipment.body!.id).toBe('improved-stillsuit');

      // Basic stillsuit should be back in inventory
      const basicInInventory = result2.inventory.find(item =>
        item.type === EquipmentType.STILLSUIT &&
        item.tier === EQUIPMENT_CATALOG['basic-stillsuit'].tier
      );
      expect(basicInInventory).toBeDefined();
    });

    it('should handle quantity correctly when equipping', () => {
      inventory[0].quantity = 3;

      const result = manager.equipItem('basic-stillsuit', equipment, inventory);

      expect(result.success).toBe(true);

      // Should still have 2 in inventory
      const remaining = result.inventory.find(item => item.type === EquipmentType.STILLSUIT);
      expect(remaining).toBeDefined();
      expect(remaining!.quantity).toBe(2);
    });
  });

  describe('Unequip Operation', () => {
    let equipment: Equipment;
    let inventory: InventoryItem[];

    beforeEach(() => {
      equipment = {
        body: EQUIPMENT_CATALOG['basic-stillsuit'],
      };
      inventory = [];
    });

    it('should unequip item to inventory', () => {
      const result = manager.unequipItem(EquipmentSlot.BODY, equipment, inventory);

      expect(result.success).toBe(true);
      expect(result.equipment.body).toBeUndefined();
      expect(result.inventory.length).toBe(1);
    });

    it('should add unequipped item to inventory', () => {
      const result = manager.unequipItem(EquipmentSlot.BODY, equipment, inventory);

      expect(result.success).toBe(true);

      const item = result.inventory.find(i => i.type === EquipmentType.STILLSUIT);
      expect(item).toBeDefined();
      expect(item!.quantity).toBe(1);
    });

    it('should reject unequip when slot is empty', () => {
      const emptyEquipment: Equipment = {};
      const result = manager.unequipItem(EquipmentSlot.BODY, emptyEquipment, inventory);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No item equipped');
    });

    it('should stack unequipped items in inventory', () => {
      // Already have one in inventory
      inventory.push({
        id: 'inv-1',
        type: EquipmentType.STILLSUIT,
        tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
        quantity: 2,
      });

      const result = manager.unequipItem(EquipmentSlot.BODY, equipment, inventory);

      expect(result.success).toBe(true);

      // Should stack to quantity 3
      const item = result.inventory.find(i => i.type === EquipmentType.STILLSUIT);
      expect(item!.quantity).toBe(3);
    });
  });

  describe('Stat Calculation', () => {
    it('should calculate water reduction from basic stillsuit', () => {
      const equipment: Equipment = {
        body: EQUIPMENT_CATALOG['basic-stillsuit'],
      };

      const waterReduction = manager.calculateWaterReduction(equipment);

      expect(waterReduction).toBe(0.25);
    });

    it('should calculate water reduction from improved stillsuit', () => {
      const equipment: Equipment = {
        body: EQUIPMENT_CATALOG['improved-stillsuit'],
      };

      const waterReduction = manager.calculateWaterReduction(equipment);

      expect(waterReduction).toBe(0.50);
    });

    it('should calculate water reduction from advanced stillsuit', () => {
      const equipment: Equipment = {
        body: EQUIPMENT_CATALOG['advanced-stillsuit'],
      };

      const waterReduction = manager.calculateWaterReduction(equipment);

      expect(waterReduction).toBe(0.75);
    });

    it('should return 0 water reduction with no equipment', () => {
      const equipment: Equipment = {};

      const waterReduction = manager.calculateWaterReduction(equipment);

      expect(waterReduction).toBe(0);
    });

    it('should stack water reduction from multiple slots', () => {
      const equipment: Equipment = {
        body: EQUIPMENT_CATALOG['basic-stillsuit'], // 0.25
        head: { // Hypothetical headgear with water reduction
          id: 'test-headgear',
          type: EquipmentType.HEADGEAR,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          name: 'Test Headgear',
          description: 'Test',
          stats: { waterReduction: 0.10 },
        },
      };

      const waterReduction = manager.calculateWaterReduction(equipment);

      expect(waterReduction).toBe(0.35); // 0.25 + 0.10
    });

    it('should calculate total stats', () => {
      const equipment: Equipment = {
        body: EQUIPMENT_CATALOG['basic-stillsuit'],
      };

      const stats = manager.calculateTotalStats(equipment);

      expect(stats.waterReduction).toBe(0.25);
      expect(stats.speedBoost).toBe(0);
      expect(stats.healthBoost).toBe(0);
    });
  });

  describe('Inventory Management', () => {
    it('should add item to inventory', () => {
      const inventory: InventoryItem[] = [];
      const item = EQUIPMENT_CATALOG['basic-stillsuit'];

      const newInventory = manager.addToInventory(item, inventory, 1);

      expect(newInventory.length).toBe(1);
      expect(newInventory[0].type).toBe(EquipmentType.STILLSUIT);
      expect(newInventory[0].quantity).toBe(1);
    });

    it('should stack identical items in inventory', () => {
      const inventory: InventoryItem[] = [
        {
          id: 'inv-1',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          quantity: 2,
        },
      ];
      const item = EQUIPMENT_CATALOG['basic-stillsuit'];

      const newInventory = manager.addToInventory(item, inventory, 3);

      expect(newInventory.length).toBe(1);
      expect(newInventory[0].quantity).toBe(5); // 2 + 3
    });

    it('should not stack different tiers', () => {
      const inventory: InventoryItem[] = [
        {
          id: 'inv-1',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          quantity: 1,
        },
      ];
      const item = EQUIPMENT_CATALOG['improved-stillsuit'];

      const newInventory = manager.addToInventory(item, inventory, 1);

      expect(newInventory.length).toBe(2);
    });

    it('should remove item from inventory', () => {
      const inventory: InventoryItem[] = [
        {
          id: 'inv-1',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          quantity: 3,
        },
      ];

      const result = manager.removeFromInventory(EquipmentType.STILLSUIT, EQUIPMENT_CATALOG['basic-stillsuit'].tier, inventory, 1);

      expect(result.success).toBe(true);
      expect(result.inventory.length).toBe(1);
      expect(result.inventory[0].quantity).toBe(2); // 3 - 1
    });

    it('should remove entire stack when quantity reaches 0', () => {
      const inventory: InventoryItem[] = [
        {
          id: 'inv-1',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          quantity: 1,
        },
      ];

      const result = manager.removeFromInventory(EquipmentType.STILLSUIT, EQUIPMENT_CATALOG['basic-stillsuit'].tier, inventory, 1);

      expect(result.success).toBe(true);
      expect(result.inventory.length).toBe(0);
    });

    it('should reject remove when item not in inventory', () => {
      const inventory: InventoryItem[] = [];

      const result = manager.removeFromInventory(EquipmentType.STILLSUIT, EQUIPMENT_CATALOG['basic-stillsuit'].tier, inventory, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should reject remove when insufficient quantity', () => {
      const inventory: InventoryItem[] = [
        {
          id: 'inv-1',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          quantity: 2,
        },
      ];

      const result = manager.removeFromInventory(EquipmentType.STILLSUIT, EQUIPMENT_CATALOG['basic-stillsuit'].tier, inventory, 5);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient quantity');
    });

    it('should find item in inventory', () => {
      const inventory: InventoryItem[] = [
        {
          id: 'inv-1',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          quantity: 1,
        },
      ];

      const item = manager.findInInventory(EquipmentType.STILLSUIT, EQUIPMENT_CATALOG['basic-stillsuit'].tier, inventory);

      expect(item).toBeDefined();
      expect(item!.quantity).toBe(1);
    });

    it('should return undefined when item not in inventory', () => {
      const inventory: InventoryItem[] = [];

      const item = manager.findInInventory(EquipmentType.STILLSUIT, EQUIPMENT_CATALOG['basic-stillsuit'].tier, inventory);

      expect(item).toBeUndefined();
    });
  });

  describe('Equipment Catalog Access', () => {
    it('should get equipment by ID', () => {
      const item = manager.getEquipmentById('basic-stillsuit');

      expect(item).toBeDefined();
      expect(item!.name).toBe('Basic Stillsuit');
    });

    it('should return undefined for non-existent ID', () => {
      const item = manager.getEquipmentById('nonexistent');

      expect(item).toBeUndefined();
    });

    it('should list all stillsuits', () => {
      const stillsuits = manager.getEquipmentByType(EquipmentType.STILLSUIT);

      expect(stillsuits.length).toBe(3); // Basic, Improved, Advanced
      expect(stillsuits.every(s => s.type === EquipmentType.STILLSUIT)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty equipment object', () => {
      const equipment: Equipment = {};
      const inventory: InventoryItem[] = [];

      const result = manager.unequipItem(EquipmentSlot.BODY, equipment, inventory);

      expect(result.success).toBe(false);
    });

    it('should handle empty inventory', () => {
      const equipment: Equipment = {};
      const inventory: InventoryItem[] = [];

      const result = manager.equipItem('basic-stillsuit', equipment, inventory);

      expect(result.success).toBe(false);
    });

    it('should handle undefined slots', () => {
      const equipment: Equipment = {
        head: undefined,
        body: undefined,
        feet: undefined,
      };

      const stats = manager.calculateTotalStats(equipment);

      expect(stats.waterReduction).toBe(0);
    });

    it('should handle equipment with no stats', () => {
      const equipment: Equipment = {
        body: {
          id: 'test-item',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          name: 'Test',
          description: 'Test',
          stats: {}, // Empty stats
        },
      };

      const waterReduction = manager.calculateWaterReduction(equipment);

      expect(waterReduction).toBe(0);
    });
  });

  describe('Realistic Gameplay Scenarios', () => {
    it('should simulate upgrading stillsuit', () => {
      let equipment: Equipment = {};
      let inventory: InventoryItem[] = [
        {
          id: 'inv-1',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          quantity: 1,
        },
        {
          id: 'inv-2',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['improved-stillsuit'].tier,
          quantity: 1,
        },
      ];

      // Equip basic stillsuit
      const result1 = manager.equipItem('basic-stillsuit', equipment, inventory);
      expect(result1.success).toBe(true);
      expect(manager.calculateWaterReduction(result1.equipment)).toBe(0.25);

      // Upgrade to improved stillsuit
      const result2 = manager.equipItem('improved-stillsuit', result1.equipment, result1.inventory);
      expect(result2.success).toBe(true);
      expect(manager.calculateWaterReduction(result2.equipment)).toBe(0.50);

      // Basic stillsuit should be back in inventory
      const basicInInventory = result2.inventory.find(i =>
        i.type === EquipmentType.STILLSUIT &&
        i.tier === EQUIPMENT_CATALOG['basic-stillsuit'].tier
      );
      expect(basicInInventory).toBeDefined();
    });

    it('should simulate selling equipped item', () => {
      let equipment: Equipment = {
        body: EQUIPMENT_CATALOG['basic-stillsuit'],
      };
      let inventory: InventoryItem[] = [];

      // Unequip to inventory first
      const result1 = manager.unequipItem(EquipmentSlot.BODY, equipment, inventory);
      expect(result1.success).toBe(true);

      // Simulate selling by removing from inventory
      const result2 = manager.removeFromInventory(
        EquipmentType.STILLSUIT,
        EQUIPMENT_CATALOG['basic-stillsuit'].tier,
        result1.inventory,
        1
      );
      expect(result2.success).toBe(true);
      expect(result2.inventory.length).toBe(0);
    });

    it('should handle player dying and keeping equipment', () => {
      const equipment: Equipment = {
        body: EQUIPMENT_CATALOG['advanced-stillsuit'],
      };

      // Equipment stays equipped through death
      const waterReduction = manager.calculateWaterReduction(equipment);
      expect(waterReduction).toBe(0.75);
    });
  });
});
