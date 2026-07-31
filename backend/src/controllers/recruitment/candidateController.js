const db = require('../../config/database');
const Joi = require('joi');
const nodemailer = require('nodemailer');
const notificationService = require('../../services/notificationService');

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Validation Schema
const createCandidateSchema = Joi.object({
  requisitionId: Joi.string().required(), // Allow human-readable or UUID
  fullName: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().required(),
  alternatePhone: Joi.string().optional().allow(''),
  cnic: Joi.string().optional().allow(''),
  dateOfBirth: Joi.date().optional(),
  gender: Joi.string().optional().allow(''),
  maritalStatus: Joi.string().optional().allow(''),
  nationality: Joi.string().default('Pakistani'),
  religion: Joi.string().optional().allow(''),
  currentAddress: Joi.string().optional().allow(''),
  permanentAddress: Joi.string().optional().allow(''),
  highestQualification: Joi.string().optional().allow(''),
  university: Joi.string().optional().allow(''),
  graduationYear: Joi.number().optional(),
  cgpa: Joi.string().optional().allow(''),
  totalExperience: Joi.string().optional().allow(''),
  currentCompany: Joi.string().optional().allow(''),
  currentDesignation: Joi.string().optional().allow(''),
  currentSalary: Joi.string().optional().allow(''),
  expectedSalary: Joi.string().optional().allow(''),
  noticePeriod: Joi.string().optional().allow(''),
  appliedPosition: Joi.string().required(),
  grade: Joi.string().optional().allow(''),
  department: Joi.string().optional().allow(''),
  reference1Name: Joi.string().optional().allow(''),
  reference1Contact: Joi.string().optional().allow(''),
  reference1Relation: Joi.string().optional().allow(''),
  reference2Name: Joi.string().optional().allow(''),
  reference2Contact: Joi.string().optional().allow(''),
  reference2Relation: Joi.string().optional().allow(''),
  emergencyContactName: Joi.string().optional().allow(''),
  emergencyContactPhone: Joi.string().optional().allow(''),
  emergencyContactRelation: Joi.string().optional().allow(''),
  skills: Joi.array().items(Joi.string()).optional(),
  source: Joi.string().optional().allow('')
});

