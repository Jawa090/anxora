const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const Joi = require('joi');
const emailService = require('../../services/emailService');

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  fullName: Joi.string().required(),
  orgName: Joi.string().optional().allow(''),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email, orgId: user.organization_id },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );
};

const register = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) throw error;

    const { email, password, fullName, orgName } = value;

    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    await client.query('BEGIN');

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const orgId = uuidv4();
    const orgNameToUse = orgName || "My Company";

    await client.query(
      'INSERT INTO organizations (id, name) VALUES ($1, $2)',
      [orgId, orgNameToUse]
    );

    const userResult = await client.query(
      'INSERT INTO users (id, organization_id, org_id, email, password_hash, full_name, role) VALUES ($1, $2, $2, $3, $4, $5, $6) RETURNING id, email, full_name, organization_id',
      [userId, orgId, email, hashedPassword, fullName, 'admin']
    );

    const user = userResult.rows[0];

    await client.query('COMMIT');

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.status(201).json({
      user: { id: user.id, email: user.email, fullName: user.full_name, orgId: user.organization_id },
      token,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    next(err);
  } finally {
    client.release();
  }
};

const login = async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) throw error;

    const { email, password } = value;

    const userResult = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.organization_id, u.avatar_url, u.role
       FROM users u 
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        orgId: user.organization_id,
        avatarUrl: user.avatar_url,
        role: user.role
      },
      token,
    });
  } catch (err) {
    next(err);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const userResult = await db.query(
      `SELECT u.id, u.email, u.full_name, u.organization_id, u.org_id, u.avatar_url, u.role, u.phone, u.position, u.department, u.bio, u.timezone, u.languages, u.module_permissions, u.notification_settings,
              o.name as org_name, o.domain as org_domain, o.address as org_address, o.settings as org_settings
       FROM users u
       LEFT JOIN organizations o ON o.id = COALESCE(u.organization_id, u.org_id)
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userResult.rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { fullName, phone, position, department, bio, timezone, languages } = req.body;

    const result = await db.query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           position = COALESCE($3, position),
           department = COALESCE($4, department),
           bio = COALESCE($5, bio),
           timezone = COALESCE($6, timezone),
           languages = COALESCE($7, languages),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING id, email, full_name, phone, position, department, bio, timezone, languages`,
      [fullName, phone, position, department, bio, timezone, languages, req.user.id]
    );

    const updatedUser = result.rows[0];

    // Sync back to public.employees table if a matching employee exists (by user_id or email)
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';

      await db.query(
        `UPDATE public.employees 
         SET first_name = $1, 
             last_name = $2, 
             phone = COALESCE($3, phone),
             department = COALESCE($4, department),
             job_title = COALESCE($5, job_title)
         WHERE user_id = $6 OR LOWER(email) = LOWER($7)`,
        [firstName, lastName, phone || null, department || null, position || null, req.user.id, updatedUser.email]
      ).catch((e) => console.error('Employee sync error on profile update:', e.message));
    }

    res.json(updatedUser);
  } catch (err) {
    next(err);
  }
};

const updateNotificationSettings = async (req, res, next) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const result = await db.query(
      `UPDATE users 
       SET notification_settings = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING notification_settings`,
      [JSON.stringify(settings), req.user.id]
    );

    res.json(result.rows[0].notification_settings);
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const userResult = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    const isMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Path where the file is accessible (assuming /uploads is statically served)
    const avatarUrl = `/uploads/profiles/${req.file.filename}`;

    await db.query(
      'UPDATE users SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [avatarUrl, req.user.id]
    );

    res.json({ avatarUrl });
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists
    const userResult = await db.query(
      'SELECT id, email, full_name FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    // Always return success to prevent email enumeration
    if (userResult.rows.length === 0) {
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    const user = userResult.rows[0];
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in database
    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3, created_at = CURRENT_TIMESTAMP',
      [user.id, resetToken, expiresAt]
    );

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(email, resetToken, user.full_name);
      console.log(`✅ Password reset email sent to ${email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send password reset email to ${email}:`, emailError.message);
    }

    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Find valid reset token
    const tokenResult = await db.query(
      'SELECT user_id FROM password_reset_tokens WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const userId = tokenResult.rows[0].user_id;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, userId]
    );

    // Delete used reset token
    await db.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [userId]
    );

    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (err) {
    next(err);
  }
};

const verifyInvite = async (req, res, next) => {
  try {
    const { token } = req.params;
    const userResult = await db.query(
      'SELECT email, full_name, expires_at FROM invites WHERE invite_token = $1 AND expires_at > CURRENT_TIMESTAMP',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invitation token' });
    }

    res.json(userResult.rows[0]);
  } catch (err) {
    next(err);
  }
};

const acceptInvite = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    await client.query('BEGIN');

    // 1. Find invitation
    const inviteResult = await client.query(
      `SELECT * FROM invites 
       WHERE invite_token = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired invitation token' });
    }

    const invite = inviteResult.rows[0];
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Create actual user
    await client.query(
      `INSERT INTO public.users 
       (id, organization_id, org_id, email, password_hash, full_name, role, phone, position, department, module_permissions, password_change_required) 
       VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [userId, invite.org_id, invite.email, hashedPassword, invite.full_name, invite.role, invite.phone, invite.position, invite.department, JSON.stringify(invite.module_permissions || {}), false]
    );

    // 3. Create profile
    await client.query(
      `INSERT INTO public.profiles (id, org_id, full_name, email, phone, job_title, department)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, invite.org_id, invite.full_name, invite.email, invite.phone, invite.position, invite.department]
    );

    // 4. Delete the invitation
    await client.query('DELETE FROM invites WHERE id = $1', [invite.id]);

    await client.query('COMMIT');

    res.json({ message: 'Invitation accepted successfully. Account created. You can now log in.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    next(err);
  } finally {
    client.release();
  }
};

const logout = async (req, res, next) => {
  res.clearCookie('token', { path: '/' });
  res.json({ message: 'Logged out successfully' });
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  resetPassword,
  forgotPassword,
  logout,
  changePassword,
  acceptInvite,
  verifyInvite,
  updateNotificationSettings,
  uploadAvatar,
};
