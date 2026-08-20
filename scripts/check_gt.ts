import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await supabase.from('ground_truth_items').select('id, mfg_part_num, manufacturer_name, brand_name, classpath').limit(5);
  console.log('Ground truth items:', data?.length);
  console.log(data);
  if (error) console.error('Error:', error.message);
}

main();