import { describe, it, expect, beforeEach } from 'vitest';
import { SietchManager } from './SietchManager.js';
import { MERCHANT_PRICES, EQUIPMENT_CATALOG, EquipmentType } from '@fremen/shared';
import type { Vector3, InventoryItem } from '@fremen/shared';

describe('VS3: Sietch & Merchant System', () => {
  let manager: SietchManager;

  beforeEach(() => {
    manager = new SietchManager();
  });

  describe('Sietch Location', () => {
    it('should have fixed Sietch position', () => {
      const position = manager.getSietchPosition();

      expect(position).toBeDefined();
      expect(position.x).toBeDefined();
      expect(position.z).toBeDefined();
      expect(position.y).toBe(0);
    });

    it('should have safe zone radius', () => {
      const radius = manager.getSafeZoneRadius();

      expect(radius).toBeGreaterThan(0);
      expect(radius).toBeLessThanOrEqual(50);
    });
  });

  describe('Safe Zone Detection', () => {
    it('should detect player inside safe zone', () => {
      const sietchPos = manager.getSietchPosition();
      const playerPos: Vector3 = { ...sietchPos };

      const inSafeZone = manager.isInSafeZone(playerPos);

      expect(inSafeZone).toBe(true);
    });

    it('should detect player outside safe zone', () => {
      const sietchPos = manager.getSietchPosition();
      const playerPos: Vector3 = {
        x: sietchPos.x + 100,
        y: 0,
        z: sietchPos.z + 100,
      };

      const inSafeZone = manager.isInSafeZone(playerPos);

      expect(inSafeZone).toBe(false);
    });

    it('should detect player at exact boundary (inside)', () => {
      const sietchPos = manager.getSietchPosition();
      const radius = manager.getSafeZoneRadius();
      const playerPos: Vector3 = {
        x: sietchPos.x + radius,
        y: 0,
        z: sietchPos.z,
      };

      const inSafeZone = manager.isInSafeZone(playerPos);

      expect(inSafeZone).toBe(true);
    });

    it('should detect player just outside boundary', () => {
      const sietchPos = manager.getSietchPosition();
      const radius = manager.getSafeZoneRadius();
      const playerPos: Vector3 = {
        x: sietchPos.x + radius + 0.1,
        y: 0,
        z: sietchPos.z,
      };

      const inSafeZone = manager.isInSafeZone(playerPos);

      expect(inSafeZone).toBe(false);
    });
  });

  describe('Merchant Buy Transaction', () => {
    it('should buy basic stillsuit with sufficient spice', () => {
      const spice = 100;
      const inventory: InventoryItem[] = [];

      const result = manager.buyItem('basic-stillsuit', spice, inventory);

      expect(result.success).toBe(true);
      expect(result.newSpice).toBe(spice - MERCHANT_PRICES['basic-stillsuit']);
      expect(result.inventory.length).toBe(1);
    });

    it('should add bought item to inventory', () => {
      const result = manager.buyItem('basic-stillsuit', 100, []);

      const item = result.inventory.find(i => i.type === EquipmentType.STILLSUIT);
      expect(item).toBeDefined();
      expect(item!.quantity).toBe(1);
    });

    it('should reject buy with insufficient spice', () => {
      const spice = 10;
      const inventory: InventoryItem[] = [];

      const result = manager.buyItem('basic-stillsuit', spice, inventory);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient spice');
      expect(result.newSpice).toBe(spice); // Unchanged
    });

    it('should reject buy of non-existent item', () => {
      const result = manager.buyItem('nonexistent-item', 1000, []);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should reject buy of item not sold by merchant', () => {
      // Items in catalog but not in merchant prices
      const result = manager.buyItem('fake-item', 1000, []);

      expect(result.success).toBe(false);
    });

    it('should buy multiple items', () => {
      let spice = 1000;
      let inventory: InventoryItem[] = [];

      const result1 = manager.buyItem('basic-stillsuit', spice, inventory);
      expect(result1.success).toBe(true);

      const result2 = manager.buyItem('improved-stillsuit', result1.newSpice, result1.inventory);
      expect(result2.success).toBe(true);

      expect(result2.inventory.length).toBe(2);
    });

    it('should stack identical items when buying', () => {
      let spice = 1000;
      let inventory: InventoryItem[] = [];

      const result1 = manager.buyItem('basic-stillsuit', spice, inventory);
      const result2 = manager.buyItem('basic-stillsuit', result1.newSpice, result1.inventory);

      expect(result2.success).toBe(true);
      expect(result2.inventory.length).toBe(1); // Stacked
      expect(result2.inventory[0].quantity).toBe(2);
    });
  });

  describe('Merchant Sell Transaction', () => {
    it('should sell item from inventory', () => {
      const inventory: InventoryItem[] = [
        {
          id: 'inv-1',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          quantity: 1,
        },
      ];
      const spice = 0;

      const result = manager.sellItem('basic-stillsuit', spice, inventory);

      expect(result.success).toBe(true);
      expect(result.newSpice).toBeGreaterThan(spice);
      expect(result.inventory.length).toBe(0);
    });

    it('should give correct sell price (50% of buy price)', () => {
      const inventory: InventoryItem[] = [
        {
          id: 'inv-1',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          quantity: 1,
        },
      ];

      const result = manager.sellItem('basic-stillsuit', 0, inventory);

      const buyPrice = MERCHANT_PRICES['basic-stillsuit'];
      const expectedSellPrice = Math.floor(buyPrice * 0.5);

      expect(result.success).toBe(true);
      expect(result.newSpice).toBe(expectedSellPrice);
    });

    it('should reject sell when item not in inventory', () => {
      const inventory: InventoryItem[] = [];

      const result = manager.sellItem('basic-stillsuit', 0, inventory);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not in inventory');
    });

    it('should reject sell of non-existent item', () => {
      const result = manager.sellItem('nonexistent-item', 0, []);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should reduce quantity when selling from stack', () => {
      const inventory: InventoryItem[] = [
        {
          id: 'inv-1',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          quantity: 3,
        },
      ];

      const result = manager.sellItem('basic-stillsuit', 0, inventory);

      expect(result.success).toBe(true);
      expect(result.inventory.length).toBe(1);
      expect(result.inventory[0].quantity).toBe(2);
    });
  });

  describe('Merchant Catalog', () => {
    it('should list available items', () => {
      const catalog = manager.getMerchantCatalog();

      expect(catalog.length).toBeGreaterThan(0);
      expect(catalog.every(item => item.item && item.price)).toBe(true);
    });

    it('should include all stillsuit tiers', () => {
      const catalog = manager.getMerchantCatalog();

      const stillsuits = catalog.filter(item =>
        item.item.type === EquipmentType.STILLSUIT
      );

      expect(stillsuits.length).toBeGreaterThanOrEqual(3); // Basic, Improved, Advanced
    });

    it('should have correct prices from MERCHANT_PRICES', () => {
      const catalog = manager.getMerchantCatalog();

      catalog.forEach(merchantItem => {
        const expectedPrice = MERCHANT_PRICES[merchantItem.item.id];
        if (expectedPrice) {
          expect(merchantItem.price).toBe(expectedPrice);
        }
      });
    });

    it('should calculate sell prices correctly', () => {
      const catalog = manager.getMerchantCatalog();

      catalog.forEach(merchantItem => {
        const sellPrice = manager.calculateSellPrice(merchantItem.item.id);
        const buyPrice = merchantItem.price;

        expect(sellPrice).toBe(Math.floor(buyPrice * 0.5));
      });
    });
  });

  describe('Transaction Validation', () => {
    it('should validate transaction in safe zone', () => {
      const sietchPos = manager.getSietchPosition();
      const playerPos: Vector3 = { ...sietchPos };

      const canTrade = manager.canTrade(playerPos);

      expect(canTrade).toBe(true);
    });

    it('should reject transaction outside safe zone', () => {
      const sietchPos = manager.getSietchPosition();
      const playerPos: Vector3 = {
        x: sietchPos.x + 1000,
        y: 0,
        z: sietchPos.z + 1000,
      };

      const canTrade = manager.canTrade(playerPos);

      expect(canTrade).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle buying with exact spice amount', () => {
      const price = MERCHANT_PRICES['basic-stillsuit'];
      const result = manager.buyItem('basic-stillsuit', price, []);

      expect(result.success).toBe(true);
      expect(result.newSpice).toBe(0);
    });

    it('should handle selling with 0 spice', () => {
      const inventory: InventoryItem[] = [
        {
          id: 'inv-1',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          quantity: 1,
        },
      ];

      const result = manager.sellItem('basic-stillsuit', 0, inventory);

      expect(result.success).toBe(true);
      expect(result.newSpice).toBeGreaterThan(0);
    });

    it('should handle very large spice amounts', () => {
      const result = manager.buyItem('basic-stillsuit', 999999, []);

      expect(result.success).toBe(true);
      expect(result.newSpice).toBeLessThan(999999);
    });

    it('should handle empty inventory for sell', () => {
      const result = manager.sellItem('basic-stillsuit', 100, []);

      expect(result.success).toBe(false);
    });
  });

  describe('Realistic Gameplay Scenarios', () => {
    it('should simulate player buying starter gear', () => {
      let spice = 100; // Starting from objective rewards
      let inventory: InventoryItem[] = [];

      // Buy basic stillsuit
      const result = manager.buyItem('basic-stillsuit', spice, inventory);

      expect(result.success).toBe(true);
      expect(result.newSpice).toBe(50); // 100 - 50
      expect(result.inventory.length).toBe(1);
    });

    it('should simulate player upgrading stillsuit', () => {
      let spice = 250;
      let inventory: InventoryItem[] = [
        {
          id: 'inv-1',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          quantity: 1,
        },
      ];

      // Sell basic stillsuit
      const sellResult = manager.sellItem('basic-stillsuit', spice, inventory);
      expect(sellResult.success).toBe(true);

      // Buy improved stillsuit
      const buyResult = manager.buyItem('improved-stillsuit', sellResult.newSpice, sellResult.inventory);
      expect(buyResult.success).toBe(true);

      // Should have improved stillsuit now
      const hasImproved = buyResult.inventory.some(item =>
        item.type === EquipmentType.STILLSUIT &&
        item.tier === EQUIPMENT_CATALOG['improved-stillsuit'].tier
      );
      expect(hasImproved).toBe(true);
    });

    it('should simulate player farming spice to afford advanced stillsuit', () => {
      let spice = 0;

      // Complete 10 objectives (50 spice each)
      for (let i = 0; i < 10; i++) {
        spice += 50;
      }

      expect(spice).toBe(500);

      // Can afford advanced stillsuit
      const advancedPrice = MERCHANT_PRICES['advanced-stillsuit'];
      expect(spice).toBeGreaterThanOrEqual(advancedPrice);

      const result = manager.buyItem('advanced-stillsuit', spice, []);
      expect(result.success).toBe(true);
    });

    it('should simulate player selling loot after death recovery', () => {
      // Player recovered corpse with extra basic stillsuit
      const inventory: InventoryItem[] = [
        {
          id: 'inv-1',
          type: EquipmentType.STILLSUIT,
          tier: EQUIPMENT_CATALOG['basic-stillsuit'].tier,
          quantity: 2,
        },
      ];

      const spice = 10;

      // Sell one
      const result = manager.sellItem('basic-stillsuit', spice, inventory);

      expect(result.success).toBe(true);
      expect(result.inventory[0].quantity).toBe(1);
      expect(result.newSpice).toBeGreaterThan(spice);
    });
  });

  describe('Distance Calculations', () => {
    it('should calculate distance to Sietch', () => {
      const playerPos: Vector3 = { x: 0, y: 0, z: 0 };

      const distance = manager.getDistanceToSietch(playerPos);

      expect(distance).toBeGreaterThanOrEqual(0);
      expect(typeof distance).toBe('number');
    });

    it('should return 0 distance when at Sietch center', () => {
      const sietchPos = manager.getSietchPosition();

      const distance = manager.getDistanceToSietch(sietchPos);

      expect(distance).toBe(0);
    });

    it('should calculate distance correctly', () => {
      const sietchPos = manager.getSietchPosition();
      const playerPos: Vector3 = {
        x: sietchPos.x + 30,
        y: 0,
        z: sietchPos.z + 40,
      };

      const distance = manager.getDistanceToSietch(playerPos);

      // 3-4-5 triangle: distance should be 50
      expect(distance).toBeCloseTo(50, 1);
    });
  });
});
