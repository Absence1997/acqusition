import 'dotenv/config';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { neonConfig } from '@neondatabase/serverless';

if (
  process.env.NODE_ENV === 'development' &&
  process.env.USE_NEON_LOCAL === 'true'
) {
  neonConfig.useSecureWebSocket = false;
  neonConfig.poolQueryViaFetch = true;
}

const sql = neon(process.env.DATABASE_URL);

const db = drizzle(sql);

export default sql;
export { db };
