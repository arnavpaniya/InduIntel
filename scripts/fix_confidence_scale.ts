import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running confidence scale fix migration...');
  
  // Rename confidence_score to field_confidence
  const { error: renameError } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE items RENAME COLUMN confidence_score TO field_confidence;'
  });
  
  if (renameError) {
    console.log('Rename error (may already be renamed):', renameError.message);
  } else {
    console.log('Renamed confidence_score to field_confidence');
  }
  
  // Add new confidence_score column
  const { error: addError } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE items ADD COLUMN confidence_score NUMERIC(5,2);'
  });
  
  if (addError) {
    console.log('Add column error:', addError.message);
  } else {
    console.log('Added confidence_score column (0-100 scale)');
  }
  
  // Add comments
  const { error: commentError } = await supabase.rpc('exec_sql', {
    sql: `
      COMMENT ON COLUMN items.field_confidence IS 'Average of per-step LLM self-reported confidence (0-1 scale)';
      COMMENT ON COLUMN items.confidence_score IS 'Orchestrator-computed percentage of expected fields filled (0-100 scale)';
    `
  });
  
  if (commentError) {
    console.log('Comment error:', commentError.message);
  } else {
    console.log('Added comments');
  }
  
  console.log('Migration complete');
}

runMigration();