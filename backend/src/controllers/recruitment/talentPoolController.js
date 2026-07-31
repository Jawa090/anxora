const db = require('../../config/database');
const Joi = require('joi');

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const createTalentPoolSchema = Joi.object({
  poolName: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  poolType: Joi.string().valid('skill_based', 'department_based', 'level_based', 'custom').default('skill_based'),
  targetSkills: Joi.array().items(Joi.string()).optional(),
  targetDepartments: Joi.array().items(Joi.string()).optional(),
  targetExperienceMin: Joi.number().integer().min(0).optional(),
  targetExperienceMax: Joi.number().integer().min(0).optional(),
  targetEducationLevel: Joi.string().allow('').optional()
});

const addToPoolSchema = Joi.object({
  candidateIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  notes: Joi.string().optional(),
  contactFrequency: Joi.string().valid('weekly', 'monthly', 'quarterly').default('monthly')
});

const updateMemberStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'hired_elsewhere', 'not_interested').required(),
  notes: Joi.string().optional(),
  availabilityStatus: Joi.string().valid('available', 'not_available', 'considering_offers').optional()
});

// =====================================================
// TALENT POOL MANAGEMENT
// =====================================================

// Create Talent Pool
exports.createTalentPool = async (req, res) => {
  try {
    console.log('Creating talent pool with data:', req.body);
    
    const { error, value } = createTalentPoolSchema.validate(req.body);
    if (error) {
      console.error('Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.id;
    const organizationId = req.user.orgId; // Fixed: auth middleware uses orgId, not organization_id

    console.log('User ID:', userId, 'Organization ID:', organizationId);

    const result = await db.query(
      `INSERT INTO talent_pools (
        pool_name, description, pool_type, target_skills, target_departments,
        target_experience_min, target_experience_max, target_education_level,
        created_by, managed_by, organization_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        value.poolName, value.description, value.poolType,
        value.targetSkills, value.targetDepartments,
        value.targetExperienceMin, value.targetExperienceMax,
        value.targetEducationLevel, userId, userId, organizationId
      ]
    );

    console.log('Talent pool created successfully:', result.rows[0]);

    res.status(201).json({
      message: 'Talent pool created successfully',
      talentPool: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating talent pool:', error);
    res.status(500).json({ 
      error: 'Failed to create talent pool',
      details: error.message 
    });
  }
};

// Get All Talent Pools
exports.getAllTalentPools = async (req, res) => {
  try {
    const organizationId = req.user.orgId; // Fixed: auth middleware uses orgId
    const { poolType, isActive } = req.query;

    let query = `
      SELECT tp.*, 
             u1.full_name as created_by_name,
             u2.full_name as managed_by_name,
             COUNT(tpm.id) as member_count,
             COUNT(tpm.id) FILTER (WHERE tpm.status = 'active') as active_members
      FROM talent_pools tp
      LEFT JOIN users u1 ON tp.created_by = u1.id
      LEFT JOIN users u2 ON tp.managed_by = u2.id
      LEFT JOIN talent_pool_members tpm ON tp.id = tpm.pool_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (organizationId) {
      paramCount++;
      query += ` AND tp.organization_id = $${paramCount}`;
      params.push(organizationId);
    }

    if (poolType) {
      paramCount++;
      query += ` AND tp.pool_type = $${paramCount}`;
      params.push(poolType);
    }

    if (isActive !== undefined) {
      paramCount++;
      query += ` AND tp.is_active = $${paramCount}`;
      params.push(isActive === 'true');
    }

    query += ' GROUP BY tp.id, u1.full_name, u2.full_name ORDER BY tp.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching talent pools:', error);
    res.status(500).json({ error: 'Failed to fetch talent pools' });
  }
};

// Get Talent Pool by ID
exports.getTalentPoolById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.orgId; // Fixed: auth middleware uses orgId

    // Get pool details
    const poolResult = await db.query(
      `SELECT tp.*, u1.full_name as created_by_name, u2.full_name as managed_by_name
       FROM talent_pools tp
       LEFT JOIN users u1 ON tp.created_by = u1.id
       LEFT JOIN users u2 ON tp.managed_by = u2.id
       WHERE tp.id = $1 AND tp.organization_id = $2`,
      [id, organizationId]
    );

    if (poolResult.rows.length === 0) {
      return res.status(404).json({ error: 'Talent pool not found' });
    }

    const pool = poolResult.rows[0];

    // Get pool members
    const membersResult = await db.query(
      `SELECT tpm.*, c.full_name, c.email, c.phone, c.current_designation,
              c.total_experience, c.skills, c.status as candidate_status,
              cr.total_score, cr.rank_position
       FROM talent_pool_members tpm
       JOIN candidates c ON tpm.candidate_id = c.id
       LEFT JOIN candidate_rankings cr ON c.id = cr.candidate_id AND cr.is_current = true
       WHERE tpm.pool_id = $1
       ORDER BY tpm.added_date DESC`,
      [id]
    );

    pool.members = membersResult.rows;

    res.json(pool);
  } catch (error) {
    console.error('Error fetching talent pool:', error);
    res.status(500).json({ error: 'Failed to fetch talent pool' });
  }
};

