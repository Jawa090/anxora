
const db = require('../config/database');

/**
 * Middleware to check if a user has access to a specific module and action.
 * Leverages the dynamic module_permissions column in the users table.
 * 
 * @param {string} module - The module ID (e.g., 'leads', 'payroll')
 * @param {string} action - The action (e.g., 'view', 'create', 'edit', 'delete')
 */
const checkPermission = (module, action) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Fetch user role and dynamic permissions
      const result = await db.query(
        'SELECT role, module_permissions FROM public.users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      const user = result.rows[0];

      // 1. Super Admin bypass - Super Admin has access to everything
      if (user.role === 'super_admin') {
        return next();
      }

      // 2. Check dynamic permissions for the module
      const permissions = user.module_permissions || {};
      const modulePerms = permissions[module] || [];

      if (modulePerms.includes(action)) {
        return next();
      }

      // 3. Fallback: all authenticated org users can view members (needed for collaboration features)
      if (module === 'members' && action === 'view') {
        return next();
      }

      res.status(403).json({
        error: 'Permission Denied',
        message: `You do not have '${action}' permission for the '${module}' module.`,
        required: { module, action }
      });
    } catch (error) {
      console.error('RBAC Middleware Error:', error);
      res.status(500).json({ error: 'Internal server error during permission validation' });
    }
  };
};

module.exports = { checkPermission };
