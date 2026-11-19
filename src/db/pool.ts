import { Pool, type PoolClient } from "pg";
import { config } from "../lib/config";

let pool: Pool | undefined;

export function db(): Pool {
  pool ??= new Pool({ connectionString: config.databaseUrl, max: 10 });
  return pool;
}

/** Voert `werk` uit binnen één transactie. */
export async function transactie<T>(werk: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const resultaat = await werk(client);
    await client.query("COMMIT");
    return resultaat;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function sluitDb() {
  await pool?.end();
  pool = undefined;
}
