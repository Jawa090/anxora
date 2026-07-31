const db = require('../../config/database');
const Joi = require('joi');
const notificationService = require('../../services/notificationService');

// ==================== LEAVE TYPES ====================

const getLeaveTypes = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM leave_types 
       WHERE org_id = $1 AND is_active = true
       ORDER BY name`,
      [req.user.orgId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
};

const createLeaveType = async (req, res, next) => {
  try {
    const schema = Joi.object({
      name: Joi.string().required(),
      code: Joi.string().required(),
      description: Joi.string().allow(''),
      color: Joi.string().default('#3B82F6'),
      days_allowed: Joi.number().required(),
      max_consecutive_days: Joi.number().optional(),
      min_days_notice: Joi.number().default(0),
      is_paid: Joi.boolean().default(true),
      requires_approval: Joi.boolean().default(true),
      can_carry_forward: Joi.boolean().default(false),
      max_carry_forward_days: Joi.number().default(0),
      expires_after_months: Joi.number().optional(),
      applicable_to: Joi.string().valid('all', 'male', 'female').default('all'),
      min_service_months: Joi.number().default(0),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await db.query(
      `INSERT INTO leave_types (
        org_id, name, code, description, color, days_allowed,
        max_consecutive_days, min_days_notice, is_paid, requires_approval,
        can_carry_forward, max_carry_forward_days, expires_after_months,
        applicable_to, min_service_months
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        req.user.orgId, value.name, value.code, value.description, value.color,
        value.days_allowed, value.max_consecutive_days, value.min_days_notice,
        value.is_paid, value.requires_approval, value.can_carry_forward,
        value.max_carry_forward_days, value.expires_after_months,
        value.applicable_to, value.min_service_months
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Leave type code already exists' });
    }
    next(err);
  }
};

