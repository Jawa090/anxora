const db = require('../../config/database');
const Joi = require('joi');

// Validation Schema
const createInterviewSchema = Joi.object({
  candidateId: Joi.string().uuid().required(),
  requisitionId: Joi.string().required(), // Allow human-readable ID or UUID
  interviewType: Joi.string().valid('technical', 'hr', 'final').required(),
  interviewDate: Joi.date().required(),
  interviewTime: Joi.string().required(),
  interviewerId: Joi.string().uuid().optional(),
  interviewerName: Joi.string().optional()
});

const submitFeedbackSchema = Joi.object({
  technicalSkills: Joi.string().required(),
  communication: Joi.string().required(),
  problemSolving: Joi.string().required(),
  cultureFit: Joi.string().required(),
  overallRemarks: Joi.string().required(),
  recommendation: Joi.string().valid('strongly_recommend', 'recommend', 'maybe', 'not_recommend', 'reject').required(),
  finalResult: Joi.string().valid('selected', 'rejected').optional()
});

// Schedule Interview
exports.scheduleInterview = async (req, res) => {
  try {
    console.log('Schedule interview request body:', req.body);

    const { error, value } = createInterviewSchema.validate(req.body);
    if (error) {
      console.error('Validation error:', error.details[0].message);
      console.error('Received data:', req.body);
      return res.status(400).json({
        error: error.details[0].message,
        field: error.details[0].path[0],
        receivedValue: req.body[error.details[0].path[0]]
      });
    }

    const userId = req.user.id;
    const userName = req.user.full_name;
    let requisitionId = value.requisitionId;

    // If requisitionId is not a UUID, try to find the actual ID from the human-readable requisition_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(requisitionId)) {
      console.log(`RequisitionId ${requisitionId} is not a UUID, searching for record...`);
      const reqResult = await db.query(
        'SELECT id FROM job_requisitions WHERE requisition_id = $1 OR id::text = $1',
        [requisitionId]
      );

      if (reqResult.rows.length === 0) {
        return res.status(404).json({ error: 'Requisition not found with the provided ID' });
      }

      requisitionId = reqResult.rows[0].id;
      console.log(`Found actual UUID for requisition: ${requisitionId}`);
    }

    const result = await db.query(
      `INSERT INTO candidate_interviews (
        candidate_id, requisition_id, interview_type, interview_date,
        interview_time, interviewer_id, interviewer_name, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        value.candidateId,
        requisitionId,
        value.interviewType,
        value.interviewDate,
        value.interviewTime,
        value.interviewerId || userId,
        value.interviewerName || userName,
        'scheduled'
      ]
    );

    const interview = result.rows[0];

    // Update candidate status
    await db.query(
      'UPDATE candidates SET status = $1, updated_at = NOW() WHERE id = $2',
      ['interview_scheduled', value.candidateId]
    );

    // Add timeline entry
    await db.query(
      `INSERT INTO candidate_timeline (
        candidate_id, activity_type, description, performed_by, performed_by_name
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        value.candidateId,
        'interview_scheduled',
        `${value.interviewType} interview scheduled for ${value.interviewDate}`,
        userId,
        userName
      ]
    );

    res.status(201).json({
      message: 'Interview scheduled successfully',
      interview
    });
  } catch (error) {
    console.error('Error scheduling interview:', error);
    res.status(500).json({ error: 'Failed to schedule interview' });
  }
};

