import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const verifiedRaffles = sqliteTable("verified_raffles", {
  id: text("id").primaryKey(),
  hostSecretHash: text("host_secret_hash").notNull(),
  status: text("status").notNull().default("locked"),
  entriesText: text("entries_text").notNull(),
  firstTicket: integer("first_ticket").notNull(),
  ticketCount: integer("ticket_count").notNull(),
  manifestHash: text("manifest_hash").notNull(),
  receiptSeed: text("receipt_seed"),
  publicManifestHash: text("public_manifest_hash"),
  auditVersion: integer("audit_version").notNull().default(1),
  targetRound: integer("target_round").notNull(),
  drandRandomness: text("drand_randomness"),
  drandSignature: text("drand_signature"),
  winnerName: text("winner_name"),
  winnerMasked: text("winner_masked"),
  winnerNumber: integer("winner_number"),
  winnerIndex: integer("winner_index"),
  createdAt: text("created_at").notNull(),
  lockedAt: text("locked_at").notNull(),
  drawnAt: text("drawn_at"),
  drawHistory: text("draw_history").notNull().default("[]"),
});

export const displaySessions = sqliteTable("display_sessions", {
  id: text("id").primaryKey(),
  controlKeyHash: text("control_key_hash").notNull(),
  stateJson: text("state_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});
