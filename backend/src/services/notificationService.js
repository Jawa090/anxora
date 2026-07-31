const db = require('../config/database');
const realtimeService = require('./realtimeService');
const fcmService = require('./fcmService');

/**
 * Notification categories mapped from event types
 */
const CATEGORY_MAP = {
  // CRM
  lead_assigned: 'crm',
  lead_stage_changed: 'crm',
  lead_converted: 'crm',
  deal_assigned: 'crm',
  deal_stage_changed: 'crm',
  deal_won: 'crm',
  deal_lost: 'crm',
  // HRMS
  attendance_late: 'hrms',
  attendance_clock_in: 'hrms',
  attendance_clock_out: 'hrms',
  leave_requested: 'hrms',
  leave_status_changed: 'hrms',
  // Tasks / Projects
  task_assigned: 'tasks',
  task_completed: 'tasks',
  task_due_soon: 'tasks',
  milestone_assigned: 'tasks',
  // Recruitment
  candidate_applied: 'recruitment',
  candidate_status_changed: 'recruitment',
  interview_scheduled: 'recruitment',
  offer_created: 'recruitment',
  requisition_created: 'recruitment',
  // Collaboration
  direct_message: 'collaboration',
  mention: 'collaboration',
  new_email: 'collaboration',
  // General
  general: 'general',
};

/**
 * Core notify function.
 *
 * @param {string} orgId
 * @param {string} targetUserId  - who receives it (can be array for bulk)
 * @param {string} type          - event key from CATEGORY_MAP
 * @param {string} title
 * @param {string} message
 * @param {string|null} actionUrl  - relative URL e.g. /crm/leads/123
 * @param {string|null} actorUserId - who triggered it
 * @param {object} metadata
 */
const notify = async (orgId, targetUserId, type, title, message, actionUrl = null, actorUserId = null, metadata = {}) => {
  try {
    if (!orgId || !targetUserId || !type || !title || !message) return;

    const targets = Array.isArray(targetUserId) ? targetUserId : [targetUserId];
    const category = CATEGORY_MAP[type] || 'general';

    for (const userId of targets) {
      // Skip self-notifications — don't notify the person who caused the event
      if (actorUserId && String(userId) === String(actorUserId)) continue;

      // Check User Notification Preferences
      const userResult = await db.query(
        'SELECT notification_settings FROM public.users WHERE id = $1',
        [userId]
      );
      const settings = userResult.rows[0]?.notification_settings;
      if (settings && typeof settings === 'object') {
        // If categories are disabled (e.g. settings.crm === false), skip
        if (settings[category] === false) {
          console.log(`[notificationService] Skipping ${type} for user ${userId} due to preferences.`);
          continue;
        }
      }

      const result = await db.query(
        `INSERT INTO public.notifications
          (org_id, target_user_id, actor_user_id, type, category, title, message, action_url, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [orgId, userId, actorUserId || null, type, category, title, message, actionUrl, JSON.stringify(metadata)]
      );

      const notification = result.rows[0];

      const notificationPayload = {
        id: notification.id,
        type: notification.type,
        category: notification.category,
        title: notification.title,
        message: notification.message,
        action_url: notification.action_url,
        metadata: notification.metadata,
        is_read: false,
        created_at: notification.created_at,
      };

      // Emit real-time socket event directly to the user's room
      if (realtimeService.io) {
        realtimeService.io.to(`user:${userId}`).emit('notification:new', notificationPayload);
      }

      // Send Push Notification via FCM
      fcmService.sendPushNotification(userId, notification.title, notification.message, {
        id: String(notification.id),
        type: String(notification.type),
        category: String(notification.category),
        action_url: notification.action_url || '/',
      });
    }
  } catch (err) {
    // Never crash the main flow due to a notification error
    console.error('[notificationService] Failed to create notification:', err.message);
  }
};

/**
 * Get all org admin/manager user IDs — used when notifying HR managers about leave requests, etc.
 */
const getOrgAdmins = async (orgId) => {
  try {
    const result = await db.query(
      `SELECT id FROM public.users
       WHERE COALESCE(organization_id, org_id) = $1
         AND role IN ('admin', 'super_admin', 'manager')
         AND is_active = true`,
      [orgId]
    );
    return result.rows.map((r) => r.id);
  } catch (err) {
    return [];
  }
};

/**
 * Get all org user IDs for a given role filter.
 */
const getOrgUsersByRole = async (orgId, roles = []) => {
  try {
    const placeholders = roles.map((_, i) => `$${i + 2}`).join(', ');
    const result = await db.query(
      `SELECT id FROM public.users 
       WHERE COALESCE(organization_id, org_id) = $1 
         AND role IN (${placeholders})
         AND is_active = true`,
      [orgId, ...roles]
    );
    return result.rows.map((r) => r.id);
  } catch (err) {
    return [];
  }
};

/**
 * Check if a product's stock is low (<= min_stock_level) and notify organization admins
 */
const checkAndNotifyLowStock = async (orgId, productId, actorUserId = null) => {
  try {
    const productResult = await db.query(
      `SELECT p.name, p.sku, p.min_stock_level,
              COALESCE(SUM(s.quantity), 0) as total_stock
       FROM public.products p
       LEFT JOIN public.stock s ON s.product_id = p.id
       WHERE p.id = $1 AND p.org_id = $2
       GROUP BY p.id`,
      [productId, orgId]
    );

    if (productResult.rows.length === 0) return;

    const { name, sku, min_stock_level, total_stock } = productResult.rows[0];
    const totalStock = Number(total_stock);
    const minStock = Number(min_stock_level);

    if (totalStock <= minStock) {
      const admins = await getOrgAdmins(orgId);
      if (admins.length === 0) return;

      const title = 'Low Stock Alert';
      const message = `Product "${name}" (${sku}) has low stock: ${totalStock} units remaining (Minimum level: ${minStock}).`;
      
      await notify(
        orgId,
        admins,
        'general',
        title,
        message,
        '/inventory/products?filter=low-stock',
        actorUserId
      );
    }
  } catch (err) {
    console.error('[notificationService] checkAndNotifyLowStock error:', err.message);
  }
};

module.exports = { notify, getOrgAdmins, getOrgUsersByRole, checkAndNotifyLowStock };
