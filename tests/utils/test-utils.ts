import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load test environment variables
dotenv.config({ path: '.env.test' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase environment variables are not set');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

export const cleanupTestData = async () => {
  await supabase.from('email_templates').delete().neq('id', 0);
  await supabase.from('email_queue').delete().neq('id', 0);
  await supabase.from('email_analytics').delete().neq('id', 0);
  await supabase.from('vector_embeddings').delete().neq('id', 0);
};

export { fs, path }; 