const db = require('../../config/database');

// Get all inquiries
const getAllInquiries = async (req, res, next) => {
  try {
    const { workspaceId, carId, status, assignedTo } = req.query;

    let query = `
      SELECT 
        ci.*,
        car.make, car.model, car.year, car.stock_number,
        cw.name as workspace_name,
        u.full_name as assigned_to_name
      FROM car_inquiries ci
      LEFT JOIN car_inventory car ON ci.car_id = car.id
      LEFT JOIN car_workspaces cw ON ci.workspace_id = cw.id
      LEFT JOIN users u ON ci.assigned_to = u.id
      WHERE ci.org_id = $1
    `;
    
    const params = [req.user.orgId];
    let paramIndex = 2;

    if (workspaceId) {
      query += ` AND ci.workspace_id = $${paramIndex}`;
      params.push(workspaceId);
      paramIndex++;
    }

    if (carId) {
      query += ` AND ci.car_id = $${paramIndex}`;
      params.push(carId);
      paramIndex++;
    }

    if (status) {
      query += ` AND ci.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (assignedTo) {
      query += ` AND ci.assigned_to = $${paramIndex}`;
      params.push(assignedTo);
      paramIndex++;
    }

    query += ` ORDER BY ci.created_at DESC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get all inquiries error:', err);
    next(err);
  }
};

// Create inquiry
const createInquiry = async (req, res, next) => {
  try {
    const {
      workspaceId,
      carId,
      customerName,
      customerEmail,
      customerPhone,
      contactId,
      inquiryType,
      message,
      preferredContactMethod,
      preferredContactTime,
      source
    } = req.body;

    if (!workspaceId || !carId || !customerName) {
      return res.status(400).json({ 
        error: 'Workspace, car, and customer name are required' 
      });
    }

    const result = await db.query(
      `INSERT INTO car_inquiries (
        org_id, workspace_id, car_id, customer_name, customer_email,
        customer_phone, contact_id, inquiry_type, message,
        preferred_contact_method, preferred_contact_time, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        req.user.orgId, workspaceId, carId, customerName, customerEmail || null,
        customerPhone || null, contactId || null, inquiryType || 'general',
        message || null, preferredContactMethod || null, preferredContactTime || null,
        source || 'website'
      ]
    );

    // Log activity
    await db.query(
      `INSERT INTO car_activity_log (org_id, workspace_id, car_id, activity_type, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.orgId, workspaceId, carId, 'inquiry',
        `New inquiry from ${customerName}`
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create inquiry error:', err);
    next(err);
  }
};

// Update inquiry
const updateInquiry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, priority, assignedTo, followUpDate, followUpNotes } = req.body;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(status); }
    if (priority !== undefined) { fields.push(`priority = $${paramIndex++}`); values.push(priority); }
    if (assignedTo !== undefined) { fields.push(`assigned_to = $${paramIndex++}`); values.push(assignedTo); }
    if (followUpDate !== undefined) { fields.push(`follow_up_date = $${paramIndex++}`); values.push(followUpDate); }
    if (followUpNotes !== undefined) { fields.push(`follow_up_notes = $${paramIndex++}`); values.push(followUpNotes); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE car_inquiries SET ${fields.join(', ')} 
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update inquiry error:', err);
    next(err);
  }
};

module.exports = {
  getAllInquiries,
  createInquiry,
  updateInquiry
};
