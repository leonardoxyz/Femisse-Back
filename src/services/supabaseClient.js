import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

import { logger } from '../utils/logger.js';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  logger.warn('⚠️ Supabase credentials not fully configured. Check SUPABASE_URL and SUPABASE_KEY env vars.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
  },
});

export default supabase;
