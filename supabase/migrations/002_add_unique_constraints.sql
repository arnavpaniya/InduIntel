-- 002_add_unique_constraints.sql
-- Add unique constraint on mfg_part_num for upsert support

ALTER TABLE items ADD CONSTRAINT items_mfg_part_num_key UNIQUE (mfg_part_num);