const fs = require('fs');
const path = require('path');
// Load dotenv from the backend directory regardless of where the script is called from
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../config/database');

async function runSchema() {
  try {
    console.log('Reading schema.sql...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running schema in database...');
    // We execute the SQL schema query.
    // Note: Since schema.sql might contain multiple statements, 
    // pg's pool.query can execute them if they are separated by semicolons.
    await db.query(sql);

    console.log('✅ Schema executed successfully and tables created!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to run schema:', error);
    process.exit(1);
  }
}

runSchema();
