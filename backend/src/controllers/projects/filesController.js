const db = require('../../config/database');
const realtimeService = require('../../services/realtimeService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Auto-create table if not exists
const ensureTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_files (
      id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
      org_id uuid NOT NULL,
      project_id uuid NOT NULL,
      name varchar(255) NOT NULL,
      original_name varchar(255),
      file_path varchar(500),
      mime_type varchar(100),
      size_bytes bigint DEFAULT 0,
      folder varchar(100) DEFAULT 'General',
      uploaded_by uuid,
      version varchar(20) DEFAULT 'v1.0',
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);
};

// Set up multer for project file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../public/uploads/projects', req.params.projectId);
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

const getByProject = async (req, res, next) => {
  try {
    await ensureTable();
    const { projectId } = req.params;

    const result = await db.query(
      `SELECT f.*, u.full_name as uploaded_by_name
       FROM project_files f
       LEFT JOIN users u ON f.uploaded_by = u.id
       WHERE f.project_id = $1 AND f.org_id = $2
       ORDER BY f.created_at DESC`,
      [projectId, req.user.orgId]
    );

    // Format size for display
    const files = result.rows.map(f => ({
      ...f,
      size: f.size_bytes > 1024 * 1024
        ? (f.size_bytes / (1024 * 1024)).toFixed(1) + ' MB'
        : Math.round(f.size_bytes / 1024) + ' KB',
      type: f.name.split('.').pop()?.toLowerCase() || 'file',
      date: new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      uploadedBy: f.uploaded_by_name || 'Team Member'
    }));

    res.json(files);
  } catch (err) {
    next(err);
  }
};

const uploadFile = [
  upload.single('file'),
  async (req, res, next) => {
    try {
      await ensureTable();
      const { projectId } = req.params;

      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const { folder = 'General', version = 'v1.0' } = req.body;

      const result = await db.query(
        `INSERT INTO project_files (org_id, project_id, name, original_name, file_path, mime_type, size_bytes, folder, uploaded_by, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          req.user.orgId, projectId,
          req.file.originalname,
          req.file.originalname,
          req.file.path,
          req.file.mimetype,
          req.file.size,
          folder, req.user.id, version
        ]
      );

      const file = result.rows[0];
      realtimeService.broadcastToOrg(req.user.orgId, 'project:file_uploaded', file);
      res.status(201).json({
        ...file,
        size: file.size_bytes > 1024 * 1024
          ? (file.size_bytes / (1024 * 1024)).toFixed(1) + ' MB'
          : Math.round(file.size_bytes / 1024) + ' KB',
        type: file.name.split('.').pop()?.toLowerCase() || 'file',
        date: new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        uploadedBy: req.user.full_name || 'Team Member'
      });
    } catch (err) {
      next(err);
    }
  }
];

const remove = async (req, res, next) => {
  try {
    await ensureTable();
    const { id } = req.params;

    const fileResult = await db.query(
      'SELECT file_path, uploaded_by FROM project_files WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (fileResult.rows.length === 0) return res.status(404).json({ error: 'File not found' });

    const file = fileResult.rows[0];
    const isOwner = file.uploaded_by === req.user.id;
    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to delete this file' });
    }

    // Try to delete from disk
    const filePath = file.file_path;
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await db.query('DELETE FROM project_files WHERE id = $1 AND org_id = $2', [id, req.user.orgId]);
    realtimeService.broadcastToOrg(req.user.orgId, 'project:file_deleted', { id });
    res.json({ message: 'File deleted' });
  } catch (err) {
    next(err);
  }
};

const downloadFile = async (req, res, next) => {
  try {
    await ensureTable();
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM project_files WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    // Check if file exists on disk
    if (!file.file_path || !fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name || file.name}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    if (file.size_bytes) {
      res.setHeader('Content-Length', file.size_bytes);
    }

    // Stream the file
    const fileStream = fs.createReadStream(file.file_path);
    fileStream.pipe(res);
  } catch (err) {
    next(err);
  }
};

module.exports = { getByProject, uploadFile, remove, downloadFile };