// Add Candidates to Talent Pool
exports.addCandidatesToPool = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = addToPoolSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.id;

    // Verify pool exists
    const poolResult = await db.query(
      'SELECT * FROM talent_pools WHERE id = $1',
      [id]
    );

    if (poolResult.rows.length === 0) {
      return res.status(404).json({ error: 'Talent pool not found' });
    }

    // Add candidates to pool
    const insertPromises = value.candidateIds.map(candidateId => 
      db.query(
        `INSERT INTO talent_pool_members (
          pool_id, candidate_id, added_by, notes, contact_frequency
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (pool_id, candidate_id) DO NOTHING
        RETURNING *`,
        [id, candidateId, userId, value.notes, value.contactFrequency]
      )
    );

    const results = await Promise.all(insertPromises);
    const addedMembers = results.filter(r => r.rows.length > 0).map(r => r.rows[0]);

    // Add timeline entries for each candidate
    const timelinePromises = addedMembers.map(member =>
      db.query(
        `INSERT INTO candidate_timeline (
          candidate_id, activity_type, description, performed_by, performed_by_name
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          member.candidate_id,
          'added_to_talent_pool',
          `Added to talent pool: ${poolResult.rows[0].pool_name}`,
          userId,
          req.user.full_name
        ]
      )
    );

    await Promise.all(timelinePromises);

    res.status(201).json({
      message: `${addedMembers.length} candidates added to talent pool`,
      addedMembers: addedMembers.length,
      totalRequested: value.candidateIds.length
    });
  } catch (error) {
    console.error('Error adding candidates to pool:', error);
    res.status(500).json({ error: 'Failed to add candidates to talent pool' });
  }
};

// Update Pool Member Status
exports.updateMemberStatus = async (req, res) => {
  try {
    const { poolId, memberId } = req.params;
    const { error, value } = updateMemberStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    let updateFields = ['status = $1'];
    let updateParams = [value.status];
    let paramCount = 1;

    if (value.notes) {
      paramCount++;
      updateFields.push(`notes = $${paramCount}`);
      updateParams.push(value.notes);
    }

    if (value.availabilityStatus) {
      paramCount++;
      updateFields.push(`availability_status = $${paramCount}`);
      updateParams.push(value.availabilityStatus);
    }

    paramCount++;
    updateParams.push(memberId);

    const result = await db.query(
      `UPDATE talent_pool_members 
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      updateParams
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pool member not found' });
    }

    res.json({
      message: 'Member status updated successfully',
      member: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating member status:', error);
    res.status(500).json({ error: 'Failed to update member status' });
  }
};

// Search Talent Pool
exports.searchTalentPool = async (req, res) => {
  try {
    console.log('Search talent pool request:', req.query);
    
    const organizationId = req.user.orgId; // Fixed: auth middleware uses orgId
    const { 
      skills, 
      experience, 
      department, 
      education, 
      availability,
      minScore 
    } = req.query;

    let query = `
      SELECT DISTINCT c.*, tpm.pool_score, tpm.availability_status,
             tp.pool_name, cr.total_score, cr.rank_position
      FROM candidates c
      JOIN talent_pool_members tpm ON c.id = tpm.candidate_id
      JOIN talent_pools tp ON tpm.pool_id = tp.id
      LEFT JOIN candidate_rankings cr ON c.id = cr.candidate_id AND cr.is_current = true
      WHERE tpm.status = 'active' AND tp.is_active = true
    `;
    const params = [];
    let paramCount = 0;

    if (organizationId) {
      paramCount++;
      query += ` AND c.organization_id = $${paramCount}`;
      params.push(organizationId);
    }

    if (skills) {
      paramCount++;
      query += ` AND c.skills && $${paramCount}`;
      params.push(skills.split(','));
    }

    if (experience) {
      paramCount++;
      query += ` AND c.total_experience >= $${paramCount}`;
      params.push(experience);
    }

    if (department) {
      paramCount++;
      query += ` AND c.department = $${paramCount}`;
      params.push(department);
    }

    if (education) {
      paramCount++;
      query += ` AND c.highest_qualification ILIKE $${paramCount}`;
      params.push(`%${education}%`);
    }

    if (availability) {
      paramCount++;
      query += ` AND tpm.availability_status = $${paramCount}`;
      params.push(availability);
    }

    if (minScore) {
      paramCount++;
      query += ` AND (cr.total_score >= $${paramCount} OR tpm.pool_score >= $${paramCount})`;
      params.push(minScore);
    }

    query += ' ORDER BY cr.total_score DESC NULLS LAST, tpm.pool_score DESC NULLS LAST';

    console.log('Final search query:', query);
    console.log('Query params:', params);

    const result = await db.query(query, params);
    
    console.log(`Found ${result.rows.length} candidates`);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error searching talent pool:', error);
    res.status(500).json({ error: 'Failed to search talent pool' });
  }
};

// Get Talent Pool Analytics
exports.getTalentPoolAnalytics = async (req, res) => {
  try {
    const organizationId = req.user.orgId; // Fixed: auth middleware uses orgId

    let orgFilter = '1=1';
    const params = [];
    if (organizationId) {
      orgFilter = 'tp.organization_id = $1';
      params.push(organizationId);
    }

    const analytics = await db.query(`
      SELECT 
        COUNT(DISTINCT tp.id) as total_pools,
        COUNT(DISTINCT tpm.id) as total_members,
        COUNT(DISTINCT tpm.id) FILTER (WHERE tpm.status = 'active') as active_members,
        COUNT(DISTINCT tpm.id) FILTER (WHERE tpm.status = 'hired_elsewhere') as hired_members,
        COUNT(DISTINCT tpm.id) FILTER (WHERE tpm.availability_status = 'available') as available_members,
        AVG(tpm.pool_score) as avg_pool_score,
        COUNT(DISTINCT tp.id) FILTER (WHERE tp.pool_type = 'skill_based') as skill_based_pools,
        COUNT(DISTINCT tp.id) FILTER (WHERE tp.pool_type = 'department_based') as department_based_pools
      FROM talent_pools tp
      LEFT JOIN talent_pool_members tpm ON tp.id = tpm.pool_id
      WHERE ${orgFilter}
    `, params);

    // Get top skills in talent pools
    const topSkills = await db.query(`
      SELECT 
        unnest(c.skills) as skill,
        COUNT(*) as candidate_count
      FROM talent_pool_members tpm
      JOIN candidates c ON tpm.candidate_id = c.id
      JOIN talent_pools tp ON tpm.pool_id = tp.id
      WHERE tpm.status = 'active' AND ${orgFilter.replace('tp.organization_id', 'c.organization_id')}
      GROUP BY skill
      ORDER BY candidate_count DESC
      LIMIT 10
    `, params);

    res.json({
      overview: analytics.rows[0],
      topSkills: topSkills.rows
    });
  } catch (error) {
    console.error('Error fetching talent pool analytics:', error);
    res.status(500).json({ error: 'Failed to fetch talent pool analytics' });
  }
};

// Remove Candidate from Pool
exports.removeCandidateFromPool = async (req, res) => {
  try {
    const { poolId, memberId } = req.params;

    const result = await db.query(
      'DELETE FROM talent_pool_members WHERE id = $1 AND pool_id = $2 RETURNING *',
      [memberId, poolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pool member not found' });
    }

    res.json({ message: 'Candidate removed from talent pool successfully' });
  } catch (error) {
    console.error('Error removing candidate from pool:', error);
    res.status(500).json({ error: 'Failed to remove candidate from pool' });
  }
};