// Create Candidate
exports.createCandidate = async (req, res) => {
  try {
    const { error, value } = createCandidateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const organizationId = req.user.orgId;
    let requisitionId = value.requisitionId;

    // If requisitionId is not a UUID, try to find the actual ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(requisitionId)) {
      const fieldResult = await db.query(
        'SELECT id FROM job_requisitions WHERE requisition_id = $1 OR id::text = $1',
        [requisitionId]
      );
      if (fieldResult.rows.length === 0) {
        return res.status(404).json({ error: 'Requisition not found with the provided ID' });
      }
      requisitionId = fieldResult.rows[0].id;
    }

    const result = await db.query(
      `INSERT INTO candidates (
        requisition_id, full_name, email, phone, alternate_phone, cnic,
        date_of_birth, gender, marital_status, nationality, religion,
        current_address, permanent_address, highest_qualification, university,
        graduation_year, cgpa, total_experience, current_company, current_designation,
        current_salary, expected_salary, notice_period, applied_position, grade,
        department, reference1_name, reference1_contact, reference1_relation,
        reference2_name, reference2_contact, reference2_relation,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
        skills, source, organization_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
        $30, $31, $32, $33, $34, $35, $36, $37, $38
      ) RETURNING *`,
      [
        requisitionId, value.fullName, value.email, value.phone,
        value.alternatePhone, value.cnic, value.dateOfBirth, value.gender,
        value.maritalStatus, value.nationality, value.religion, value.currentAddress,
        value.permanentAddress, value.highestQualification, value.university,
        value.graduationYear, value.cgpa, value.totalExperience, value.currentCompany,
        value.currentDesignation, value.currentSalary, value.expectedSalary,
        value.noticePeriod, value.appliedPosition, value.grade, value.department,
        value.reference1Name, value.reference1Contact, value.reference1Relation,
        value.reference2Name, value.reference2Contact, value.reference2Relation,
        value.emergencyContactName, value.emergencyContactPhone,
        value.emergencyContactRelation, value.skills || [], value.source, organizationId
      ]
    );

    const candidate = result.rows[0];

    // Add timeline entry
    await db.query(
      `INSERT INTO candidate_timeline (
        candidate_id, activity_type, description, performed_by, performed_by_name
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        candidate.id,
        'application_received',
        'Application received',
        req.user.id,
        req.user.full_name
      ]
    );

    res.status(201).json({
      message: 'Candidate created successfully',
      candidate
    });
  } catch (error) {
    console.error('Error creating candidate:', error);
    res.status(500).json({ error: 'Failed to create candidate' });
  }
};

// Upload CV with parsing
exports.uploadCV = async (req, res) => {
  
  try {
    const organizationId = req.user.orgId;
    const { requisitionId, source } = req.body;

    // Check if file was uploaded
    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ error: 'No CV file uploaded' });
    }

    if (!requisitionId) {
      console.error('No requisition ID provided');
      return res.status(400).json({ error: 'Requisition ID is required' });
    }

    let actualRequisitionId = requisitionId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(actualRequisitionId)) {
      console.log(`uploadCV: RequisitionId ${actualRequisitionId} is not a UUID, searching...`);
      const reqLookup = await db.query(
        'SELECT id FROM job_requisitions WHERE requisition_id = $1 OR id::text = $1',
        [actualRequisitionId]
      );
      if (reqLookup.rows.length === 0) {
        return res.status(404).json({ error: 'Requisition not found' });
      }
      actualRequisitionId = reqLookup.rows[0].id;
    }

    const cvFile = req.file;
    const fs = require('fs');
    
    // Use the file path as multer stored it on disk
    const cvBuffer = fs.readFileSync(cvFile.path);

    // Extract text from CV based on file type
    let cvText = '';
    let parseSuccess = false;
    
    try {
      
      if (cvFile.mimetype === 'application/pdf') {

        try {
          const pdfParse = require('pdf-parse');
          const pdfData = await pdfParse(cvBuffer);
          cvText = pdfData.text;
          parseSuccess = true;
          console.log('Extracted text from PDF, length:', cvText.length);
        } catch (pdfError) {
          console.error('PDF parsing failed:', pdfError.message);
          cvText = '';
        }
      } else if (cvFile.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        try {
          const mammoth = require('mammoth');
          const result = await mammoth.extractRawText({ buffer: cvBuffer });
          cvText = result.value;
          parseSuccess = true;
          console.log('Extracted text from DOCX, length:', cvText.length);
        } catch (docxError) {
          console.error('DOCX parsing failed:', docxError.message);
          cvText = '';
        }
      } else if (cvFile.mimetype === 'application/msword') {
        try {
          const mammoth = require('mammoth');
          const result = await mammoth.extractRawText({ buffer: cvBuffer });
          cvText = result.value;
          parseSuccess = true;
        } catch (docError) {
          console.error('DOC parsing failed:', docError.message);
          cvText = '';
        }
      } else if (cvFile.mimetype === 'text/plain') {
        cvText = cvBuffer.toString('utf-8');
        parseSuccess = true;
      } else {
        console.error('Unsupported file type:', cvFile.mimetype);
        return res.status(400).json({ error: 'Unsupported file format. Please upload PDF, DOC, DOCX, or TXT' });
      }
      
      if (parseSuccess) {
      } else {
      }
    } catch (parseError) {
      console.error('Error during text extraction:', parseError);
      console.error('Parse error stack:', parseError.stack);
      console.log('Continuing with empty text - will create candidate with CV file only');
      cvText = '';
    }

    
    // Parse CV to extract information
    const cvParser = require('../../utils/cvParser');
    const parsedData = cvParser.parseCV(cvText);
    
    
    // If parsing failed or no data extracted, use filename as fallback
    if (!parsedData.fullName && !parsedData.email) {
      parsedData.fullName = cvFile.originalname.replace(/\.(pdf|docx?|txt)$/i, '');
      // Generate a placeholder email if none found
      parsedData.email = `candidate_${Date.now()}@placeholder.com`;
      console.log('Using placeholder email:', parsedData.email);
    }
    
    // Ensure email is not null (database constraint)
    if (!parsedData.email) {
      parsedData.email = `candidate_${Date.now()}@placeholder.com`;
      console.log('Email was null, using placeholder:', parsedData.email);
    }

    console.log('Using multer saved file:', cvFile.filename);
    const fileName = cvFile.filename;

    console.log('Creating candidate record in database...');
    
    // Create candidate with parsed data
    const result = await db.query(
      `INSERT INTO candidates (
        requisition_id, full_name, email, phone, skills, 
        total_experience, highest_qualification, current_company,
        current_designation, current_salary, expected_salary, notice_period,
        source, status, organization_id, cv_url, applied_position
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        actualRequisitionId,
        parsedData.fullName || 'Unknown Candidate',
        parsedData.email,
        parsedData.phone || null,
        parsedData.skills || [],
        parsedData.totalExperience ? parsedData.totalExperience.toString() : null,
        parsedData.highestQualification || null,
        parsedData.currentCompany || null,
        parsedData.currentDesignation || null,
        parsedData.currentSalary || null,
        parsedData.expectedSalary || null,
        parsedData.noticePeriod || null,
        source || 'cv_upload',
        'cv_received',
        organizationId,
        `/uploads/cvs/${fileName}`,
        'Position from CV'
      ]
    );

    const candidate = result.rows[0];
    console.log('Candidate created with ID:', candidate.id);

    console.log('Updating applied position from requisition...');
    
    // Update applied_position from requisition
    const reqResult = await db.query(
      'SELECT position FROM job_requisitions WHERE id = $1',
      [actualRequisitionId]
    );
    if (reqResult.rows.length > 0) {
      await db.query(
        'UPDATE candidates SET applied_position = $1 WHERE id = $2',
        [reqResult.rows[0].position, candidate.id]
      );
      candidate.applied_position = reqResult.rows[0].position;
      console.log('Applied position updated to:', candidate.applied_position);
    }

    console.log('Adding timeline entry...');
    
    // Add timeline entry
    await db.query(
      `INSERT INTO candidate_timeline (
        candidate_id, activity_type, description, performed_by, performed_by_name
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        candidate.id,
        'cv_uploaded',
        `CV uploaded: ${cvFile.originalname}`,
        req.user.id,
        req.user.full_name
      ]
    );
    
    return res.status(201).json({
      message: 'CV uploaded and parsed successfully',
      candidate,
      parsedData
    });
    
  } catch (error) {
    console.error('=== CV Upload Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Make sure we always send JSON response
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: 'Failed to upload CV', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
};

// Get All Candidates
exports.getCandidates = async (req, res) => {
  try {
    const organizationId = req.user.orgId;
    const { status, requisitionId, search } = req.query;

    let query = `
      SELECT c.*, r.position as requisition_position, r.department as requisition_department
      FROM candidates c
      LEFT JOIN job_requisitions r ON c.requisition_id = r.id
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
      query += ` AND c.status = $${paramCount}`;
      params.push(status);
    }

    if (requisitionId) {
      paramCount++;
      query += ` AND c.requisition_id = $${paramCount}`;
      params.push(requisitionId);
    }

    if (search) {
      paramCount++;
      query += ` AND (c.full_name ILIKE $${paramCount} OR c.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY c.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
};

// Get Candidate by ID
exports.getCandidateById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.orgId;

    let query = `
      SELECT c.*, r.position as requisition_position, r.requisition_id
      FROM candidates c
      LEFT JOIN job_requisitions r ON c.requisition_id = r.id
      WHERE c.id = $1
    `;
    const params = [id];

    if (organizationId) {
      query += ' AND c.organization_id = $2';
      params.push(organizationId);
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const candidate = result.rows[0];

    // Get interview history
    const interviewsResult = await db.query(
      `SELECT * FROM candidate_interviews 
       WHERE candidate_id = $1 
       ORDER BY interview_date DESC`,
      [id]
    );
    candidate.interviewHistory = interviewsResult.rows;

    // Get timeline
    const timelineResult = await db.query(
      `SELECT * FROM candidate_timeline 
       WHERE candidate_id = $1 
       ORDER BY created_at DESC`,
      [id]
    );
    candidate.timeline = timelineResult.rows;

    res.json(candidate);
  } catch (error) {
    console.error('Error fetching candidate:', error);
    res.status(500).json({ error: 'Failed to fetch candidate' });
  }
};

// Update Candidate Status
exports.updateCandidateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const organizationId = req.user.orgId;

    const validStatuses = ['cv_received', 'shortlisted', 'interview_scheduled', 'interviewed', 'final_round', 'selected', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    let query = 'UPDATE candidates SET status = $1, updated_at = NOW() WHERE id = $2';
    const params = [status, id];

    if (organizationId) {
      query += ' AND organization_id = $3';
      params.push(organizationId);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Notify organization admins about the status change
    const admins = await notificationService.getOrgAdmins(organizationId);
    notificationService.notify(
      organizationId,
      admins,
      'candidate_status_changed',
      'Candidate Status Updated',
      `Candidate "${result.rows[0].full_name}" is now ${status.replace('_', ' ')}`,
      `/recruitment/candidates/${id}`,
      req.user.id,
      { candidateId: id, status }
    );

    res.json({
      message: 'Candidate status updated successfully',
      candidate: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating candidate status:', error);
    res.status(500).json({ error: 'Failed to update candidate status' });
  }
};

// Shortlist Candidate
exports.shortlistCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    return exports.updateCandidateStatus(
      { ...req, params: { id }, body: { status: 'shortlisted' } },
      res
    );
  } catch (error) {
    console.error('Error shortlisting candidate:', error);
    res.status(500).json({ error: 'Failed to shortlist candidate' });
  }
};

// Delete Candidate
exports.deleteCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.orgId;

    let query = 'DELETE FROM candidates WHERE id = $1';
    const params = [id];

    if (organizationId) {
      query += ' AND organization_id = $2';
      params.push(organizationId);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    res.json({ message: 'Candidate deleted successfully' });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ error: 'Failed to delete candidate' });
  }
};
// Screen Candidate (First step after CV upload)
exports.screenCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    const { screeningNotes, screeningResult } = req.body; // 'passed' or 'failed'
    
    if (!['passed', 'failed'].includes(screeningResult)) {
      return res.status(400).json({ error: 'Invalid screening result. Must be "passed" or "failed"' });
    }

    const organizationId = req.user.orgId;
    const newStatus = screeningResult === 'passed' ? 'screened_passed' : 'screened_failed';

    let query = 'UPDATE candidates SET status = $1, screening_notes = $2, updated_at = NOW() WHERE id = $3';
    const params = [newStatus, screeningNotes, id];

    if (organizationId) {
      query += ' AND organization_id = $4';
      params.push(organizationId);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Add timeline entry
    await db.query(
      `INSERT INTO candidate_timeline (
        candidate_id, activity_type, description, performed_by, performed_by_name
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        'screening_completed',
        `Screening completed: ${screeningResult}. Notes: ${screeningNotes || 'No notes'}`,
        req.user.id,
        req.user.full_name
      ]
    );

    res.json({
      message: `Candidate screening completed: ${screeningResult}`,
      candidate: result.rows[0]
    });
  } catch (error) {
    console.error('Error screening candidate:', error);
    res.status(500).json({ error: 'Failed to screen candidate' });
  }
};

