const db = require('../../config/database');
const { notify } = require('../../services/notificationService');
const realtimeService = require('../../services/realtimeService');

const getByProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    const result = await db.query(
      `SELECT m.*
       FROM project_milestones m
       WHERE m.project_id = $1 AND m.org_id = $2 
       ORDER BY m.due_date ASC, m.created_at ASC`,
      [projectId, req.user.orgId]
    );

    // Get assignees for each milestone
    const milestonesWithAssignees = await Promise.all(result.rows.map(async (milestone) => {
      const assigneesResult = await db.query(
        `SELECT u.id, u.full_name, u.avatar_url, u.email
         FROM project_milestone_assignees pma
         JOIN users u ON pma.assigned_to = u.id
         WHERE pma.milestone_id = $1`,
        [milestone.id]
      );
      return {
        ...milestone,
        assignees: assigneesResult.rows
      };
    }));
    
    res.json(milestonesWithAssignees);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { name, description, due_date, status, assigned_to } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Milestone name is required' });
    }

    const result = await db.query(
      `INSERT INTO project_milestones (org_id, project_id, name, description, due_date, status, created_by, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.orgId, projectId, name.trim(), description || null, due_date || null, status || 'pending', req.user.id, assigned_to || null]
    );

    const milestone = result.rows[0];

    // If assigned_to provided, also insert into milestone_assignees table
    if (assigned_to) {
      try {
        await db.query(
          `INSERT INTO project_milestone_assignees (milestone_id, assigned_to, assigned_by, org_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (milestone_id, assigned_to) DO NOTHING`,
          [milestone.id, assigned_to, req.user.id, req.user.orgId]
        );

        // Auto-assign to project members
        await db.query(
          `INSERT INTO project_members (org_id, project_id, user_id, role)
           VALUES ($1, $2, $3, 'member')
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [req.user.orgId, projectId, assigned_to]
        );

        // Broadcast project update to refresh lists
        realtimeService.broadcastToOrg(req.user.orgId, 'project:updated', { id: projectId });

        // Send notification
        await notify(
          req.user.orgId,
          assigned_to,
          'milestone_assigned',
          'Milestone Assigned',
          `You have been assigned to milestone "${milestone.name}"`,
          `/projects/${projectId}?milestone=${milestone.id}`,
          req.user.id,
          { milestoneId: milestone.id, projectId }
        );
      } catch (err) {
        console.error('Error assigning milestone:', err);
      }
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'milestone:created', milestone);
    res.status(201).json(milestone);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, due_date, status, progress, assigned_to } = req.body;

    // Fetch old milestone to check project_id and old assignee
    const oldMsRes = await db.query(
      'SELECT project_id, assigned_to FROM project_milestones WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );
    const oldMs = oldMsRes.rows[0];

    if (!oldMs) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    // Role and permission verification
    const isAdmin = ['super_admin', 'admin', 'manager'].includes(req.user.role);
    const projRes = await db.query(
      'SELECT created_by, manager_id, owner_id FROM public.projects WHERE id = $1',
      [oldMs.project_id]
    );
    const project = projRes.rows[0];
    const isProjectOwner = project && (project.created_by === req.user.id || project.manager_id === req.user.id || project.owner_id === req.user.id);
    const isAssignee = oldMs.assigned_to === req.user.id;

    // Non-owners / non-admins can only change status/progress if they are the assignee
    if (!isAdmin && !isProjectOwner) {
      if (isAssignee) {
        if (name !== undefined || description !== undefined || due_date !== undefined || assigned_to !== undefined) {
          return res.status(403).json({ error: 'You are only allowed to update the status of this milestone' });
        }
      } else {
        return res.status(403).json({ error: 'You do not have permission to update this milestone' });
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (due_date !== undefined) { fields.push(`due_date = $${paramIndex++}`); values.push(due_date); }
    if (status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(status); }
    if (progress !== undefined) { fields.push(`progress = $${paramIndex++}`); values.push(progress); }
    if (assigned_to !== undefined) { fields.push(`assigned_to = $${paramIndex++}`); values.push(assigned_to || null); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = now()`);
    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE project_milestones SET ${fields.join(', ')} 
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const updatedMilestone = result.rows[0];

    // Sync assignee and project member status
    if (assigned_to !== undefined && oldMs) {
      const oldAssignee = oldMs.assigned_to;
      const newAssignee = assigned_to || null;
      const projectId = oldMs.project_id;

      if (oldAssignee !== newAssignee) {
        // 1. Delete old assignee from project_milestone_assignees
        if (oldAssignee) {
          await db.query(
            'DELETE FROM project_milestone_assignees WHERE milestone_id = $1 AND assigned_to = $2',
            [id, oldAssignee]
          );

          // Check if we should remove old assignee from project members
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
        }

        // 2. Add new assignee to project_milestone_assignees and project_members
        if (newAssignee) {
          await db.query(
            `INSERT INTO project_milestone_assignees (milestone_id, assigned_to, assigned_by, org_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (milestone_id, assigned_to) DO NOTHING`,
            [id, newAssignee, req.user.id, req.user.orgId]
          );

          await db.query(
            `INSERT INTO project_members (org_id, project_id, user_id, role)
             VALUES ($1, $2, $3, 'member')
             ON CONFLICT (project_id, user_id) DO NOTHING`,
            [req.user.orgId, projectId, newAssignee]
          );
        }
      }
      // Broadcast project update to refresh lists and trigger redirects
      realtimeService.broadcastToOrg(req.user.orgId, 'project:updated', { id: projectId });
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'milestone:updated', updatedMilestone);
    res.json(updatedMilestone);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM project_milestones WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'milestone:deleted', { id });
    res.json({ message: 'Milestone deleted' });
  } catch (err) {
    next(err);
  }
};

// Assign milestone to single or multiple users
const assignToUsers = async (req, res, next) => {
  try {
    const { milestoneId } = req.params;
    const { assigneeIds } = req.body;

    if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
      return res.status(400).json({ error: 'At least one assignee is required' });
    }

    // Verify milestone exists
    const milestone = await db.query(
      'SELECT id, name, project_id FROM project_milestones WHERE id = $1 AND org_id = $2',
      [milestoneId, req.user.orgId]
    );

    if (milestone.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const assignedMilestone = milestone.rows[0];

    // Insert assignees
    const assignedUsers = [];
    for (const userId of assigneeIds) {
      try {
        const result = await db.query(
          `INSERT INTO project_milestone_assignees (milestone_id, assigned_to, assigned_by, org_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (milestone_id, assigned_to) DO NOTHING
           RETURNING assigned_to`,
          [milestoneId, userId, req.user.id, req.user.orgId]
        );

        // Auto-assign to project members
        await db.query(
          `INSERT INTO project_members (org_id, project_id, user_id, role)
           VALUES ($1, $2, $3, 'member')
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [req.user.orgId, assignedMilestone.project_id, userId]
        );

        if (result.rows.length > 0) {
          assignedUsers.push(userId);

          // Send notification to assigned user
          await notify(
            req.user.orgId,
            userId,
            'milestone_assigned',
            'Milestone Assigned',
            `You have been assigned to milestone "${assignedMilestone.name}"`,
            `/projects/${assignedMilestone.project_id}?milestone=${milestoneId}`,
            req.user.id,
            { milestoneId, projectId: assignedMilestone.project_id }
          );
        }
      } catch (err) {
        console.error(`Failed to assign user ${userId}:`, err);
      }
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'project:updated', { id: assignedMilestone.project_id });
    res.json({ message: 'Assignees added', assignedUsers });
  } catch (err) {
    next(err);
  }
};

// Get assignees for a milestone
const getAssignees = async (req, res, next) => {
  try {
    const { milestoneId } = req.params;

    const result = await db.query(
      `SELECT u.id, u.full_name, u.avatar_url, u.email, pma.created_at
       FROM project_milestone_assignees pma
       JOIN users u ON pma.assigned_to = u.id
       WHERE pma.milestone_id = $1 AND pma.org_id = $2
       ORDER BY pma.created_at DESC`,
      [milestoneId, req.user.orgId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Get milestones assigned to current user
const getMyAssignedMilestones = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT m.*, p.name as project_name
       FROM project_milestone_assignees pma
       JOIN project_milestones m ON pma.milestone_id = m.id
       JOIN projects p ON m.project_id = p.id
       WHERE pma.assigned_to = $1 AND pma.org_id = $2
       ORDER BY m.due_date ASC, m.created_at DESC`,
      [req.user.id, req.user.orgId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Remove assignee from milestone
const removeAssignee = async (req, res, next) => {
  try {
    const { milestoneId, userId } = req.params;

    const result = await db.query(
      `DELETE FROM project_milestone_assignees 
       WHERE milestone_id = $1 AND assigned_to = $2 AND org_id = $3
       RETURNING assigned_to`,
      [milestoneId, userId, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Get milestone info to get project_id
    const msRes = await db.query('SELECT project_id FROM project_milestones WHERE id = $1', [milestoneId]);
    if (msRes.rows.length > 0) {
      const projectId = msRes.rows[0].project_id;
      
      // Check if user has other milestones, created tasks, or assigned tasks in this project
      const otherMs = await db.query(
        `SELECT 1 FROM project_milestone_assignees pma
         JOIN project_milestones m ON pma.milestone_id = m.id
         WHERE m.project_id = $1 AND pma.assigned_to = $2`,
        [projectId, userId]
      );
      
      const otherTasks = await db.query(
        `SELECT 1 FROM public.tasks 
         WHERE project_id = $1 AND (assigned_to = $2 OR created_by = $2)`,
        [projectId, userId]
      );

      if (otherMs.rows.length === 0 && otherTasks.rows.length === 0) {
        // Remove from project members
        await db.query(
          `DELETE FROM project_members 
           WHERE project_id = $1 AND user_id = $2 AND org_id = $3`,
          [projectId, userId, req.user.orgId]
        );
      }
      
      // Broadcast project update to refresh lists and trigger redirects
      realtimeService.broadcastToOrg(req.user.orgId, 'project:updated', { id: projectId });
    }

    res.json({ message: 'Assignee removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getByProject,
  create,
  update,
  remove,
  assignToUsers,
  getAssignees,
  removeAssignee,
  getMyAssignedMilestones,
};
