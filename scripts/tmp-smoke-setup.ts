import { config } from 'dotenv'; config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
async function main() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // 0) Is migration 011 applied? probe: set a scratch row to failed
  const { data: probe } = await sb.from('items').select('id').limit(1).maybeSingle();
  let m11 = false;
  if (probe) {
    const { error } = await sb.from('items').update({ status: 'failed', failed_step: 'probe' }).eq('id', probe.id);
    m11 = !error;
    // revert immediately
    await sb.from('items').update({ status: 'raw' }).eq('id', probe.id);
    if (error) console.log('M11 probe error:', error.message);
  }
  console.log('migration_011_applied:', m11);

  // 1) KPTJS100A fixture (raw)
  const { data: kpt } = await sb.from('items').select('id,status').eq('mfg_part_num','KPTJS100A').maybeSingle();
  if (!kpt) {
    await sb.from('items').insert({
      mfg_part_num: 'KPTJS100A',
      part_desc: 'KPT JS100A stainless steel junction box wall mount enclosure',
      e1_brand: '-- Unbranded --',
      unilog_brand: '-- No Unilog Brand --',
      dib_brand: '-- No DIB Brand --',
      part_manuf: 'Kleinhuis Corp (KH)',
      status: 'raw',
    });
    console.log('fixture created: KPTJS100A (raw)');
  } else {
    console.log('fixture exists: KPTJS100A status=' + kpt.status);
  }

  // 2) stale enriching fixture (old timestamp)
  const oldTs = new Date(Date.now() - 48 * 3600_000).toISOString();
  const { data: st } = await sb.from('items').select('id,mfg_part_num,status').eq('mfg_part_num','SMOKE-STALE-001').maybeSingle();
  if (!st) {
    await sb.from('items').insert({
      mfg_part_num: 'SMOKE-STALE-001',
      part_desc: 'Synthetic stale enrichment probe product',
      status: 'enriching',
      updated_at: oldTs,
    });
    console.log('fixture created: SMOKE-STALE-001 (enriching, 48h old)');
  } else {
    await sb.from('items').update({ status: 'enriching', updated_at: oldTs }).eq('id', st.id);
    console.log('fixture refreshed: SMOKE-STALE-001');
  }
}
void main();