// Submit Interview Feedback
exports.submitFeedback = async (req, res) => {
  try {
    const { id } = req.params; // interview ID
    const { error, value } = submitFeedbackSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Get interview details
    const interviewResult = await db.query(
      'SELECT * FROM candidate_interviews WHERE id = $1',
      [id]
    );

    if (interviewResult.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const interview = interviewResult.rows[0];

    // Update interview with feedback
    const result = await db.query(
      `UPDATE candidate_interviews SET
        technical_skills = $1,
        communication = $2,
        problem_solving = $3,
        culture_fit = $4,
        overall_remarks = $5,
        recommendation = $6,
        final_result = $7,
        status = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING *`,
      [
        value.technicalSkills,
        value.communication,
        value.problemSolving,
        value.cultureFit,
        value.overallRemarks,
        value.recommendation,
        value.finalResult || null,
        'completed',
        id
      ]
    );

    // Update candidate status
    let candidateStatus = 'interviewed';
    if (interview.interview_type === 'final' && value.finalResult) {
      candidateStatus = value.finalResult; // 'selected' or 'rejected'
    } else if (value.recommendation === 'reject') {
      candidateStatus = 'rejected';
    }

    await db.query(
      'UPDATE candidates SET status = $1, updated_at = NOW() WHERE id = $2',
      [candidateStatus, interview.candidate_id]
    );

    // Add timeline entry
    await db.query(
      `INSERT INTO candidate_timeline (
        candidate_id, activity_type, description, performed_by, performed_by_name
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        interview.candidate_id,
        'interviewed',
        `${interview.interview_type} interview completed - ${value.recommendation}`,
        req.user.id,
        req.user.full_name
      ]
    );

    res.json({
      message: 'Interview feedback submitted successfully',
      interview: result.rows[0]
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
};

// Get Interviews for Candidate
exports.getCandidateInterviews = async (req, res) => {
  try {
    const { candidateId } = req.params;

    const result = await db.query(
      `SELECT i.*, c.full_name as candidate_name
       FROM candidate_interviews i
       JOIN candidates c ON i.candidate_id = c.id
       WHERE i.candidate_id = $1
       ORDER BY i.interview_date DESC`,
      [candidateId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching interviews:', error);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
};

// Get All Scheduled Interviews
exports.getScheduledInterviews = async (req, res) => {
  try {
    const organizationId = req.user.orgId;

    let query = `
      SELECT i.*, c.full_name as candidate_name, c.email as candidate_email,
             r.position, r.requisition_id
      FROM candidate_interviews i
      JOIN candidates c ON i.candidate_id = c.id
      JOIN job_requisitions r ON i.requisition_id = r.id
      WHERE i.status = 'scheduled'
    `;
    const params = [];

    // Add organization filter only if organizationId is not null
    if (organizationId) {
      query += ' AND c.organization_id = $1';
      params.push(organizationId);
    }

    query += ' ORDER BY i.interview_date ASC, i.interview_time ASC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching scheduled interviews:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled interviews' });
  }
};

// Cancel Interview
exports.cancelInterview = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE candidate_interviews SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      ['cancelled', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    res.json({
      message: 'Interview cancelled successfully',
      interview: result.rows[0]
    });
  } catch (error) {
    console.error('Error cancelling interview:', error);
    res.status(500).json({ error: 'Failed to cancel interview' });
  }
};
// Get All Interviews (for Interview Tab)
exports.getAllInterviews = async (req, res) => {
  try {
    const organizationId = req.user.orgId;
    const { status, interviewType, date } = req.query;

    let query = `
      SELECT i.*, c.full_name as candidate_name, c.email as candidate_email,
             c.phone as candidate_phone, c.status as candidate_status, c.form_status,
             r.position, r.requisition_id, r.department
      FROM candidate_interviews i
      JOIN candidates c ON i.candidate_id = c.id
      JOIN job_requisitions r ON i.requisition_id = r.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // Add organization filter only if organizationId is not null
    if (organizationId) {
      paramCount++;
      query += ` AND c.organization_id = $${paramCount}`;
      params.push(organizationId);
    }

    if (status) {
      paramCount++;
      query += ` AND i.status = $${paramCount}`;
      params.push(status);
    }

    if (interviewType) {
      paramCount++;
      query += ` AND i.interview_type = $${paramCount}`;
      params.push(interviewType);
    }

    if (date) {
      paramCount++;
      query += ` AND i.interview_date = $${paramCount}`;
      params.push(date);
    }

    query += ' ORDER BY i.interview_date ASC, i.interview_time ASC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching interviews:', error);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
};

// Conduct Interview (Start Interview)
exports.conductInterview = async (req, res) => {
  try {
    const { id } = req.params;

    // Update interview status to in_progress
    const result = await db.query(
      'UPDATE candidate_interviews SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      ['in_progress', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const interview = result.rows[0];

    // Add timeline entry
    await db.query(
      `INSERT INTO candidate_timeline (
        candidate_id, activity_type, description, performed_by, performed_by_name
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        interview.candidate_id,
        'interview_started',
        `${interview.interview_type} interview started`,
        req.user.id,
        req.user.full_name
      ]
    );

    res.json({
      message: 'Interview started successfully',
      interview: result.rows[0]
    });
  } catch (error) {
    console.error('Error conducting interview:', error);
    res.status(500).json({ error: 'Failed to start interview' });
  }
};

// Recommend for Final Interview
exports.recommendFinalInterview = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { remarks } = req.body;

    // Get candidate details
    const candidateResult = await db.query(
      'SELECT c.*, r.id as requisition_id FROM candidates c LEFT JOIN job_requisitions r ON c.requisition_id = r.id WHERE c.id = $1',
      [candidateId]
    );

    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const candidate = candidateResult.rows[0];

    // Schedule final interview (auto-schedule for next available slot)
    const finalInterviewDate = new Date();
    finalInterviewDate.setDate(finalInterviewDate.getDate() + 3); // 3 days from now

    const finalInterview = await db.query(
      `INSERT INTO candidate_interviews (
        candidate_id, requisition_id, interview_type, interview_date,
        interview_time, interviewer_id, interviewer_name, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        candidateId,
        candidate.requisition_id,
        'final',
        finalInterviewDate.toISOString().split('T')[0],
        '10:00',
        req.user.id,
        req.user.full_name,
        'scheduled'
      ]
    );

    // Update candidate status
    await db.query(
      'UPDATE candidates SET status = $1, updated_at = NOW() WHERE id = $2',
      ['final_round', candidateId]
    );

    // Add timeline entry
    await db.query(
      `INSERT INTO candidate_timeline (
        candidate_id, activity_type, description, performed_by, performed_by_name
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        candidateId,
        'final_interview_recommended',
        `Recommended for final interview. ${remarks || 'No additional remarks'}`,
        req.user.id,
        req.user.full_name
      ]
    );

    res.json({
      message: 'Candidate recommended for final interview',
      finalInterview: finalInterview.rows[0],
      candidate: candidate
    });
  } catch (error) {
    console.error('Error recommending final interview:', error);
    res.status(500).json({ error: 'Failed to recommend final interview' });
  }
};

// Get Interview Statistics
exports.getInterviewStats = async (req, res) => {
  try {
    const organizationId = req.user.orgId;

    let orgFilter = '1=1';
    const params = [];
    if (organizationId) {
      orgFilter = 'c.organization_id = $1';
      params.push(organizationId);
    }

    const stats = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE i.status = 'scheduled') as scheduled_count,
        COUNT(*) FILTER (WHERE i.status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE i.status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE i.interview_type = 'technical') as technical_count,
        COUNT(*) FILTER (WHERE i.interview_type = 'hr') as hr_count,
        COUNT(*) FILTER (WHERE i.interview_type = 'final') as final_count,
        COUNT(*) FILTER (WHERE i.interview_date = CURRENT_DATE) as today_count
      FROM candidate_interviews i
      JOIN candidates c ON i.candidate_id = c.id
      WHERE ${orgFilter}
    `, params);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Error fetching interview stats:', error);
    res.status(500).json({ error: 'Failed to fetch interview stats' });
  }
};
