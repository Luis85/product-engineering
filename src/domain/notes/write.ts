import { Schema } from "effect";

export const WriteRefusal = Schema.Literals([
  "other-type",
  "newer-version",
  "identity",
  "duplicate-id",
  "migration-failed",
  "layout",
]);

export type WriteRefusal = typeof WriteRefusal.Type;
