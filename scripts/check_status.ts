import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.from('gemini_usage_log').select('*').eq('request_date', today);
  console.log('Today quota:', data, error?.message);
  
  const { data: items, error: itemsError } = await supabase.from('items').select('id, mfg_part_num, status, dept, class, fine').limit(20);
  console.log('Items:', items?.map(i => ({ mpn: i.mfg_part_num, status: i.status, dept: i.dept, class: i.class, fine: i.fine })), itemsError?.message);
  
  // Check enrichment_logs count
  const { data: logs, error: logsError } = await supabase.from('enrichment_logs').select('step, status').limit(100);
  console.log('Enrichment logs count:', logs?.length, 'Errors:', logs?.filter(l => l.status === 'error').length);
}

main().catch(console.error);