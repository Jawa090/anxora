const db = require('../../config/database');
const Joi = require('joi');

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const createScoreSchema = Joi.object({
  candidateId: Joi.string().uuid().required(),
  criteriaId: Joi.string().uuid().required(),
  interviewId: Joi.string().uuid().optional(),
  rawScore: Joi.number().integer().min(0).required(), // Remove max limit, will be validated against criteria
  comments: Joi.string().optional()
});

const bulkScoreSchema = Joi.object({
  candidateId: Joi.string().uuid().required(),
  interviewId: Joi.string().uuid().optional(),
  scores: Joi.array().items(Joi.object({
    criteriaId: Joi.string().uuid().required(),
    rawScore: Joi.number().integer().min(0).required(), // Remove max limit
    comments: Joi.string().optional()
  })).min(1).required()
});

const createCriteriaSchema = Joi.object({
  criteriaName: Joi.string().required(),
  category: Joi.string().valid('technical', 'behavioral', 'experience', 'education').required(),
  description: Joi.string().optional(),
  maxScore: Joi.number().integer().min(1).max(100).default(100),
  weightPercentage: Joi.number().min(0).max(100).default(100)
});

// =====================================================
// SCORING CRITERIA MANAGEMENT
// =====================================================

// Create Scoring Criteria
exports.createCriteria = async (req, res) => {
  try {
    const { error, value } = createCriteriaSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.id;
    const organizationId = req.user.orgId;

    const result = await db.query(
      `INSERT INTO scoring_criteria (
        criteria_name, category, description, max_score, weight_percentage,
        created_by, organization_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        value.criteriaName, value.category, value.description,
        value.maxScore, value.weightPercentage, userId, organizationId
      ]
    );

    res.status(201).json({
      message: 'Scoring criteria created successfully',
      criteria: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating criteria:', error);
    res.status(500).json({ error: 'Failed to create scoring criteria' });
  }
};

// Get All Scoring Criteria
exports.getAllCriteria = async (req, res) => {
  try {
    const organizationId = req.user.orgId;
    const { category, isActive } = req.query;

    let query = 'SELECT * FROM scoring_criteria WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (organizationId) {
      paramCount++;
      query += ` AND (organization_id = $${paramCount} OR organization_id IS NULL)`;
      params.push(organizationId);
    }

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (isActive !== undefined) {
      paramCount++;
      query += ` AND is_active = $${paramCount}`;
      params.push(isActive === 'true');
    }

    query += ' ORDER BY category, criteria_name';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching criteria:', error);
    res.status(500).json({ error: 'Failed to fetch scoring criteria' });
  }
};

// =====================================================
// CANDIDATE SCORING FUNCTIONS
// =====================================================

// Submit Single Score
exports.submitScore = async (req, res) => {
  try {
    const { error, value } = createScoreSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.id;
    const userName = req.user.full_name;
    const userRole = req.user.role || 'Interviewer';

    // Get criteria details for weight calculation
    const criteriaResult = await db.query(
      'SELECT * FROM scoring_criteria WHERE id = $1',
      [value.criteriaId]
    );

    if (criteriaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Scoring criteria not found' });
    }

    const criteria = criteriaResult.rows[0];
    const weightedScore = (value.rawScore * criteria.weight_percentage) / 100;

    // Insert or update score
    const result = await db.query(
      `INSERT INTO candidate_scores (
        candidate_id, criteria_id, interview_id, raw_score, weighted_score,
        comments, scored_by, scorer_name, scorer_role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (candidate_id, criteria_id, scored_by) 
      DO UPDATE SET 
        raw_score = EXCLUDED.raw_score,
        weighted_score = EXCLUDED.weighted_score,
        comments = EXCLUDED.comments,
        updated_at = NOW()
      RETURNING *`,
      [
        value.candidateId, value.criteriaId, value.interviewId,
        value.rawScore, weightedScore, value.comments,
        userId, userName, userRole
      ]
    );

    // Recalculate overall ranking
    await this.calculateCandidateRanking(value.candidateId);

    res.status(201).json({
      message: 'Score submitted successfully',
      score: result.rows[0]
    });
  } catch (error) {
    console.error('Error submitting score:', error);
    res.status(500).json({ error: 'Failed to submit score' });
  }
};

// Submit Bulk Scores
exports.submitBulkScores = async (req, res) => {
  try {
    const { error, value } = bulkScoreSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.id;
    const userName = req.user.full_name;
    const userRole = req.user.role || 'Interviewer';

    // Get all criteria for weight calculations
    const criteriaIds = value.scores.map(s => s.criteriaId);
    const criteriaResult = await db.query(
      'SELECT * FROM scoring_criteria WHERE id = ANY($1)',
      [criteriaIds]
    );

    const criteriaMap = {};
    criteriaResult.rows.forEach(c => {
      criteriaMap[c.id] = c;
    });

    // Validate scores against criteria max_score
    for (const score of value.scores) {
      const criteria = criteriaMap[score.criteriaId];
      if (!criteria) {
        return res.status(400).json({ error: `Criteria not found: ${score.criteriaId}` });
      }
      if (score.rawScore > criteria.max_score) {
        return res.status(400).json({ 
          error: `Score ${score.rawScore} exceeds maximum ${criteria.max_score} for criteria: ${criteria.criteria_name}` 
        });
      }
    }

    // Prepare bulk insert
    const insertPromises = value.scores.map(async (score) => {
      const criteria = criteriaMap[score.criteriaId];
      const weightedScore = (score.rawScore * criteria.weight_percentage) / 100;

      return db.query(
        `INSERT INTO candidate_scores (
          candidate_id, criteria_id, interview_id, raw_score, weighted_score,
          comments, scored_by, scorer_name, scorer_role
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (candidate_id, criteria_id, scored_by) 
        DO UPDATE SET 
          raw_score = EXCLUDED.raw_score,
          weighted_score = EXCLUDED.weighted_score,
          comments = EXCLUDED.comments,
          updated_at = NOW()
        RETURNING *`,
        [
          value.candidateId, score.criteriaId, value.interviewId,
          score.rawScore, weightedScore, score.comments,
          userId, userName, userRole
        ]
      );
    });

    const results = await Promise.all(insertPromises);

    // Recalculate overall ranking
    await this.calculateCandidateRanking(value.candidateId);

    res.status(201).json({
      message: 'Bulk scores submitted successfully',
      scores: results.map(r => r.rows[0])
    });
  } catch (error) {
    console.error('Error submitting bulk scores:', error);
    res.status(500).json({ error: error.message || 'Failed to submit bulk scores' });
  }
};

// Get Candidate Scores
exports.getCandidateScores = async (req, res) => {
  try {
    const { candidateId } = req.params;

    const result = await db.query(
      `SELECT 
        cs.id,
        cs.candidate_id as "candidateId",
        cs.criteria_id as "criteriaId",
        sc.criteria_name as "criteriaName",
        sc.category,
        cs.raw_score as "rawScore",
        cs.weighted_score as "weightedScore",
        cs.comments,
        cs.scorer_name as "scorerName",
        cs.scored_at as "scoredAt"
       FROM candidate_scores cs
       JOIN scoring_criteria sc ON cs.criteria_id = sc.id
       WHERE cs.candidate_id = $1
       ORDER BY sc.category, sc.criteria_name, cs.scored_at DESC`,
      [candidateId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching candidate scores:', error);
    res.status(500).json({ error: 'Failed to fetch candidate scores' });
  }
};

// =====================================================
// RANKING SYSTEM
// =====================================================

// Calculate Candidate Ranking
exports.calculateCandidateRanking = async (candidateId) => {
  try {
    // Get candidate's requisition
    const candidateResult = await db.query(
      'SELECT requisition_id FROM candidates WHERE id = $1',
      [candidateId]
    );

    if (candidateResult.rows.length === 0) {
      throw new Error('Candidate not found');
    }

    const requisitionId = candidateResult.rows[0].requisition_id;

    // Calculate total weighted score
    const scoreResult = await db.query(
      `SELECT 
        SUM(cs.weighted_score) as total_score,
        AVG(cs.raw_score) FILTER (WHERE sc.category = 'technical') as technical_score,
        AVG(cs.raw_score) FILTER (WHERE sc.category = 'behavioral') as behavioral_score,
        AVG(cs.raw_score) FILTER (WHERE sc.category = 'experience') as experience_score,
        AVG(cs.raw_score) FILTER (WHERE sc.category = 'education') as education_score
       FROM candidate_scores cs
       JOIN scoring_criteria sc ON cs.criteria_id = sc.id
       WHERE cs.candidate_id = $1`,
      [candidateId]
    );

    const scores = scoreResult.rows[0];

    // Get all candidates for this requisition to calculate rank
    const allCandidatesResult = await db.query(
      `SELECT c.id, COALESCE(SUM(cs.weighted_score), 0) as total_score
       FROM candidates c
       LEFT JOIN candidate_scores cs ON c.id = cs.candidate_id
       WHERE c.requisition_id = $1
       GROUP BY c.id
       ORDER BY total_score DESC`,
      [requisitionId]
    );

    const allCandidates = allCandidatesResult.rows;
    const candidateRank = allCandidates.findIndex(c => c.id === candidateId) + 1;
    const percentile = ((allCandidates.length - candidateRank + 1) / allCandidates.length) * 100;

    // Insert or update ranking (calculated_by is NULL for system-calculated rankings)
    await db.query(
      `INSERT INTO candidate_rankings (
        candidate_id, requisition_id, total_score, rank_position, percentile,
        technical_score, behavioral_score, experience_score, education_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (candidate_id, requisition_id) 
      DO UPDATE SET 
        total_score = EXCLUDED.total_score,
        rank_position = EXCLUDED.rank_position,
        percentile = EXCLUDED.percentile,
        technical_score = EXCLUDED.technical_score,
        behavioral_score = EXCLUDED.behavioral_score,
        experience_score = EXCLUDED.experience_score,
        education_score = EXCLUDED.education_score,
        ranking_date = NOW()`,
      [
        candidateId, requisitionId, scores.total_score || 0, candidateRank, percentile,
        scores.technical_score || 0, scores.behavioral_score || 0,
        scores.experience_score || 0, scores.education_score || 0
      ]
    );

    return {
      candidateId,
      totalScore: scores.total_score || 0,
      rank: candidateRank,
      percentile: percentile.toFixed(2)
    };
  } catch (error) {
    console.error('Error calculating ranking:', error);
    throw error;
  }
};

// Get Requisition Rankings
exports.getRequisitionRankings = async (req, res) => {
  try {
    const { requisitionId } = req.params;

    const result = await db.query(
      `SELECT cr.*, c.full_name, c.email, c.status as candidate_status
       FROM candidate_rankings cr
       JOIN candidates c ON cr.candidate_id = c.id
       WHERE cr.requisition_id = $1 AND cr.is_current = true
       ORDER BY cr.rank_position ASC`,
      [requisitionId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rankings:', error);
    res.status(500).json({ error: 'Failed to fetch candidate rankings' });
  }
};

// Get Scoring Analytics
exports.getScoringAnalytics = async (req, res) => {
  try {
    const organizationId = req.user.orgId;
    const { requisitionId, department } = req.query;

    let query = `
      SELECT 
        sc.criteria_name,
        sc.category,
        AVG(cs.raw_score) as avg_score,
        MIN(cs.raw_score) as min_score,
        MAX(cs.raw_score) as max_score,
        COUNT(cs.id) as total_scores
      FROM candidate_scores cs
      JOIN scoring_criteria sc ON cs.criteria_id = sc.id
      JOIN candidates c ON cs.candidate_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (organizationId) {
      paramCount++;
      query += ` AND c.organization_id = $${paramCount}`;
      params.push(organizationId);
    }

    if (requisitionId) {
      paramCount++;
      query += ` AND c.requisition_id = $${paramCount}`;
      params.push(requisitionId);
    }

    if (department) {
      paramCount++;
      query += ` AND c.department = $${paramCount}`;
      params.push(department);
    }

    query += ' GROUP BY sc.criteria_name, sc.category ORDER BY sc.category, avg_score DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching scoring analytics:', error);
    res.status(500).json({ error: 'Failed to fetch scoring analytics' });
  }
};
