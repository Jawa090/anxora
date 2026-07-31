const db = require('../../config/database');
const notificationService = require('../../services/notificationService');
const realtimeService = require('../../services/realtimeService');
const { fireWorkflows } = require('../../services/advancedWorkflowEngine');

const updateProjectProgress = async (projectId, orgId) => {
  if (!projectId) return;
  try {
    const { rows: stats } = await db.query(
      `SELECT 
         COUNT(*) as total_tasks,
         COALESCE(AVG(progress), 0) as avg_progress
       FROM public.tasks 
       WHERE project_id = $1 AND org_id = $2`,
      [projectId, orgId]
    );

    const total = parseInt(stats[0].total_tasks) || 0;
    const avgProgress = Math.round(parseFloat(stats[0].avg_progress)) || 0;

    let progress = 0;
    if (total > 0) {
      progress = avgProgress;
    }

    await db.query(
      `UPDATE public.projects SET progress = $1, updated_at = now() WHERE id = $2 AND org_id = $3`,
      [progress, projectId, orgId]
    );

    // Broadcast the updated project
    const { rows: updatedProject } = await db.query(
      `SELECT p.*, u.full_name AS created_by_name, u.avatar_url AS created_by_avatar
       FROM public.projects p LEFT JOIN public.users u ON u.id = p.created_by
       WHERE p.id = $1 AND p.org_id = $2`,
      [projectId, orgId]
    );

    if (updatedProject.length > 0) {
      realtimeService.broadcastToOrg(orgId, 'project:updated', updatedProject[0]);
    }
  } catch (error) {
    console.error('Error updating project progress:', error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, projectId, status, assignedTo } = req.query;
    const offset = (page - 1) * limit;

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';

    let query = `
      SELECT t.*,
             p.name        AS project_name,
             p.color       AS project_color,
             p.can_assign  AS project_can_assign,
             p.manager_id  AS project_manager_id,
             p.created_by  AS project_created_by,
             p.owner_id    AS project_owner_id,
             u.full_name   AS assigned_to_name,
             u.avatar_url  AS assigned_to_avatar,
             cu.full_name  AS created_by_name,
             cu.avatar_url AS created_by_avatar
      FROM public.tasks t
      LEFT JOIN public.projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users cu ON t.created_by = cu.id
      WHERE t.org_id = $1`;

    const params = [req.user.orgId];
    let paramIndex = 2;

    if (!isAdmin) {
      // Task visibility rules for non-admin users:
      //
      // 1. Task directly assigned to user
      // 2. Task created by user (personal tasks)
      // 3. Task delegated by user (user forwarded it — keeps visibility to manage)
      // 4. Project-level full access — ONLY for project manager/owner/creator
      //    They see ALL tasks in their project.
      //
      // NOTE: If user is only a project member (assigned a task in project),
      // they do NOT get full project task visibility — only their own assigned tasks.
      // This is handled by rule #1 above.
      query += ` AND (
        t.assigned_to = $${paramIndex} OR
        t.created_by = $${paramIndex} OR
        t.delegated_by = $${paramIndex} OR
        (t.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.projects pr
          WHERE pr.id = t.project_id
            AND (
              pr.manager_id = $${paramIndex} OR
              pr.owner_id = $${paramIndex} OR
              pr.created_by = $${paramIndex}
            )
        ))
      )`;
      params.push(req.user.id);
      paramIndex++;
    }

    if (projectId && projectId !== 'undefined') {
      query += ` AND t.project_id = $${paramIndex}`;
      params.push(projectId);
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
    console.error('Task getAll error:', err);
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT t.*,
              p.name        AS project_name,
              p.color       AS project_color,
              p.can_assign  AS project_can_assign,
              p.manager_id  AS project_manager_id,
              p.created_by  AS project_created_by,
              p.owner_id    AS project_owner_id,
              u.full_name   AS assigned_to_name,
              u.avatar_url  AS assigned_to_avatar
       FROM public.tasks t
       LEFT JOIN public.projects p ON t.project_id = p.id
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.id = $1 AND t.org_id = $2`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const {
      title, description, projectId, assignedTo, dueDate, priority, status,
      parentTaskId, recurrence_rule, progress, can_assign
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const maxOrder = await db.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM public.tasks WHERE org_id = $1',
      [req.user.orgId]
    );

    // Automatically sync status and progress on create
    let finalStatus = status || 'new';
    let finalProgress = parseInt(progress) || 0;
    if (finalProgress === 100) {
      finalStatus = 'completed';
    } else if (finalStatus === 'completed' || finalStatus === 'done') {
      finalProgress = 100;
    }

    const result = await db.query(
      `INSERT INTO public.tasks (
        org_id, project_id, title, description, assigned_to, due_date,
        priority, status, parent_task_id, sort_order, created_by,
        is_recurring, recurrence_pattern, progress, can_assign
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        req.user.orgId,
        projectId || null,
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

    if (task.assigned_to && task.project_id) {
      try {
        await db.query(
          `INSERT INTO project_members (org_id, project_id, user_id, role)
           VALUES ($1, $2, $3, 'member')
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [req.user.orgId, task.project_id, task.assigned_to]
        );
      } catch (err) {
        console.error('Error auto-adding task assignee to project members:', err);
      }
    }

    if (task.assigned_to && task.assigned_to !== req.user.id) {
      const taskUrl = task.project_id
        ? `/projects/${task.project_id}?tab=tasks&taskId=${task.id}`
        : `/tasks?view=list&filter=all&tab=all&subview=cards&taskId=${task.id}`;
      notificationService.notify(
        req.user.orgId,
        task.assigned_to,
        'task_assigned',
        'New Task Assigned',
        `${req.user.full_name || req.user.email} assigned you the task "${task.title}"`,
        taskUrl,
        req.user.id,
        { taskId: task.id, taskTitle: task.title, projectId: task.project_id }
      );
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'task:created', task);
    if (task.project_id) {
      await updateProjectProgress(task.project_id, req.user.orgId);
    }
    res.status(201).json(task);
  } catch (err) {
    console.error('Task creation error:', err);
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
      'SELECT created_by, assigned_to, can_assign, delegated_by, status FROM public.tasks WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
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

    const canChangeAssignment = isAdmin || isManager || isTaskCreator || isDelegator || (isAssignee && delegationAllowed);
    const canChangeCanAssign = canChangeAssignment;

    const fields = [];
    const values = [];
    let p = 1;

    if (title !== undefined && (isAdmin || isManager || isTaskCreator)) {
      fields.push(`title = $${p++}`);
      values.push(title);
    }
    if (description !== undefined && (isAdmin || isManager || isTaskCreator)) {
      fields.push(`description = $${p++}`);
      values.push(description);
    }
    if (assignedTo !== undefined && canChangeAssignment) {
      fields.push(`assigned_to = $${p++}`);
      values.push(assignedTo === '' ? null : assignedTo);
      if (isAssignee && delegationAllowed) {
        fields.push(`delegated_by = $${p++}`);
        values.push(req.user.id);
      }
    }
    if (dueDate !== undefined && (isAdmin || isManager || isTaskCreator)) {
      fields.push(`due_date = $${p++}`);
      values.push(dueDate === '' ? null : dueDate);
    }
    if (priority !== undefined && (isAdmin || isManager || isTaskCreator)) {
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
    if (can_assign !== undefined && canChangeCanAssign) {
      fields.push(`can_assign = $${p++}`);
      values.push(can_assign);
    }
    if (recurrence_rule !== undefined) {
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
      `UPDATE public.tasks SET ${fields.join(', ')}
       WHERE id = $${p} AND org_id = $${p + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updatedTask = result.rows[0];

    const cleanAssignedTo = assignedTo === '' ? null : assignedTo;

    // Sync project membership for task assignee change
    if (assignedTo !== undefined && updatedTask.project_id) {
      const oldAssignee = existingTask.assigned_to;
      const newAssignee = cleanAssignedTo;
      const projectId = updatedTask.project_id;

      if (oldAssignee !== newAssignee) {
        // Add new assignee to project members
        if (newAssignee) {
          try {
            await db.query(
              `INSERT INTO project_members (org_id, project_id, user_id, role)
               VALUES ($1, $2, $3, 'member')
               ON CONFLICT (project_id, user_id) DO NOTHING`,
              [req.user.orgId, projectId, newAssignee]
            );
          } catch (err) {
            console.error('Error auto-adding task assignee to project members:', err);
          }
        }

        // Check if we should remove old assignee from project members
        if (oldAssignee) {
          try {
            const otherMs = await db.query(
              `SELECT 1 FROM project_milestone_assignees pma
               JOIN project_milestones m ON pma.milestone_id = m.id
               WHERE m.project_id = $1 AND pma.assigned_to = $2`,
              [projectId, oldAssignee]
            );
            
            const otherTasks = await db.query(
              `SELECT 1 FROM public.tasks 
               WHERE project_id = $1 AND (assigned_to = $2 OR created_by = $2) AND id != $3`,
              [projectId, oldAssignee, id]
            );

            if (otherMs.rows.length === 0 && otherTasks.rows.length === 0) {
              await db.query(
                'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 AND org_id = $3',
                [projectId, oldAssignee, req.user.orgId]
              );
            }
          } catch (err) {
            console.error('Error auto-removing task assignee from project members:', err);
          }
        }
      }
    }

    if (cleanAssignedTo && cleanAssignedTo !== req.user.id && cleanAssignedTo !== existingTask.assigned_to) {
      const taskUrl = updatedTask.project_id
        ? `/projects/${updatedTask.project_id}?tab=tasks&taskId=${updatedTask.id}`
        : `/tasks?view=list&filter=all&tab=all&subview=cards&taskId=${updatedTask.id}`;
      notificationService.notify(
        req.user.orgId,
        cleanAssignedTo,
        'task_assigned',
        'Task Assigned to You',
        `${req.user.full_name || req.user.email} assigned you the task "${updatedTask.title}"`,
        taskUrl,
        req.user.id,
        { taskId: updatedTask.id, taskTitle: updatedTask.title, projectId: updatedTask.project_id }
      );
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'task:updated', updatedTask);
    if (updatedTask.project_id) {
      await updateProjectProgress(updatedTask.project_id, req.user.orgId);
    }
    if (existingTask.project_id && existingTask.project_id !== updatedTask.project_id) {
      await updateProjectProgress(existingTask.project_id, req.user.orgId);
    }

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
      `UPDATE public.tasks SET ${fields.join(', ')}
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const doneTask = result.rows[0];

    if (status === 'completed' && doneTask.created_by && doneTask.created_by !== req.user.id) {
      const completedTaskUrl = doneTask.project_id
        ? `/projects/${doneTask.project_id}?tab=tasks&taskId=${doneTask.id}`
        : `/tasks?view=list&filter=all&tab=all&subview=cards&taskId=${doneTask.id}`;
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
    if (doneTask.project_id) {
      await updateProjectProgress(doneTask.project_id, req.user.orgId);
    }

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
    const isAdmin = ['super_admin', 'admin', 'manager', 'team_lead'].includes(req.user.role);

    let result;
    if (isAdmin) {
      // Admins/managers can delete any task in the org
      result = await db.query(
        'DELETE FROM public.tasks WHERE id = $1 AND org_id = $2 RETURNING id, project_id, assigned_to',
        [id, req.user.orgId]
      );
    } else {
      // Regular users can only delete tasks they created
      result = await db.query(
        'DELETE FROM public.tasks WHERE id = $1 AND org_id = $2 AND created_by = $3 RETURNING id, project_id, assigned_to',
        [id, req.user.orgId, req.user.id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or you do not have permission to delete it' });
    }

    const deletedTask = result.rows[0];
    
    // Sync project membership on task delete
    if (deletedTask.project_id && deletedTask.assigned_to) {
      const oldAssignee = deletedTask.assigned_to;
      const projectId = deletedTask.project_id;
      try {
        const otherMs = await db.query(
          `SELECT 1 FROM project_milestone_assignees pma
           JOIN project_milestones m ON pma.milestone_id = m.id
           WHERE m.project_id = $1 AND pma.assigned_to = $2`,
          [projectId, oldAssignee]
        );
        
        const otherTasks = await db.query(
          `SELECT 1 FROM public.tasks 
           WHERE project_id = $1 AND (assigned_to = $2 OR created_by = $2)`,
          [projectId, oldAssignee]
        );

        if (otherMs.rows.length === 0 && otherTasks.rows.length === 0) {
          await db.query(
            'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 AND org_id = $3',
            [projectId, oldAssignee, req.user.orgId]
          );
        }
      } catch (err) {
        console.error('Error auto-removing task assignee from project members on task delete:', err);
      }
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'task:deleted', { id });
    if (deletedTask.project_id) {
      await updateProjectProgress(deletedTask.project_id, req.user.orgId);
    }
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
};

const reorder = async (req, res, next) => {
  try {
    const { tasks } = req.body;

    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Tasks array required' });
    }

    for (const task of tasks) {
      await db.query(
        'UPDATE public.tasks SET sort_order = $1, updated_at = now() WHERE id = $2 AND org_id = $3',
        [task.sortOrder, task.id, req.user.orgId]
      );
    }

    res.json({ message: 'Tasks reordered' });
  } catch (err) {
    next(err);
  }
};

const startTimer = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Check if the task exists
    const taskCheck = await db.query(
      'SELECT id, org_id, project_id, title FROM public.tasks WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskCheck.rows[0];

    // 2. Stop any other active timer for this user in the same org
    const activeTimers = await db.query(
      'SELECT id, project_id, timer_start_at, title FROM public.tasks WHERE timer_user_id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );

    for (const activeTask of activeTimers.rows) {
      // Calculate elapsed hours
      const elapsedMs = Date.now() - new Date(activeTask.timer_start_at).getTime();
      const elapsedHours = Math.max(0.01, parseFloat((elapsedMs / (1000 * 60 * 60)).toFixed(2)));

      // Insert time entry
      await db.query(
        `INSERT INTO project_time_entries (org_id, project_id, task_id, user_id, description, hours, date, billable)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, true)`,
        [
          req.user.orgId,
          activeTask.project_id || null,
          activeTask.id,
          req.user.id,
          `Automatically saved active timer from task: "${activeTask.title}"`,
          elapsedHours
        ]
      );

      // Reset the timer on this task
      await db.query(
        'UPDATE public.tasks SET timer_start_at = NULL, timer_user_id = NULL, updated_at = now() WHERE id = $1',
        [activeTask.id]
      );

      // Broadcast the old task update
      const updatedOldTask = await db.query(
        'SELECT * FROM public.tasks WHERE id = $1 AND org_id = $2',
        [activeTask.id, req.user.orgId]
      );
      if (updatedOldTask.rows.length > 0) {
        realtimeService.broadcastToOrg(req.user.orgId, 'task:updated', updatedOldTask.rows[0]);
      }
    }

    // 3. Start the timer on the new task
    const result = await db.query(
      `UPDATE public.tasks 
       SET timer_start_at = now(), timer_user_id = $1, updated_at = now() 
       WHERE id = $2 AND org_id = $3 
       RETURNING *`,
      [req.user.id, id, req.user.orgId]
    );

    const updatedTask = result.rows[0];
    realtimeService.broadcastToOrg(req.user.orgId, 'task:updated', updatedTask);
    res.json({ success: true, task: updatedTask });
  } catch (err) {
    next(err);
  }
};

const stopTimer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { description } = req.body;

    // 1. Fetch task and its running timer
    const taskCheck = await db.query(
      'SELECT id, org_id, project_id, title, timer_start_at, timer_user_id FROM public.tasks WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskCheck.rows[0];

    if (!task.timer_start_at || task.timer_user_id !== req.user.id) {
      return res.status(400).json({ error: 'No active timer running for you on this task' });
    }

    // 2. Calculate elapsed hours
    const elapsedMs = Date.now() - new Date(task.timer_start_at).getTime();
    // Round to 2 decimal places, minimum 0.01 hours
    const elapsedHours = Math.max(0.01, parseFloat((elapsedMs / (1000 * 60 * 60)).toFixed(2)));

    // 3. Create project time entry
    const timeEntryResult = await db.query(
      `INSERT INTO project_time_entries (org_id, project_id, task_id, user_id, description, hours, date, billable)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, true) 
       RETURNING *`,
      [
        req.user.orgId,
        task.project_id || null,
        task.id,
        req.user.id,
        description || `Worked on task: "${task.title}"`,
        elapsedHours
      ]
    );

    // 4. Reset the timer fields on the task
    const result = await db.query(
      `UPDATE public.tasks 
       SET timer_start_at = NULL, timer_user_id = NULL, updated_at = now() 
       WHERE id = $1 AND org_id = $2 
       RETURNING *`,
      [id, req.user.orgId]
    );

    const updatedTask = result.rows[0];
    realtimeService.broadcastToOrg(req.user.orgId, 'task:updated', updatedTask);

    res.json({
      success: true,
      task: updatedTask,
      timeEntry: timeEntryResult.rows[0]
    });
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
  reorder,
  startTimer,
  stopTimer,
};
