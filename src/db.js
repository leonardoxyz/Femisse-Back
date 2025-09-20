import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.SUPABASE_DB_URL,
});
