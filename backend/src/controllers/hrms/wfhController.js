const db = require('../../config/database');
const notificationService = require('../../services/notificationService');

/**
 * Helper to find employee by user_id or email
 */
async function findEmployee(userId, orgId) {
  let result = await db.query(
    'SELECT id, first_name, last_name, email FROM public.employees WHERE user_id = $1 AND org_id = $2',
    [userId, orgId]
  );
  if (result.rows.length === 0) {
    const userRes = await db.query('SELECT email FROM public.users WHERE id = $1', [userId]);
    if (userRes.rows.length > 0) {
      result = await db.query(
        'SELECT id, first_name, last_name, email FROM public.employees WHERE LOWER(email) = LOWER($1) AND org_id = $2',
        [userRes.rows[0].email, orgId]
      );
    }
  }
  return result.rows[0] || null;
}

/**
 * List Work From Home requests
 */
const getWfhRequests = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const { status, from, to, scope = 'all' } = req.query;

    const userRole = req.user.role;
    const isSuperAdmin = userRole === 'super_admin';
    const isAdmin = ['super_admin', 'admin', 'manager', 'team_lead'].includes(userRole);

    const emp = await findEmployee(req.user.id, orgId);

    let query = `
      SELECT 
        w.*,
        COALESCE(NULLIF(TRIM(CONCAT(e.first_name, ' ', e.last_name)), ''), u.full_name, 'Unknown') as employee_name,
        e.employee_id as emp_id,
        COALESCE(e.profile_picture, u.avatar_url) as avatar_url,
        COALESCE(e.email, u.email) as employee_email,
        e.probation_status,
        e.department,
        approver.full_name as approved_by_name
      FROM public.wfh_requests w
      LEFT JOIN public.employees e ON w.employee_id = e.id
      LEFT JOIN public.users u ON w.user_id = u.id
      LEFT JOIN public.users approver ON w.approved_by = approver.id
      WHERE w.org_id = $1
    `;
    const params = [orgId];

    // If not admin, or if employee explicitly requests their own requests
    if (!isAdmin || scope === 'me') {
      if (emp) {
        params.push(emp.id);
        params.push(req.user.id);
        query += ` AND (w.employee_id = $${params.length - 1} OR w.user_id = $${params.length})`;
      } else {
        params.push(req.user.id);
        query += ` AND w.user_id = $${params.length}`;
      }
    }

    if (status && status !== 'all') {
      params.push(status);
      query += ` AND w.status = $${params.length}`;
    }

    if (from) {
      params.push(from);
      query += ` AND w.end_date >= $${params.length}`;
    }

    if (to) {
      params.push(to);
      query += ` AND w.start_date <= $${params.length}`;
    }

    query += ` ORDER BY w.created_at DESC`;

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new Work From Home request
 */
const createWfhRequest = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const { start_date, end_date, reason } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required.' });
    }

    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ error: 'End date cannot be earlier than start date.' });
    }

    const emp = await findEmployee(req.user.id, orgId);
    if (!emp) {
      return res.status(404).json({ error: 'Employee record not found for your account.' });
    }

    // Calculate days requested
    const start = new Date(start_date);
    const end = new Date(end_date);
    const diffTime = Math.abs(end - start);
    const daysRequested = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Check for overlapping pending or approved requests
    const overlapRes = await db.query(
      `SELECT id FROM public.wfh_requests
       WHERE employee_id = $1 AND org_id = $2
         AND status IN ('pending', 'approved')
         AND (start_date <= $3 AND end_date >= $4)`,
      [emp.id, orgId, end_date, start_date]
    );

    if (overlapRes.rows.length > 0) {
      return res.status(400).json({
        error: 'You already have an active or pending Work From Home request that overlaps with these dates.',
      });
    }

    const result = await db.query(
      `INSERT INTO public.wfh_requests (
        org_id, employee_id, user_id, start_date, end_date, days_requested, reason, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *`,
      [orgId, emp.id, req.user.id, start_date, end_date, daysRequested, reason?.trim() || '']
    );
    const newRequest = result.rows[0];

    // Send notifications to admins / managers
    try {
      const notifyTitle = 'New Work From Home Request';
      const userFullName = req.user.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || req.user.email;
      const notifyMsg = `${userFullName} requested Work From Home from ${start_date} to ${end_date} (${daysRequested} ${daysRequested === 1 ? 'day' : 'days'})`;

      const hrAdmins = await notificationService.getOrgUsersByRole(orgId, ['admin', 'manager', 'super_admin']);

      for (const adminId of hrAdmins) {
        if (String(adminId) === String(req.user.id)) continue;
        try {
          await db.query(
            `INSERT INTO hrms_notifications (org_id, user_id, notification_type, title, message, data, priority)
             VALUES ($1, $2, 'wfh_request', $3, $4, $5, 'high')`,
            [
              orgId,
              adminId,
              notifyTitle,
              notifyMsg,
              JSON.stringify({ wfhRequestId: newRequest.id, actionUrl: '/hrms/attendance?tab=wfh' }),
            ]
          );
        } catch (err) {
          // ignore table schema differences
        }
      }

      await notificationService.notify(
        orgId,
        hrAdmins,
        'wfh_requested',
        notifyTitle,
        notifyMsg,
        '/hrms/attendance?tab=wfh',
        req.user.id,
        { wfhRequestId: newRequest.id }
      );
    } catch (notifErr) {
      console.error('[wfhController] Notification error on create:', notifErr.message);
    }

    res.status(201).json(newRequest);
  } catch (err) {
    next(err);
  }
};

