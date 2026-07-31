const jwt = require('jsonwebtoken');
const db = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const queryToken =
      typeof req.query?.token === 'string' ? req.query.token : null;

    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;
    const cookieToken = req.cookies?.token;
    const token = bearerToken || queryToken || cookieToken;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    // Verify user exists and is active
    const userResult = await db.query(
      'SELECT id, COALESCE(organization_id, org_id) as "orgId", email, role, full_name, has_unibox_access FROM public.users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User account no longer exists or is inactive' });
    }

    req.user = userResult.rows[0];

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

const requireOrg = (req, res, next) => {
  if (!req.user || !req.user.orgId) {
    return res.status(403).json({ error: 'Organization context required' });
  }
  next();
};

module.exports = { auth, requireOrg };
