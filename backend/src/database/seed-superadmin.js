const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
// Load dotenv from the backend directory regardless of where the script is called from
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../config/database');

async function seedSuperAdmin() {
  try {
    console.log('Starting Super Admin seeding');

    // 1. Ensure columns and ENUM exist in database
    console.log('Ensuring ENUM and columns exist in database...');
    await db.query(`
      DO $$ 
      BEGIN 
        -- Create ENUM if not exists
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'manager', 'team_lead', 'employee');
        END IF;

        -- Alter role column type if it's still varchar
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'role' AND data_type = 'character varying'
        ) THEN
          ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role;
        END IF;

        -- Ensure org_id references organizations
        -- (Already in schema.sql but defensive check here)
      END $$;
    `);

    // 2. Create Super Admin Organization
    const orgId = uuidv4();
    const orgName = 'Anxora';

    console.log('Creating System Organization...');
    await db.query(
      'INSERT INTO organizations (id, name, address ) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [orgId, orgName, 'Rush Corporation Block H3 Johr Town, Lahore']
    );

    // Get the orgId
    const orgResult = await db.query('SELECT id FROM organizations WHERE name = $1 LIMIT 1', [orgName]);
    const finalOrgId = orgResult.rows[0].id;

    // 3. Create Super Admin User
    const userId = uuidv4();
    const email = 'superadmin@anxora.com';
    const password = 'password123';

    const hashedPassword = await bcrypt.hash(password, 10);

    

    console.log('Creating Super Admin User...'); 
    
    
    await db.query(
      `INSERT INTO users (id, org_id, organization_id, email, password_hash, full_name, role) 
       VALUES ($1, $2, $2, $3, $4, $5, $6) 
       ON CONFLICT (email) DO NOTHING`,
      [userId, finalOrgId, email, hashedPassword, 'Super Admin', 'super_admin']
    );

    console.log('\n✅ Super Admin Seeding completed successfully!');
    console.log('-----------------------------------');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('-----------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedSuperAdmin();
