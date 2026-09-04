import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const verifiedRaffles = sqliteTable("verified_raffles", {
  id: text("id").primaryKey(),
  hostSecretHash: text("host_secret_hash").notNull(),
  status: text("status").notNull().default("locked"),
  entriesText: text("entries_text").notNull(),
  firstTicket: integer("first_ticket").notNull(),
  ticketCount: integer("ticket_count").notNull(),
  manifestHash: text("manifest_hash").notNull(),
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
});
