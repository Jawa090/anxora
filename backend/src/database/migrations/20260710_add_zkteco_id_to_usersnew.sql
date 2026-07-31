ALTER TABLE users
DROP COLUMN IF EXISTS zkteco_id;

DROP INDEX IF EXISTS idx_users_zkteco_id;