/**
 * Approve or Reject a Work From Home request (Super Admin, Admin, Manager ONLY)
 */
const updateWfhStatus = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const { id } = req.params;
    const { status, rejection_reason } = req.body;

    const allowedApprovers = ['super_admin', 'admin', 'manager'];
    if (!allowedApprovers.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Only Super Admin, Admin, or Manager can approve or reject Work From Home requests.',
      });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be approved or rejected.' });
    }

    const existing = await db.query(
      'SELECT * FROM public.wfh_requests WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Work From Home request not found.' });
    }

    const record = existing.rows[0];

    const result = await db.query(
      `UPDATE public.wfh_requests SET
        status = $1,
        approved_by = $2,
        approved_at = NOW(),
        rejection_reason = $3,
        updated_at = NOW()
      WHERE id = $4 AND org_id = $5
      RETURNING *`,
      [status, req.user.id, rejection_reason?.trim() || null, id, orgId]
    );

    const updated = result.rows[0];

    // Send notification to employee
    try {
      const targetUserId = record.user_id;
      if (targetUserId) {
        const isApproved = status === 'approved';
        const notifTitle = isApproved 
          ? 'Work From Home Approved ✅' 
          : 'Work From Home Rejected ❌';
        const notifMsg = isApproved
          ? `Your Work From Home request from ${record.start_date} to ${record.end_date} has been approved ✅`
          : `Your Work From Home request from ${record.start_date} to ${record.end_date} has been rejected ❌${rejection_reason ? ': ' + rejection_reason : ''}`;

        try {
          await db.query(
            `INSERT INTO hrms_notifications (org_id, user_id, notification_type, title, message, data, priority)
             VALUES ($1, $2, 'wfh_status_changed', $3, $4, $5, 'high')`,
            [
              orgId,
              targetUserId,
              notifTitle,
              notifMsg,
              JSON.stringify({ wfhRequestId: id, status, rejection_reason, actionUrl: '/hrms/attendance?tab=wfh' }),
            ]
          );
        } catch (err) {
          // ignore
        }

        await notificationService.notify(
          orgId,
          targetUserId,
          'wfh_status_changed',
          notifTitle,
          notifMsg,
          '/hrms/attendance?tab=wfh',
          req.user.id,
          { wfhRequestId: id, status, rejection_reason }
        );
      }
    } catch (notifErr) {
      console.error('[wfhController] Notification error on status update:', notifErr.message);
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

/**
 * Cancel a pending Work From Home request (cancels and removes it completely)
 */
const cancelWfhRequest = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const { id } = req.params;
    const userRole = req.user.role;
    const isElevatedAdmin = ['super_admin', 'admin', 'manager'].includes(userRole);

    const existing = await db.query(
      'SELECT * FROM public.wfh_requests WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Work From Home request not found.' });
    }

    const record = existing.rows[0];

    // Only owner or admin/manager can cancel
    if (record.user_id !== req.user.id && !isElevatedAdmin) {
      return res.status(403).json({ error: 'You do not have permission to cancel this request.' });
    }

    if (record.status !== 'pending' && !isElevatedAdmin) {
      return res.status(400).json({ error: 'Only pending requests can be cancelled.' });
    }

    // Delete directly so it disappears completely
    await db.query(
      'DELETE FROM public.wfh_requests WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    res.json({ message: 'Work From Home request cancelled and removed successfully', id });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a Work From Home request
 * - Admin, Super Admin, and Manager can delete ANY request (pending, approved, rejected, cancelled).
 * - Requester (employee) can ONLY delete their own request if it is pending or cancelled.
 * - Requester CANNOT delete if approved or rejected.
 */
const deleteWfhRequest = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const { id } = req.params;
    const userRole = req.user.role;
    const isElevatedAdmin = ['super_admin', 'admin', 'manager'].includes(userRole);

    const existing = await db.query(
      'SELECT * FROM public.wfh_requests WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Work From Home request not found.' });
    }

    const record = existing.rows[0];

    // Only Super Admin, Admin, or Manager can delete WFH requests
    if (!isElevatedAdmin) {
      return res.status(403).json({
        error: 'Only Super Admin, Admin, or Manager can delete Work From Home requests.',
      });
    }

    await db.query('DELETE FROM public.wfh_requests WHERE id = $1 AND org_id = $2', [id, orgId]);

    res.json({ message: 'Work From Home request deleted successfully', id });
  } catch (err) {
    next(err);
  }
};

/**
 * Quick check: Does the logged-in user have approved WFH today?
 */
const getTodayWfhStatus = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const emp = await findEmployee(req.user.id, orgId);

    if (!emp) {
      return res.json({ hasApprovedWfh: false, activeWfh: null });
    }

    const { rows } = await db.query(
      `SELECT * FROM public.wfh_requests
       WHERE employee_id = $1 AND org_id = $2
         AND CURRENT_DATE >= start_date AND CURRENT_DATE <= end_date
       ORDER BY CASE WHEN status = 'approved' THEN 1 WHEN status = 'pending' THEN 2 ELSE 3 END
       LIMIT 1`,
      [emp.id, orgId]
    );

    const activeWfh = rows[0] || null;
    res.json({
      hasApprovedWfh: activeWfh?.status === 'approved',
      activeWfh,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getWfhRequests,
  createWfhRequest,
  updateWfhStatus,
  cancelWfhRequest,
  deleteWfhRequest,
  getTodayWfhStatus,
};
