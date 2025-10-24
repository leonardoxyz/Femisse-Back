import pg from 'pg';
import { env } from './config/validateEnv.js';

export const pool = new pg.Pool({
  connectionString: env.SUPABASE_DB_URL || env.DATABASE_URL,
});
