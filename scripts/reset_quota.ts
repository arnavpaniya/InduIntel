import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Reset today's quota for testing
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase.from('gemini_usage_log').delete().eq('request_date', today);
  console.log('Reset quota:', error?.message || 'OK');
}

main().catch(console.error);