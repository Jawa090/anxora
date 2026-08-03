const db = require('../../config/database');
const notificationService = require('../../services/notificationService');
const realtimeService = require('../../services/realtimeService');
const { fireWorkflows } = require('../../services/advancedWorkflowEngine');

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status, assignedTo } = req.query;
    const offset = (page - 1) * limit;
    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';

    let query = `
      SELECT t.*,
             u.full_name   AS assigned_to_name,
             u.avatar_url  AS assigned_to_avatar,
             cu.full_name  AS created_by_name,
             cu.avatar_url AS created_by_avatar
      FROM public.independent_tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users cu ON t.created_by = cu.id
      WHERE t.org_id = $1`;

    const params = [req.user.orgId];
    let paramIndex = 2;

    if (!isAdmin) {
      query += ` AND (
        t.assigned_to = $${paramIndex} OR
        t.created_by = $${paramIndex} OR
        (t.delegated_by = $${paramIndex} AND t.assigned_to IS NOT NULL)
      )`;
      params.push(req.user.id);
      paramIndex++;
    }

    if (status && status !== 'undefined') {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (assignedTo && assignedTo !== 'undefined') {
      query += ` AND t.assigned_to = $${paramIndex}`;
      params.push(assignedTo);
      paramIndex++;
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Independent task getAll error:', err);
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT t.*,
              u.full_name   AS assigned_to_name,
              u.avatar_url  AS assigned_to_avatar
       FROM public.independent_tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.id = $1 AND t.org_id = $2`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Independent task not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const {
      title, description, assignedTo, dueDate, priority, status,
      parentTaskId, recurrence_rule, progress, can_assign
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const maxOrder = await db.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM public.independent_tasks WHERE org_id = $1',
      [req.user.orgId]
    );

    let finalStatus = status || 'new';
    let finalProgress = parseInt(progress) || 0;
    if (finalProgress === 100) {
      finalStatus = 'completed';
    } else if (finalStatus === 'completed' || finalStatus === 'done') {
      finalProgress = 100;
    }

    const result = await db.query(
      `INSERT INTO public.independent_tasks (
        org_id, title, description, assigned_to, due_date,
        priority, status, parent_task_id, sort_order, created_by,
        is_recurring, recurrence_pattern, progress, can_assign
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        req.user.orgId,
        title.trim(),
        description || null,
        (assignedTo === '' ? null : assignedTo) || null,
        (dueDate === '' ? null : dueDate) || null,
        priority || 'normal',
        finalStatus,
        parentTaskId || null,
        maxOrder.rows[0].next_order,
        req.user.id,
        !!recurrence_rule && recurrence_rule !== 'none',
        recurrence_rule || null,
        finalProgress,
        can_assign || false,
      ]
    );

    const task = result.rows[0];

    if (task.assigned_to && task.assigned_to !== req.user.id) {
      const taskUrl = `/tasks?view=list&filter=all&tab=all&subview=cards&taskId=${task.id}`;
      notificationService.notify(
        req.user.orgId,
        task.assigned_to,
        'task_assigned',
        'New Task Assigned',
        `${req.user.full_name || req.user.email} assigned you the task "${task.title}"`,
        taskUrl,
        req.user.id,
        { taskId: task.id, taskTitle: task.title, projectId: null }
      );
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'task:created', task);
    res.status(201).json(task);
  } catch (err) {
    console.error('Independent task creation error:', err);
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title, description, priority, status, assignedTo, dueDate,
      recurrence_rule, is_starred, progress, can_assign, delay_reason
    } = req.body;

    const taskCheck = await db.query(
      'SELECT created_by, assigned_to, can_assign, delegated_by, status FROM public.independent_tasks WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Independent task not found' });
    }
    const existingTask = taskCheck.rows[0];

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';
    const isManager = ['manager', 'hr_manager', 'inventory_manager'].includes(req.user.role);
    const isTaskCreator = existingTask.created_by === req.user.id;
    const isAssignee = existingTask.assigned_to === req.user.id;
    const isDelegator = existingTask.delegated_by === req.user.id;
    const delegationAllowed = existingTask.can_assign === true;

    const canModifyTask =
      isAdmin || isManager || isTaskCreator ||
      isAssignee ||
      isDelegator;

    if (!canModifyTask) {
      return res.status(403).json({ error: 'You do not have permission to update this task' });
    }

    const isAdminOrCreator = isAdmin || isTaskCreator;

    const fields = [];
    const values = [];
    let p = 1;

    if (title !== undefined && isAdminOrCreator) {
      fields.push(`title = $${p++}`);
      values.push(title);
    }
    if (description !== undefined && isAdminOrCreator) {
      fields.push(`description = $${p++}`);
      values.push(description);
    }
    const canChangeAssignment = isAdminOrCreator || isDelegator || (isAssignee && delegationAllowed);
    if (assignedTo !== undefined && canChangeAssignment) {
      const cleanAssignedTo = assignedTo === '' ? null : assignedTo;
      fields.push(`assigned_to = $${p++}`);
      values.push(cleanAssignedTo);
      if (cleanAssignedTo === null) {
        fields.push(`delegated_by = null`);
      } else if (isAssignee && delegationAllowed) {
        fields.push(`delegated_by = $${p++}`);
        values.push(req.user.id);
      }
    }
    if (dueDate !== undefined && isAdminOrCreator) {
      fields.push(`due_date = $${p++}`);
      values.push(dueDate === '' ? null : dueDate);
    }
    if (priority !== undefined && isAdminOrCreator) {
      fields.push(`priority = $${p++}`);
      values.push(priority);
    }
    let finalStatus = status;
    let finalProgress = progress !== undefined ? parseInt(progress) : undefined;

    if (finalProgress !== undefined && finalProgress === 100) {
      finalStatus = 'completed';
    } else if (finalStatus === 'completed' || finalStatus === 'done') {
      finalProgress = 100;
    } else if (finalProgress !== undefined && finalProgress < 100 && (existingTask.status === 'completed' || existingTask.status === 'done') && finalStatus === undefined) {
      finalStatus = 'in_progress';
    }

    if (finalStatus !== undefined) {
      fields.push(`status = $${p++}`);
      values.push(finalStatus);
      if (finalStatus === 'completed') {
        fields.push(`completed_at = now()`);
      } else {
        fields.push(`completed_at = null`);
      }
    }
    if (finalProgress !== undefined) {
      fields.push(`progress = $${p++}`);
      values.push(finalProgress);
    }
    const targetCanAssign = can_assign !== undefined ? can_assign : req.body.canAssign;
    const canChangeCanAssign = isAdminOrCreator || isDelegator || isAssignee;
    if (targetCanAssign !== undefined && canChangeCanAssign) {
      fields.push(`can_assign = $${p++}`);
      values.push(Boolean(targetCanAssign));
    }
    if (recurrence_rule !== undefined && isAdminOrCreator) {
      fields.push(`is_recurring = $${p++}`);
      values.push(!!recurrence_rule && recurrence_rule !== 'none');
      fields.push(`recurrence_pattern = $${p++}`);
      values.push(recurrence_rule || null);
    }
    if (is_starred !== undefined) {
      fields.push(`is_starred = $${p++}`);
      values.push(is_starred);
    }
    if (delay_reason !== undefined) {
      fields.push(`delay_reason = $${p++}`);
      values.push(delay_reason);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = now()`);
    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE public.independent_tasks SET ${fields.join(', ')}
       WHERE id = $${p} AND org_id = $${p + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Independent task not found' });
    }

    const updatedTask = result.rows[0];
    const cleanAssignedTo = assignedTo === '' ? null : assignedTo;

    if (cleanAssignedTo && cleanAssignedTo !== req.user.id && cleanAssignedTo !== existingTask.assigned_to) {
      const taskUrl = `/tasks?view=list&filter=all&tab=all&subview=cards&taskId=${updatedTask.id}`;
      notificationService.notify(
        req.user.orgId,
        cleanAssignedTo,
        'task_assigned',
        'Task Assigned to You',
        `${req.user.full_name || req.user.email} assigned you the task "${updatedTask.title}"`,
        taskUrl,
        req.user.id,
        { taskId: updatedTask.id, taskTitle: updatedTask.title, projectId: null }
      );
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'task:updated', updatedTask);

    if (updatedTask.status === 'completed' && existingTask.status !== 'completed') {
      fireWorkflows(req.user.orgId, 'task_completed', updatedTask, req.user.id);
    }

    res.json(updatedTask);
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const fields = [`status = $1`, `updated_at = now()`];
    const values = [status];

    if (status === 'completed') {
      fields.push(`completed_at = now()`);
    }

    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE public.independent_tasks SET ${fields.join(', ')}
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Independent task not found' });
    }

    const doneTask = result.rows[0];

    if (status === 'completed' && doneTask.created_by && doneTask.created_by !== req.user.id) {
      const completedTaskUrl = `/tasks?view=list&filter=all&tab=all&subview=cards&taskId=${doneTask.id}`;
      notificationService.notify(
        req.user.orgId,
        doneTask.created_by,
        'task_completed',
        'Task Completed',
        `${req.user.full_name || req.user.email} completed the task "${doneTask.title}"`,
        completedTaskUrl,
        req.user.id,
        { taskId: doneTask.id, taskTitle: doneTask.title }
      );
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'task:updated', doneTask);

    if (status === 'completed') {
      fireWorkflows(req.user.orgId, 'task_completed', doneTask, req.user.id);
    }

    res.json(doneTask);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = ['super_admin', 'admin'].includes(req.user.role);

    let result;
    if (isAdmin) {
      result = await db.query(
        'DELETE FROM public.independent_tasks WHERE id = $1 AND org_id = $2 RETURNING id',
        [id, req.user.orgId]
      );
    } else {
      result = await db.query(
        'DELETE FROM public.independent_tasks WHERE id = $1 AND org_id = $2 AND created_by = $3 RETURNING id',
        [id, req.user.orgId, req.user.id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Independent task not found or you do not have permission to delete it' });
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'task:deleted', { id });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  updateStatus,
  remove,
};