// Send Interview Email
exports.sendInterviewEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { interviewDate, interviewTime, interviewLocation, interviewType, additionalNotes } = req.body;

    // Get candidate details
    const candidateResult = await db.query(
      'SELECT c.*, r.position, r.department FROM candidates c LEFT JOIN job_requisitions r ON c.requisition_id = r.id WHERE c.id = $1',
      [id]
    );

    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const candidate = candidateResult.rows[0];

    // Create email content
    const emailSubject = `Interview Invitation - ${candidate.position} Position`;
    const emailBody = `
Dear ${candidate.full_name},

Congratulations! We are pleased to inform you that you have been shortlisted for the ${candidate.position} position in our ${candidate.department} department.

We would like to invite you for an interview with the following details:

📅 Date: ${interviewDate}
🕐 Time: ${interviewTime}
📍 Location: ${interviewLocation}
💼 Interview Type: ${interviewType}

${additionalNotes ? `Additional Notes:\n${additionalNotes}` : ''}

Please confirm your availability by replying to this email. If you have any questions or need to reschedule, please contact us immediately.

We look forward to meeting you!

Best regards,
HR Department
    `;

    // Send email (if SMTP is configured)
    try {
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: candidate.email,
          subject: emailSubject,
          text: emailBody
        });
      }
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Continue even if email fails
    }

    // Update candidate status
    await db.query(
      'UPDATE candidates SET status = $1, updated_at = NOW() WHERE id = $2',
      ['interview_scheduled', id]
    );

    // Add timeline entry
    await db.query(
      `INSERT INTO candidate_timeline (
        candidate_id, activity_type, description, performed_by, performed_by_name
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        'interview_scheduled',
        `Interview scheduled for ${interviewDate} at ${interviewTime}. Location: ${interviewLocation}`,
        req.user.id,
        req.user.full_name
      ]
    );

    res.json({
      message: 'Interview email sent successfully',
      emailSent: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      interviewDetails: {
        date: interviewDate,
        time: interviewTime,
        location: interviewLocation,
        type: interviewType
      }
    });
  } catch (error) {
    console.error('Error sending interview email:', error);
    res.status(500).json({ error: 'Failed to send interview email' });
  }
};

// Generate Application Form based on GD (Grade)
exports.generateApplicationForm = async (req, res) => {
  try {
    console.log('=== Generate Form Request ===');
    console.log('Candidate ID:', req.params.id);
    console.log('User:', req.user);
    
    const { id } = req.params;

    // Get candidate details with requisition info
    const candidateResult = await db.query(
      'SELECT c.*, r.position, r.department, r.grade FROM candidates c LEFT JOIN job_requisitions r ON c.requisition_id = r.id WHERE c.id = $1',
      [id]
    );

    if (candidateResult.rows.length === 0) {
      console.error('Candidate not found:', id);
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const candidate = candidateResult.rows[0];
    console.log('Candidate found:', candidate.full_name);
    
    // Generate unique token for public form access
    const crypto = require('crypto');
    const formToken = crypto.randomBytes(32).toString('hex');
    const formExpiresAt = new Date();
    formExpiresAt.setDate(formExpiresAt.getDate() + 7); // Valid for 7 days

    console.log('Generated token:', formToken);
    console.log('Expires at:', formExpiresAt);

    // Save token to database and set form_status to 'generated'
    await db.query(
      'UPDATE candidates SET form_token = $1, form_token_expires_at = $2, form_status = $3 WHERE id = $4',
      [formToken, formExpiresAt, 'generated', id]
    );

    console.log('Token saved to database');

    // Generate public form URL
    const formUrl = `${process.env.APP_URL || 'http://localhost:8080'}/public/application-form/${formToken}`;

    console.log('Form URL:', formUrl);

    res.json({
      message: 'Application form link generated successfully',
      formUrl,
      expiresAt: formExpiresAt,
      candidate: {
        id: candidate.id,
        name: candidate.full_name,
        position: candidate.position
      }
    });
  } catch (error) {
    console.error('=== Generate Form Error ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Failed to generate application form', details: error.message });
  }
};

// Get candidate by form token (public access)
exports.getCandidateByToken = async (req, res) => {
  try {
    console.log('=== Get Candidate By Token ===');
    const { token } = req.params;
    console.log('Token:', token);

    const result = await db.query(
      `SELECT c.*, r.position, r.department 
       FROM candidates c 
       LEFT JOIN job_requisitions r ON c.requisition_id = r.id 
       WHERE c.form_token = $1 AND c.form_token_expires_at > NOW()`,
      [token]
    );

    console.log('Query result rows:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('Token not found or expired');
      return res.status(404).json({ error: 'Invalid or expired form link' });
    }

    const candidate = result.rows[0];
    console.log('Candidate found:', candidate.full_name);
    
    // Return only necessary data (no sensitive info)
    res.json({
      id: candidate.id,
      fullName: candidate.full_name,
      email: candidate.email,
      phone: candidate.phone,
      position: candidate.position,
      department: candidate.department,
      // Pre-filled data from CV
      fatherName: candidate.father_name,
      fatherOccupation: candidate.father_occupation,
      address: candidate.current_address,
      bloodGroup: candidate.blood_group,
      religion: candidate.religion,
      dateOfBirth: candidate.date_of_birth,
      cnic: candidate.cnic,
      maritalStatus: candidate.marital_status,
      numberOfChildren: candidate.number_of_children,
      residenceType: candidate.residence_type,
      highestQualification: candidate.highest_qualification,
      university: candidate.university,
      graduationYear: candidate.graduation_year,
      totalExperience: candidate.total_experience,
      currentCompany: candidate.current_company,
      currentDesignation: candidate.current_designation,
      currentSalary: candidate.current_salary,
      expectedSalary: candidate.expected_salary
    });
  } catch (error) {
    console.error('=== Get Candidate By Token Error ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch form data' });
  }
};

// Submit public application form
exports.submitPublicApplicationForm = async (req, res) => {
  try {
    const { token } = req.params;
    const formData = req.body;

    // Verify token
    const candidateResult = await db.query(
      'SELECT id FROM candidates WHERE form_token = $1 AND form_token_expires_at > NOW()',
      [token]
    );

    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired form link' });
    }

    const candidateId = candidateResult.rows[0].id;

    // Helper function to safely convert values
    const safeString = (value) => (value && typeof value === 'string' && value.trim()) ? value.trim() : null;
    const safeDate = (value) => (value && typeof value === 'string' && value.trim()) ? value : null;
    const safeInt = (value) => {
      if (!value || (typeof value === 'string' && !value.trim())) return null;
      const parsed = parseInt(value);
      return isNaN(parsed) ? null : parsed;
    };

    // Update candidate with complete form data and set form_status to 'submitted'
    await db.query(
      `UPDATE candidates SET
        full_name = $1,
        father_name = $2,
        father_occupation = $3,
        current_address = $4,
        mobile_no = $5,
        blood_group = $6,
        religion = $7,
        date_of_birth = $8,
        cnic = $9,
        email = $10,
        marital_status = $11,
        number_of_children = $12,
        residence_type = $13,
        academic_records = $14,
        work_experience = $15,
        current_salary = $16,
        expected_salary = $17,
        joining_availability = $18,
        form_status = 'submitted',
        updated_at = NOW()
      WHERE id = $19`,
      [
        safeString(formData.fullName),
        safeString(formData.fatherName),
        safeString(formData.fatherOccupation),
        safeString(formData.address),
        safeString(formData.mobileNo),
        safeString(formData.bloodGroup),
        safeString(formData.religion),
        safeDate(formData.dateOfBirth),
        safeString(formData.cnic),
        safeString(formData.email),
        safeString(formData.maritalStatus),
        safeInt(formData.numberOfChildren),
        safeString(formData.residenceType),
        JSON.stringify(formData.academicRecords || []),
        JSON.stringify(formData.workExperience || []),
        safeInt(formData.currentSalary),
        safeInt(formData.expectedSalary),
        safeString(formData.joiningAvailability),
        candidateId
      ]
    );

    // Invalidate token after submission
    await db.query(
      'UPDATE candidates SET form_token = NULL, form_token_expires_at = NULL WHERE id = $1',
      [candidateId]
    );

    res.json({
      message: 'Application form submitted successfully',
      success: true
    });
  } catch (error) {
    console.error('Error submitting application form:', error);
    res.status(500).json({ error: 'Failed to submit application form' });
  }
};

// Download CV
exports.downloadCV = async (req, res) => {
  console.log('=== Download CV Request ===');
  console.log('Params:', req.params);
  console.log('User:', req.user);
  
  try {
    const { id } = req.params;
    const organizationId = req.user.orgId;

    let query = 'SELECT cv_url, full_name FROM candidates WHERE id = $1';
    const params = [id];

    if (organizationId) {
      query += ' AND organization_id = $2';
      params.push(organizationId);
    }

    console.log('Query:', query);
    console.log('Query params:', params);

    const result = await db.query(query, params);

    console.log('Query result rows:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('Candidate not found');
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const candidate = result.rows[0];
    console.log('Candidate:', candidate);

    if (!candidate.cv_url) {
      console.log('No CV URL');
      return res.status(404).json({ error: 'CV not found for this candidate' });
    }

    const path = require('path');
    const fs = require('fs');
    // cv_url is like '/uploads/cvs/filename.pdf'
    const relativePath = candidate.cv_url.startsWith('/') ? candidate.cv_url.substring(1) : candidate.cv_url;
    const filePath = path.join(__dirname, '../../../public/', relativePath);

    console.log('File path:', filePath);
    console.log('File exists:', fs.existsSync(filePath));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'CV file not found on server' });
    }

    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);
    const downloadName = `${candidate.full_name.replace(/\s+/g, '_')}_CV${ext}`;

    console.log('Sending file:', downloadName);
    res.download(filePath, downloadName);
  } catch (error) {
    console.error('Error downloading CV:', error);
    res.status(500).json({ error: 'Failed to download CV' });
  }
};
