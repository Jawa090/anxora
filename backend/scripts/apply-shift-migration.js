const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

async function run() {
  try {
    const migrationPath = path.join(__dirname, '../src/database/migrations/20260911_create_shift_management_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Applying shift management migration...');
    await db.query(sql);
    console.log('✓ Shift management migration applied successfully!');

    // Mark in migrations table if exists
    await db.query(
      'INSERT INTO migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      ['20260911_create_shift_management_tables.sql']
    ).catch(() => {});

    process.exit(0);
  } catch (err) {
    console.error('Error applying migration:', err.message);
    process.exit(1);
  }
}

run();