const updateLeaveType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [req.user.orgId, id];
    let paramIndex = 3;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push('updated_at = NOW()');

    const result = await db.query(
      `UPDATE leave_types SET ${fields.join(', ')}
       WHERE org_id = $1 AND id = $2
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Leave type not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ==================== LEAVE BALANCES ====================

const getEmployeeBalance = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const year = req.query.year || new Date().getFullYear();

    const result = await db.query(
      `SELECT 
        lb.id,
        lb.employee_id,
        lb.leave_type_id,
        lb.org_id,
        lb.year,
        lb.total_allocated,
        lb.used,
        lb.pending,
        lb.available,
        lb.carried_forward,
        lt.name as leave_type_name,
        lt.code as leave_type_code,
        lt.color as leave_type_color,
        lt.can_carry_forward
      FROM employee_leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = $1 AND lb.org_id = $2 AND lb.year = $3
      ORDER BY lt.name`,
      [employeeId, req.user.orgId, year]
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
};

const getMyBalance = async (req, res, next) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get current user's employee record
    const empResult = await db.query(
      'SELECT id FROM employees WHERE email = $1 AND org_id = $2',
      [req.user.email, req.user.orgId]
    );

    let employeeId = empResult.rows[0]?.id;

    if (!employeeId) {
      // Super admin doesn't need personal leave tracking
      if (req.user.role === 'super_admin') {
        return res.json({ data: [] });
      }

      // Auto-create a minimal employee record for admin/manager/employee users without one
      try {
        const userResult = await db.query(
          'SELECT full_name FROM public.users WHERE id = $1',
          [req.user.id]
        );
        const fullName = userResult.rows[0]?.full_name || req.user.email.split('@')[0];
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || fullName;
        const lastName = nameParts.slice(1).join(' ') || '';

        const newEmp = await db.query(
          `INSERT INTO employees (org_id, first_name, last_name, email, status)
           VALUES ($1, $2, $3, $4, 'active')
           ON CONFLICT (email, org_id) DO UPDATE SET status = employees.status
           RETURNING id`,
          [req.user.orgId, firstName, lastName, req.user.email]
        );
        employeeId = newEmp.rows[0]?.id;
      } catch (_) {
        // Fallback if insert fails — return leave types as placeholder
        const types = await db.query(
          'SELECT id, name, code, color, days_allowed, monthly_limit FROM leave_types WHERE org_id = $1 AND is_active = true ORDER BY name',
          [req.user.orgId]
        );
        return res.json({
          data: types.rows.map(lt => ({
            leave_type_id: lt.id,
            leave_type_name: lt.name,
            leave_type_code: lt.code,
            leave_type_color: lt.color,
            total_allocated: lt.days_allowed,
            monthly_limit: lt.monthly_limit,
            used: 0, pending: 0, available: lt.days_allowed,
            carried_forward: 0,
            monthly_used: 0,
            monthly_remaining: lt.monthly_limit || null,
            year,
          }))
        });
      }

      // Auto-initialize leave balances for this new employee
      if (employeeId) {
        const types = await db.query(
          'SELECT id, days_allowed FROM leave_types WHERE org_id = $1 AND is_active = true',
          [req.user.orgId]
        );
        for (const lt of types.rows) {
          await db.query(
            `INSERT INTO employee_leave_balances (employee_id, leave_type_id, org_id, year, total_allocated, used, pending)
             VALUES ($1, $2, $3, $4, $5, 0, 0)
             ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING`,
            [employeeId, lt.id, req.user.orgId, year, lt.days_allowed || 0]
          ).catch(() => {});
        }
      }
    }

    // Auto-reset monthly leave types if the month has changed since last reset
    const now2 = new Date();
    const currentYear = now2.getFullYear();
    const currentMonth = now2.getMonth() + 1;
    const firstOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

    try {
      const monthlyResetCheck = await db.query(
        `SELECT lb.id, lb.last_monthly_reset
         FROM employee_leave_balances lb
         JOIN leave_types lt ON lb.leave_type_id = lt.id
         WHERE lb.employee_id = $1 AND lb.org_id = $2 AND lb.year = $3 AND lt.resets_monthly = true`,
        [employeeId, req.user.orgId, year]
      );
      for (const row of monthlyResetCheck.rows) {
        const lastReset = row.last_monthly_reset ? new Date(row.last_monthly_reset) : null;
        const needsReset = !lastReset
          || lastReset.getFullYear() < currentYear
          || (lastReset.getFullYear() === currentYear && lastReset.getMonth() + 1 < currentMonth);
        if (needsReset) {
          await db.query(
            'UPDATE employee_leave_balances SET used = 0, pending = 0, last_monthly_reset = $1 WHERE id = $2',
            [firstOfMonth, row.id]
          );
        }
      }
    } catch (_) { /* columns not yet migrated — skip auto-reset */ }

    const result = await db.query(
      `SELECT
        lb.id,
        lb.employee_id,
        lb.leave_type_id,
        lb.org_id,
        lb.year,
        lb.total_allocated,
        lb.used,
        lb.pending,
        lb.available,
        lb.carried_forward,
        lb.last_monthly_reset,
        lt.name as leave_type_name,
        lt.code as leave_type_code,
        lt.color as leave_type_color,
        lt.can_carry_forward,
        lt.days_allowed,
        lt.monthly_limit,
        lt.resets_monthly,
        COALESCE((
          SELECT SUM(lr.days_requested)
          FROM leave_requests lr
          WHERE lr.employee_id = lb.employee_id
            AND lr.leave_type_id = lb.leave_type_id
            AND lr.status IN ('approved', 'pending')
            AND lr.start_date >= $4
            AND lr.start_date <= $5
        ), 0) as monthly_used
      FROM employee_leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = $1 AND lb.org_id = $2 AND lb.year = $3
      ORDER BY lt.name`,
      [employeeId, req.user.orgId, year, monthStart, monthEnd]
    );

    // If no balances exist yet — auto-initialize from leave_types and return them
    if (result.rows.length === 0) {
      const types = await db.query(
        'SELECT id, name, code, color, days_allowed, monthly_limit FROM leave_types WHERE org_id = $1 AND is_active = true ORDER BY name',
        [req.user.orgId]
      );

      // Auto-create balance rows
      for (const lt of types.rows) {
        await db.query(
          `INSERT INTO employee_leave_balances (employee_id, leave_type_id, org_id, year, total_allocated, used, pending)
           VALUES ($1, $2, $3, $4, $5, 0, 0)
           ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING`,
          [employeeId, lt.id, req.user.orgId, year, lt.days_allowed || 0]
        ).catch(() => {});
      }

      return res.json({
        data: types.rows.map(lt => ({
          leave_type_id: lt.id,
          leave_type_name: lt.name,
          leave_type_code: lt.code,
          leave_type_color: lt.color,
          total_allocated: lt.days_allowed || 0,
          monthly_limit: lt.monthly_limit,
          used: 0, pending: 0, available: lt.days_allowed || 0,
          carried_forward: 0,
          monthly_used: 0,
          monthly_remaining: lt.monthly_limit || null,
          year,
        }))
      });
    }

    const rows = result.rows.map(r => ({
      ...r,
      monthly_used: parseFloat(r.monthly_used || 0),
      monthly_remaining: r.monthly_limit
        ? Math.max(0, r.monthly_limit - parseFloat(r.monthly_used || 0))
        : null,
    }));

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const initializeEmployeeBalance = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const year = req.body.year || new Date().getFullYear();

    // Get all active leave types
    const leaveTypes = await db.query(
      'SELECT * FROM leave_types WHERE org_id = $1 AND is_active = true',
      [req.user.orgId]
    );

    // Create balance entries for each leave type
    const insertPromises = leaveTypes.rows.map(lt => 
      db.query(
        `INSERT INTO employee_leave_balances (
          employee_id, leave_type_id, org_id, year, total_allocated
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING
        RETURNING *`,
        [employeeId, lt.id, req.user.orgId, year, lt.days_allowed]
      )
    );

    await Promise.all(insertPromises);

    // Return updated balances
    const result = await db.query(
      `SELECT 
        lb.*,
        lt.name as leave_type_name,
        lt.code as leave_type_code
      FROM employee_leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = $1 AND lb.org_id = $2 AND lb.year = $3`,
      [employeeId, req.user.orgId, year]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// ==================== LEAVE REQUESTS ====================

const getLeaveRequests = async (req, res, next) => {
  try {
    const { status, employeeId, startDate, endDate, mine, createdToday } = req.query;

    const isAdminRole = ['super_admin', 'admin', 'manager'].includes(req.user.role);

    // mine=true forces own-employee filter (used by MyLeavesTab for all roles)
    // Admins/managers without mine=true see all org requests
    let targetEmployeeId = employeeId;
    if (!targetEmployeeId && (!isAdminRole || mine === 'true')) {
      const empResult = await db.query(
        'SELECT id FROM employees WHERE email = $1 AND org_id = $2',
        [req.user.email, req.user.orgId]
      );
      if (empResult.rows.length > 0) {
        targetEmployeeId = empResult.rows[0].id;
      }
    }

    let query = `
      SELECT
        lr.*,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.department,
        lt.name as leave_type_name,
        lt.code as leave_type_code,
        lt.color as leave_type_color,
        lt.days_allowed as leave_type_days_allowed,
        lt.monthly_limit as leave_type_monthly_limit,
        u.full_name as approver_name,
        eu.avatar_url as avatar_url,
        elb.total_allocated as bal_total,
        elb.used as bal_used,
        elb.pending as bal_pending,
        elb.available as bal_available,
        elb.carried_forward as bal_carried_forward,
        COALESCE((
          SELECT SUM(lr2.days_requested)
          FROM leave_requests lr2
          WHERE lr2.employee_id = lr.employee_id
            AND lr2.leave_type_id = lr.leave_type_id
            AND lr2.status IN ('approved', 'pending')
            AND EXTRACT(YEAR FROM lr2.start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
            AND EXTRACT(MONTH FROM lr2.start_date) = EXTRACT(MONTH FROM CURRENT_DATE)
        ), 0) as bal_monthly_used,
        (
          SELECT json_agg(json_build_object(
            'code', lt2.code,
            'name', lt2.name,
            'color', lt2.color,
            'available', GREATEST(0, elb2.total_allocated - elb2.used - elb2.pending),
            'total', elb2.total_allocated
          ) ORDER BY lt2.name)
          FROM employee_leave_balances elb2
          JOIN leave_types lt2 ON lt2.id = elb2.leave_type_id
          WHERE elb2.employee_id = lr.employee_id
            AND elb2.year = EXTRACT(YEAR FROM CURRENT_DATE)
            AND lt2.org_id = lr.org_id
        ) as all_balances
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users u ON lr.approver_id = u.id
      LEFT JOIN users eu ON e.user_id = eu.id
      LEFT JOIN employee_leave_balances elb
        ON elb.employee_id = lr.employee_id
        AND elb.leave_type_id = lr.leave_type_id
        AND elb.year = EXTRACT(YEAR FROM CURRENT_DATE)
      WHERE lr.org_id = $1
    `;

    const params = [req.user.orgId];
    let paramIndex = 2;

    if (status && status !== 'all') {
      query += ` AND lr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (targetEmployeeId) {
      query += ` AND lr.employee_id = $${paramIndex}`;
      params.push(targetEmployeeId);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND lr.end_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND lr.start_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (createdToday === 'true') {
      query += ` AND lr.created_at >= CURRENT_DATE AND lr.created_at < CURRENT_DATE + INTERVAL '1 day'`;
    }

    query += ' ORDER BY lr.created_at DESC';

    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
};

const createLeaveRequest = async (req, res, next) => {
  try {
    const schema = Joi.object({
      leave_type_id: Joi.string().uuid().required(),
      start_date: Joi.date().required(),
      end_date: Joi.date().required(),
      days_requested: Joi.number().required(),
      half_day: Joi.boolean().default(false),
      reason: Joi.string().required(),
      emergency: Joi.boolean().default(false),
      contact_during_leave: Joi.string().allow(''),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Get current user's employee record
    const empResult = await db.query(
      'SELECT id FROM employees WHERE email = $1 AND org_id = $2',
      [req.user.email, req.user.orgId]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee record not found' });
    }

    const employeeId = empResult.rows[0].id;

    // Check if employee has sufficient balance
    const year = new Date(value.start_date).getFullYear();
    const balance = await db.query(
      `SELECT * FROM employee_leave_balances
       WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`,
      [employeeId, value.leave_type_id, year]
    );

    // Get monthly usage for info
    const now = new Date(value.start_date);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthlyUsed = await db.query(
      `SELECT COALESCE(SUM(days_requested), 0) as used
       FROM leave_requests
       WHERE employee_id = $1 AND leave_type_id = $2
         AND status IN ('approved', 'pending')
         AND start_date >= $3 AND start_date <= $4`,
      [employeeId, value.leave_type_id, monthStart, monthEnd]
    );
    const monthUsedDays = parseFloat(monthlyUsed.rows[0].used || 0);

    let available = 0;
    let balanceWarning = null;

    if (balance.rows.length === 0) {
      balanceWarning = 'no_balance';
    } else {
      available = parseFloat(balance.rows[0].available);
      if (available <= 0) balanceWarning = 'zero_balance';
      else if (available < value.days_requested) balanceWarning = 'insufficient_balance';
    }

    // Get leave type monthly_limit
    const ltResult = await db.query('SELECT monthly_limit FROM leave_types WHERE id = $1', [value.leave_type_id]);
    const monthlyLimit = ltResult.rows[0]?.monthly_limit || null;
    if (monthlyLimit && monthUsedDays + value.days_requested > monthlyLimit) {
      balanceWarning = 'monthly_limit_exceeded';
    }

    // Create leave request (allow even with zero balance — HR will decide paid/unpaid)
    const result = await db.query(
      `INSERT INTO leave_requests (
        employee_id, leave_type_id, org_id, start_date, end_date,
        days_requested, half_day, reason, emergency, contact_during_leave, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
      RETURNING *`,
      [
        employeeId, value.leave_type_id, req.user.orgId,
        value.start_date, value.end_date, value.days_requested,
        value.half_day, value.reason, value.emergency, value.contact_during_leave
      ]
    );

    // Update pending balance (only if balance exists)
    if (balance.rows.length > 0) {
      await db.query(
        `UPDATE employee_leave_balances
         SET pending = pending + $1, updated_at = NOW()
         WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4`,
        [value.days_requested, employeeId, value.leave_type_id, year]
      );
    }

    // Add comment
    await db.query(
      `INSERT INTO leave_request_comments (leave_request_id, user_id, comment, action)
       VALUES ($1, $2, $3, 'submitted')`,
      [result.rows[0].id, req.user.id, 'Leave request submitted']
    );

    // Notify admin + manager (NOT super_admin) about the new leave request
    const leaveType = await db.query('SELECT name FROM leave_types WHERE id = $1', [value.leave_type_id]);
    const leaveTypeName = leaveType.rows[0]?.name || 'Leave';
    const startFmt = new Date(value.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endFmt = new Date(value.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const notifyTitle = 'New Leave Request';
    const notifyMsg = `${req.user.full_name || req.user.email} requested ${leaveTypeName} from ${startFmt} to ${endFmt}`;

    // Fetch admin + manager only (exclude super_admin)
    const hrAdmins = await notificationService.getOrgUsersByRole(req.user.orgId, ['admin', 'manager']);

    // Insert into hrms_notifications for each recipient (skip self)
    for (const userId of hrAdmins) {
      if (String(userId) === String(req.user.id)) continue;
      await db.query(
        `INSERT INTO hrms_notifications (org_id, user_id, notification_type, title, message, data, priority)
         VALUES ($1, $2, 'leave_request', $3, $4, $5, 'high')`,
        [
          req.user.orgId,
          userId,
          notifyTitle,
          notifyMsg,
          JSON.stringify({ leaveRequestId: result.rows[0].id, actionUrl: '/hrms/leave?tab=team-leaves' }),
        ]
      );
    }

    // Also send via global notification service
    notificationService.notify(
      req.user.orgId,
      hrAdmins,
      'leave_requested',
      notifyTitle,
      notifyMsg,
      `/hrms/leave?tab=team-leaves`,
      req.user.id,
      { leaveRequestId: result.rows[0].id }
    );

    res.status(201).json({
      ...result.rows[0],
      balance_warning: balanceWarning,
      available_days: available,
      monthly_used: monthUsedDays,
    });
  } catch (err) {
    next(err);
  }
};

const updateLeaveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason, paid_status } = req.body;

    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (paid_status && !['paid', 'unpaid'].includes(paid_status)) {
      return res.status(400).json({ error: 'paid_status must be paid or unpaid' });
    }

    const leaveReq = await db.query(
      'SELECT * FROM leave_requests WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );
    if (leaveReq.rows.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const leave = leaveReq.rows[0];
    const year = new Date(leave.start_date).getFullYear();

    // Determine final paid_status
    const finalPaidStatus = status === 'approved'
      ? (paid_status || 'paid')
      : null;

    const result = await db.query(
      `UPDATE leave_requests
       SET status = $1, approver_id = $2, approved_at = NOW(),
           rejection_reason = $3, paid_status = $4, updated_at = NOW()
       WHERE id = $5 AND org_id = $6
       RETURNING *`,
      [status, req.user.id, rejection_reason, finalPaidStatus, id, req.user.orgId]
    );

    // Update balance — only deduct from leave balance if PAID approval
    if (status === 'approved') {
      if (finalPaidStatus === 'paid') {
        await db.query(
          `UPDATE employee_leave_balances
           SET pending = pending - $1, used = used + $1, updated_at = NOW()
           WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4`,
          [leave.days_requested, leave.employee_id, leave.leave_type_id, year]
        );
      } else {
        // Unpaid: release from pending but don't count as "used" paid days
        await db.query(
          `UPDATE employee_leave_balances
           SET pending = pending - $1, updated_at = NOW()
           WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4`,
          [leave.days_requested, leave.employee_id, leave.leave_type_id, year]
        );
      }
    } else if (status === 'rejected' || status === 'cancelled') {
      await db.query(
        `UPDATE employee_leave_balances
         SET pending = pending - $1, updated_at = NOW()
         WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4`,
        [leave.days_requested, leave.employee_id, leave.leave_type_id, year]
      );
    }

    const actionLabel = status === 'approved'
      ? `approved as ${finalPaidStatus} leave`
      : status === 'rejected'
        ? `rejected${rejection_reason ? ': ' + rejection_reason : ''}`
        : status;

    await db.query(
      `INSERT INTO leave_request_comments (leave_request_id, user_id, comment, action)
       VALUES ($1, $2, $3, $4)`,
      [id, req.user.id, `Leave request ${actionLabel}`, status]
    );

    const empUser = await db.query(
      `SELECT u.id FROM employees e JOIN users u ON u.email = e.email WHERE e.id = $1 AND e.org_id = $2 LIMIT 1`,
      [leave.employee_id, req.user.orgId]
    );
    if (empUser.rows.length > 0) {
      const notifMsg = status === 'approved'
        ? `Your leave has been approved as ${finalPaidStatus} leave ✅`
        : status === 'rejected'
          ? `Your leave request has been rejected ❌${rejection_reason ? ': ' + rejection_reason : ''}`
          : `Your leave request has been ${status}`;
      notificationService.notify(
        req.user.orgId,
        empUser.rows[0].id,
        'leave_status_changed',
        `Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        notifMsg,
        `/hrms/leave`,
        req.user.id,
        { leaveRequestId: id, status, paid_status: finalPaidStatus }
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Reset all leave balances for new year
const resetMonthlyLeaves = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;

    // Get all leave types marked for monthly reset
    const typesResult = await db.query(
      "SELECT id, name, days_allowed FROM leave_types WHERE org_id = $1 AND is_active = true AND resets_monthly = true",
      [orgId]
    );

    if (typesResult.rows.length === 0) {
      return res.json({ message: 'No leave types have "Resets Monthly" enabled. Edit the leave type in Settings to enable it.', reset: 0 });
    }

    // Get all active employees (excluding super_admin/admin)
    const empResult = await db.query(
      `SELECT e.id FROM employees e
       WHERE e.org_id = $1 AND e.status = 'active'
         AND NOT EXISTS (SELECT 1 FROM public.users u WHERE LOWER(u.email) = LOWER(e.email) AND u.role IN ('super_admin', 'admin'))`,
      [orgId]
    );

    let reset = 0;
    for (const emp of empResult.rows) {
      for (const lt of typesResult.rows) {
        const existing = await db.query(
          'SELECT id FROM employee_leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3',
          [emp.id, lt.id, year]
        );

        if (existing.rows.length > 0) {
          await db.query(
            'UPDATE employee_leave_balances SET used = 0, pending = 0, last_monthly_reset = $1 WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4',
            [firstOfMonth, emp.id, lt.id, year]
          );
        } else {
          await db.query(
            `INSERT INTO employee_leave_balances (employee_id, leave_type_id, org_id, year, total_allocated, used, pending, carried_forward, last_monthly_reset)
             VALUES ($1, $2, $3, $4, $5, 0, 0, 0, $6)`,
            [emp.id, lt.id, orgId, year, lt.days_allowed || 0, firstOfMonth]
          );
        }
        reset++;
      }
    }

    const monthName = now.toLocaleString('default', { month: 'long' });
    res.json({
      message: `Monthly reset complete for ${monthName} ${year}`,
      reset,
      types: typesResult.rows.map(t => t.name),
    });
  } catch (err) {
    next(err);
  }
};

const resetAnnualBalances = async (req, res, next) => {
  try {
    const year = new Date().getFullYear();
    const orgId = req.user.orgId;

    // Get all leave types for this org
    const typesResult = await db.query(
      'SELECT * FROM leave_types WHERE org_id = $1 AND is_active = true',
      [orgId]
    );

    // Get all active employees
    const empResult = await db.query(
      "SELECT id FROM employees WHERE org_id = $1 AND status = 'active'",
      [orgId]
    );

    let created = 0;
    let reset = 0;

    for (const emp of empResult.rows) {
      for (const lt of typesResult.rows) {
        // Check if balance already exists for this year
        const existing = await db.query(
          'SELECT id, total_allocated, used, can_carry_forward FROM employee_leave_balances elb JOIN leave_types lt ON elb.leave_type_id = lt.id WHERE elb.employee_id = $1 AND elb.leave_type_id = $2 AND elb.year = $3',
          [emp.id, lt.id, year]
        );

        if (existing.rows.length === 0) {
          // Carry forward check from previous year
          let carryForward = 0;
          if (lt.can_carry_forward) {
            const prevYear = await db.query(
              'SELECT available FROM employee_leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3',
              [emp.id, lt.id, year - 1]
            );
            if (prevYear.rows.length > 0) {
              const maxCarry = lt.max_carry_forward_days || lt.max_carry_forward || 0;
              carryForward = Math.min(parseFloat(prevYear.rows[0].available || 0), maxCarry);
            }
          }

          await db.query(
            `INSERT INTO employee_leave_balances
               (employee_id, leave_type_id, org_id, year, total_allocated, used, pending, carried_forward)
             VALUES ($1, $2, $3, $4, $5, 0, 0, $6)`,
            [emp.id, lt.id, orgId, year, (lt.days_allowed || 0) + carryForward, carryForward]
          );
          created++;
        } else {
          reset++;
        }
      }
    }

    res.json({ message: `Annual reset complete for ${year}`, created, already_exists: reset });
  } catch (err) {
    next(err);
  }
};

// ==================== ANALYTICS ====================

const getLeaveAnalytics = async (req, res, next) => {
  try {
    const year = req.query.year || new Date().getFullYear();

    // Overall stats
    const stats = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE status != 'cancelled') as total_requests,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COALESCE(SUM(days_requested) FILTER (WHERE status = 'approved'), 0) as total_days_taken
      FROM leave_requests
      WHERE org_id = $1 AND EXTRACT(YEAR FROM start_date) = $2`,
      [req.user.orgId, year]
    );

    // By leave type
    const byType = await db.query(
      `SELECT 
        lt.name,
        lt.color,
        COUNT(lr.id) as request_count,
        COALESCE(SUM(lr.days_requested) FILTER (WHERE lr.status = 'approved'), 0) as days_taken
      FROM leave_types lt
      LEFT JOIN leave_requests lr ON lt.id = lr.leave_type_id 
        AND lr.org_id = $1 
        AND EXTRACT(YEAR FROM lr.start_date) = $2
      WHERE lt.org_id = $1
      GROUP BY lt.id, lt.name, lt.color
      ORDER BY days_taken DESC NULLS LAST`,
      [req.user.orgId, year]
    );

    // By month
    const byMonth = await db.query(
      `SELECT 
        TO_CHAR(start_date, 'Mon') as month,
        EXTRACT(MONTH FROM start_date) as month_num,
        COUNT(*) as request_count,
        COALESCE(SUM(days_requested) FILTER (WHERE status = 'approved'), 0) as days_taken
      FROM leave_requests
      WHERE org_id = $1 AND EXTRACT(YEAR FROM start_date) = $2
      GROUP BY month, month_num
      ORDER BY month_num`,
      [req.user.orgId, year]
    );

    // Top employees by leave taken
    const topEmployees = await db.query(
      `SELECT 
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.department,
        COUNT(lr.id) as request_count,
        COALESCE(SUM(lr.days_requested) FILTER (WHERE lr.status = 'approved'), 0) as days_taken
      FROM employees e
      LEFT JOIN leave_requests lr ON e.id = lr.employee_id 
        AND lr.org_id = $1 
        AND EXTRACT(YEAR FROM lr.start_date) = $2
      WHERE e.org_id = $1
      GROUP BY e.id, e.first_name, e.last_name, e.department
      HAVING SUM(lr.days_requested) FILTER (WHERE lr.status = 'approved') > 0
      ORDER BY days_taken DESC
      LIMIT 10`,
      [req.user.orgId, year]
    );

    res.json({
      data: {
        stats: stats.rows[0],
        byType: byType.rows,
        byMonth: byMonth.rows,
        topEmployees: topEmployees.rows,
      }
    });
  } catch (err) {
    next(err);
  }
};

// ==================== CALENDAR ====================

const getLeaveCalendar = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate required' });
    }

    const result = await db.query(
      `SELECT 
        lr.id,
        lr.start_date,
        lr.end_date,
        lr.days_requested,
        lr.status,
        lr.half_day,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.department,
        lt.name as leave_type_name,
        lt.color as leave_type_color
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.org_id = $1 
        AND lr.status = 'approved'
        AND lr.start_date <= $3
        AND lr.end_date >= $2
      ORDER BY lr.start_date`,
      [req.user.orgId, startDate, endDate]
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
};

// ==================== PUBLIC HOLIDAYS ====================

const getPublicHolidays = async (req, res, next) => {
  try {
    const year = req.query.year || new Date().getFullYear();

    const result = await db.query(
      `SELECT * FROM public_holidays
       WHERE org_id = $1 AND EXTRACT(YEAR FROM date) = $2
       ORDER BY date`,
      [req.user.orgId, year]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const createPublicHoliday = async (req, res, next) => {
  try {
    const { name, date, is_optional, description } = req.body;

    const result = await db.query(
      `INSERT INTO public_holidays (org_id, name, date, is_optional, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.orgId, name, date, is_optional || false, description]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Holiday already exists for this date' });
    }
    next(err);
  }
};

const deleteLeaveType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM leave_types WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.orgId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Leave type not found' });
    }
    res.json({ message: 'Leave type deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Employee can only delete their OWN cancelled requests
const deleteLeaveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get employee id for this user
    const empResult = await db.query(
      'SELECT id FROM employees WHERE email = $1 AND org_id = $2',
      [req.user.email, req.user.orgId]
    );
    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee record not found' });
    }
    const employeeId = empResult.rows[0].id;

    // Only allow deleting own cancelled requests
    const check = await db.query(
      `SELECT id, status, days_requested, leave_type_id, start_date
       FROM leave_requests WHERE id = $1 AND employee_id = $2 AND org_id = $3`,
      [id, employeeId, req.user.orgId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    const req_ = check.rows[0];
    if (req_.status !== 'cancelled') {
      return res.status(400).json({ error: 'Only cancelled requests can be deleted' });
    }

    await db.query('DELETE FROM leave_requests WHERE id = $1', [id]);
    res.json({ message: 'Leave request deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  // Leave Types
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  
  // Balances
  getEmployeeBalance,
  getMyBalance,
  initializeEmployeeBalance,
  
  // Requests
  getLeaveRequests,
  createLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  resetAnnualBalances,
  resetMonthlyLeaves,
  
  // Analytics
  getLeaveAnalytics,
  
  // Calendar
  getLeaveCalendar,
  
  // Holidays
  getPublicHolidays,
  createPublicHoliday,
};
