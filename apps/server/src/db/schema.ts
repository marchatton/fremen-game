import { pgTable, text, integer, json, timestamp, real } from 'drizzle-orm/pg-core';

export const players = pgTable('players', {
  id: text('id').primaryKey(), // playerId from JWT
  username: text('username').notNull(),

  // Resources
  water: real('water').notNull().default(100),
  spice: integer('spice').notNull().default(0),

  // Equipment (stored as JSON)
  equipment: json('equipment').notNull().default('{}'),

  // Inventory (stored as JSON array)
  inventory: json('inventory').notNull().default('[]'),

  // Stats (stored as JSON)
  stats: json('stats').notNull().default(JSON.stringify({
    objectivesCompleted: 0,
    totalSpiceEarned: 0,
    distanceTraveled: 0,
    deaths: 0,
    wormsRidden: 0,
  })),

  // Last known position
  lastPosition: json('last_position').notNull().default(JSON.stringify({ x: 0, y: 0, z: 0 })),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
