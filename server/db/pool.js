import pg from "pg";

export function createPool(connectionString) {
  return new pg.Pool({ connectionString });
}
