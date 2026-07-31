const db = require('../../config/database');
const path = require('path');
const fs = require('fs').promises;
const { getUploader } = require('../../utils/fileUpload');

// Configure multer using our global utility (100MB limit, any file type)
const upload = getUploader('drive', 100, 'all');


// Get all folders
const getFolders = async (req, res, next) => {
  try {
    const { parent_id, trash } = req.query;

    let query = `
      SELECT f.*, u.full_name as created_by_name,
             p.is_deleted as parent_is_deleted,
             (SELECT COUNT(*) FROM drive_files WHERE folder_id = f.id AND is_deleted = f.is_deleted AND created_by = $2) as file_count,
             (SELECT COALESCE(SUM(file_size), 0) FROM drive_files WHERE folder_id = f.id AND is_deleted = f.is_deleted AND created_by = $2) as total_size
      FROM drive_folders f
      LEFT JOIN users u ON f.created_by = u.id
      LEFT JOIN drive_folders p ON f.parent_folder_id = p.id
      WHERE f.org_id = $1 AND f.created_by = $2
    `;

    if (trash === 'true') {
      query += ` AND (f.is_deleted = true OR p.is_deleted = true)`;
    } else {
      query += ` AND (f.is_deleted = false OR f.is_deleted IS NULL)`;
    }

    const params = [req.user.orgId, req.user.id];
    let paramIndex = 3;

    if (trash === 'true') {
      // For trash view, if no parent_id is specified, show root deleted folders 
      // OR folders whose parent is still active (moved to trash from an active folder)
      if (!parent_id) {
        query += ` 
          AND (f.parent_folder_id IS NULL OR EXISTS (
            SELECT 1 FROM drive_folders pf 
            WHERE pf.id = f.parent_folder_id AND (pf.is_deleted = false OR pf.is_deleted IS NULL) AND pf.created_by = $2
          ))
        `;
      } else {
        query += ` AND f.parent_folder_id = $${paramIndex}`;
        params.push(parent_id);
      }
    } else {
      if (parent_id) {
        query += ` AND f.parent_folder_id = $${paramIndex}`;
        params.push(parent_id);
      } else {
        query += ` AND f.parent_folder_id IS NULL`;
      }
    }

    query += ` ORDER BY f.name ASC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Get all files
const getFiles = async (req, res, next) => {
  try {
    const { folder_id, recent, trash } = req.query;

    let query = `
      SELECT f.*, u.full_name as created_by_name,
             fo.name as folder_name,
             fo.is_deleted as folder_is_deleted
      FROM drive_files f
      LEFT JOIN users u ON f.created_by = u.id
      LEFT JOIN drive_folders fo ON f.folder_id = fo.id
      WHERE f.org_id = $1 AND f.created_by = $2
    `;

    const params = [req.user.orgId, req.user.id];
    let paramIndex = 3;

    if (folder_id) {
      query += ` AND f.folder_id = $${paramIndex}`;
      params.push(folder_id);
      paramIndex++;

      if (trash === 'true') {
        // Trash Mode: Show files that are individually trashed OR inside a trashed folder
        query += ` AND (f.is_deleted = true OR (fo.id IS NOT NULL AND fo.is_deleted = true AND fo.created_by = $2))`;
      } else {
        // Active Mode: Only show active files
        query += ` AND (f.is_deleted = false OR f.is_deleted IS NULL)`;
      }
    } else {
      // Root view
      if (trash === 'true') {
        // Show files deleted OR files in deleted folders
        query += ` AND (f.is_deleted = true OR (fo.id IS NOT NULL AND fo.is_deleted = true AND fo.created_by = $2))`;
        // Hide items whose parent is also deleted (to show the folder instead)
        query += ` AND (f.folder_id IS NULL OR (fo.id IS NOT NULL AND fo.is_deleted = false))`;
      } else {
        query += ` AND (f.is_deleted = false OR f.is_deleted IS NULL)`;
        query += ` AND f.folder_id IS NULL`;
      }
    }

    if (recent === 'true') {
      query += ` ORDER BY f.updated_at DESC LIMIT 20`;
    } else {
      query += ` ORDER BY f.name ASC`;
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Create folder
const createFolder = async (req, res, next) => {
  try {
    const { name, parent_folder_id, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    // Build path
    let path = name;
    if (parent_folder_id) {
      const parentResult = await db.query(
        'SELECT path FROM drive_folders WHERE id = $1 AND org_id = $2 AND created_by = $3',
        [parent_folder_id, req.user.orgId, req.user.id]
      );
      if (parentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Parent folder not found or access denied' });
      }
      path = `${parentResult.rows[0].path}/${name}`;
    }

    // Check if folder with same name exists in same parent for this user
    const existingResult = await db.query(
      'SELECT id FROM drive_folders WHERE name = $1 AND parent_folder_id = $2 AND org_id = $3 AND created_by = $4',
      [name, parent_folder_id || null, req.user.orgId, req.user.id]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Folder with this name already exists' });
    }

    const result = await db.query(
      `INSERT INTO drive_folders (org_id, created_by, name, parent_folder_id, color, path)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.orgId, req.user.id, name.trim(), parent_folder_id || null, color || 'folder-blue', path]
    );

    // Log activity
    await db.query(
      `INSERT INTO drive_activities (org_id, user_id, folder_id, activity_type, activity_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.orgId, req.user.id, result.rows[0].id, 'created', { folder_name: name }]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Upload file
const uploadFile = async (req, res, next) => {
  try {
    console.log('Upload request received:', req.file, req.body);

    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { folder_id } = req.body;
    const file = req.file;

    console.log('File details:', {
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      path: file.path
    });

    // Verify folder exists and belongs to user if provided
    if (folder_id) {
      const folderResult = await db.query(
        'SELECT id FROM drive_folders WHERE id = $1 AND org_id = $2 AND created_by = $3',
        [folder_id, req.user.orgId, req.user.id]
      );
      if (folderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Folder not found or access denied' });
      }
    }

    const folderName = path.basename(file.destination);
    const fileUrl = `/uploads/${folderName}/${file.filename}`;

    const result = await db.query(
      `INSERT INTO drive_files (org_id, created_by, folder_id, name, original_name, file_type, file_size, mime_type, file_path, file_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.user.orgId,
        req.user.id,
        folder_id || null,
        file.originalname,
        file.originalname,
        path.extname(file.originalname).toLowerCase(),
        file.size,
        file.mimetype,
        file.path,
        fileUrl
      ]
    );

    // Create initial version
    await db.query(
      `INSERT INTO drive_file_versions (file_id, version_number, file_path, file_size, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [result.rows[0].id, 1, file.path, file.size, req.user.id]
    );

    // Log activity
    await db.query(
      `INSERT INTO drive_activities (org_id, user_id, file_id, activity_type, activity_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.orgId, req.user.id, result.rows[0].id, 'created', { file_name: file.originalname }]
    );

    console.log('File uploaded successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload error:', err);
    next(err);
  }
};

// Delete folder (move to trash)
const deleteFolder = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if folder exists and belongs to user
    const folderResult = await db.query(
      'SELECT * FROM drive_folders WHERE id = $1 AND org_id = $2 AND created_by = $3',
      [id, req.user.orgId, req.user.id]
    );

    if (folderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const folder = folderResult.rows[0];

    // Move folder to trash
    await db.query(
      `UPDATE drive_folders 
       SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    // Also move all files in this folder to trash (only user's files)
    await db.query(
      `UPDATE drive_files 
       SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE folder_id = $1 AND org_id = $2 AND created_by = $3`,
      [id, req.user.orgId, req.user.id]
    );

    // Log activity
    await db.query(
      `INSERT INTO drive_activities (org_id, user_id, activity_type, activity_data)
       VALUES ($1, $2, $3, $4)`,
      [req.user.orgId, req.user.id, 'deleted', { folder_name: folder.name, folder_id: id }]
    );

    res.json({ message: 'Folder and contents moved to trash' });
  } catch (err) {
    next(err);
  }
};

// Delete file (move to trash)
const deleteFile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE drive_files 
       SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND org_id = $2 AND created_by = $3 AND (is_deleted = false OR is_deleted IS NULL)
       RETURNING *`,
      [id, req.user.orgId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Log activity
    await db.query(
      `INSERT INTO drive_activities (org_id, user_id, file_id, activity_type, activity_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.orgId, req.user.id, id, 'deleted', { file_name: result.rows[0].name }]
    );

    res.json({ message: 'File moved to trash' });
  } catch (err) {
    next(err);
  }
};

// Restore file from trash
const restoreFile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE drive_files 
       SET is_deleted = false, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND org_id = $2 AND created_by = $3 AND is_deleted = true
       RETURNING *`,
      [id, req.user.orgId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found in trash' });
    }

    // Log activity
    await db.query(
      `INSERT INTO drive_activities (org_id, user_id, file_id, activity_type, activity_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.orgId, req.user.id, id, 'restored', { file_name: result.rows[0].name }]
    );

    res.json({ message: 'File restored successfully' });
  } catch (err) {
    next(err);
  }
};

// Restore folder from trash
const restoreFolder = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE drive_folders 
       SET is_deleted = false, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND org_id = $2 AND created_by = $3 AND is_deleted = true
       RETURNING *`,
      [id, req.user.orgId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found or not in trash' });
    }

    // Also restore all files in this folder (only user's files)
    await db.query(
      `UPDATE drive_files 
       SET is_deleted = false, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE folder_id = $1 AND org_id = $2 AND created_by = $3`,
      [id, req.user.orgId, req.user.id]
    );

    // Log activity
    await db.query(
      `INSERT INTO drive_activities (org_id, user_id, folder_id, activity_type, activity_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.orgId, req.user.id, id, 'restored', { folder_name: result.rows[0].name }]
    );

    res.json({ message: 'Folder and its contents restored' });
  } catch (err) {
    next(err);
  }
};

// Permanently delete file
const permanentDeleteFile = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get file info first to delete from storage (only user's files)
    const fileResult = await db.query(
      'SELECT file_path FROM drive_files WHERE id = $1 AND org_id = $2 AND created_by = $3',
      [id, req.user.orgId, req.user.id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const { file_path } = fileResult.rows[0];

    // Delete from database (cascade handles versions)
    await db.query('DELETE FROM drive_files WHERE id = $1', [id]);

    // Delete from physical storage if it exists
    if (file_path) {
      try {
        await fs.unlink(file_path);
      } catch (err) {
        console.error('Error deleting physical file:', err);
      }
    }

    res.json({ message: 'File permanently deleted' });
  } catch (err) {
    next(err);
  }
};

// Get recent activities
const getRecentActivities = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT a.*, u.full_name as user_name, f.name as file_name, fo.name as folder_name
       FROM drive_activities a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN drive_files f ON a.file_id = f.id
       LEFT JOIN drive_folders fo ON a.folder_id = fo.id
       WHERE a.org_id = $1 AND a.user_id = $2
       ORDER BY a.created_at DESC
       LIMIT 50`,
      [req.user.orgId, req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Bulk restore items
const bulkRestore = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Item IDs are required' });
    }

    await db.query(
      `UPDATE drive_files 
       SET is_deleted = false, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1) AND org_id = $2 AND created_by = $3`,
      [ids, req.user.orgId, req.user.id]
    );

    await db.query(
      `UPDATE drive_folders 
       SET is_deleted = false, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1) AND org_id = $2 AND created_by = $3`,
      [ids, req.user.orgId, req.user.id]
    );

    // Also restore all files that were in restored folders (only user's files)
    await db.query(
      `UPDATE drive_files 
       SET is_deleted = false, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE (id = ANY($1) OR folder_id = ANY($1)) AND org_id = $2 AND created_by = $3`,
      [ids, req.user.orgId, req.user.id]
    );

    res.json({ message: 'Items restored successfully' });
  } catch (err) {
    next(err);
  }
};

// Bulk move to trash
const bulkMoveToTrash = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Item IDs are required' });
    }

    // Soft delete folders (only user's folders)
    await db.query(
      `UPDATE drive_folders 
       SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1) AND org_id = $2 AND created_by = $3`,
      [ids, req.user.orgId, req.user.id]
    );

    // Soft delete files (only user's files)
    // Also include files inside the selected folders
    await db.query(
      `UPDATE drive_files 
       SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE (id = ANY($1) OR folder_id = ANY($1)) AND org_id = $2 AND created_by = $3`,
      [ids, req.user.orgId, req.user.id]
    );

    res.json({ message: 'Items moved to trash success' });
  } catch (err) {
    next(err);
  }
};

// Bulk permanent delete items
const bulkPermanentDelete = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Item IDs are required' });
    }

    const filesResult = await db.query(
      `SELECT file_path FROM drive_files 
       WHERE (id = ANY($1) OR folder_id = ANY($1)) AND org_id = $2 AND created_by = $3`,
      [ids, req.user.orgId, req.user.id]
    );

    for (const file of filesResult.rows) {
      if (file.file_path) {
        try {
          await fs.unlink(file.file_path);
        } catch (e) {
          // Ignore ENOENT (file already gone)
          if (e.code !== 'ENOENT') {
            console.error(`Failed to delete file from disk: ${file.file_path}`, e);
          }
        }
      }
    }

    // Delete files first (only user's files)
    await db.query(
      `DELETE FROM drive_files 
       WHERE (id = ANY($1) OR folder_id = ANY($1)) AND org_id = $2 AND created_by = $3`,
      [ids, req.user.orgId, req.user.id]
    );

    // Delete folders (only user's folders)
    await db.query(
      'DELETE FROM drive_folders WHERE id = ANY($1) AND org_id = $2 AND created_by = $3',
      [ids, req.user.orgId, req.user.id]
    );

    res.json({ message: 'Items permanently deleted' });
  } catch (err) {
    next(err);
  }
};

// Search files and folders
const search = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const searchTerm = `%${q.trim()}%`;

    // Search folders (only user's folders)
    const foldersResult = await db.query(
      `SELECT 'folder' as type, id, name, created_at, updated_at, path
       FROM drive_folders 
       WHERE org_id = $1 AND created_by = $2 AND name ILIKE $3
       ORDER BY name ASC`,
      [req.user.orgId, req.user.id, searchTerm]
    );

    // Search files (only user's files)
    const filesResult = await db.query(
      `SELECT 'file' as type, id, name, file_type, file_size, created_at, updated_at
       FROM drive_files 
       WHERE org_id = $1 AND created_by = $2 AND is_deleted = false AND name ILIKE $3
       ORDER BY name ASC`,
      [req.user.orgId, req.user.id, searchTerm]
    );

    const results = [
      ...foldersResult.rows,
      ...filesResult.rows
    ];

    res.json(results);
  } catch (err) {
    next(err);
  }
};

// Permanently delete folder
const permanentDeleteFolder = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if folder exists and belongs to user
    const folderResult = await db.query(
      'SELECT id FROM drive_folders WHERE id = $1 AND org_id = $2 AND created_by = $3',
      [id, req.user.orgId, req.user.id]
    );

    if (folderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const filesResult = await db.query(
      'SELECT file_path FROM drive_files WHERE folder_id = $1 AND org_id = $2 AND created_by = $3',
      [id, req.user.orgId, req.user.id]
    );

    for (const file of filesResult.rows) {
      if (file.file_path) {
        try {
          await fs.unlink(file.file_path);
        } catch (e) {
          // Ignore ENOENT (file already gone)
          if (e.code !== 'ENOENT') {
            console.error(`Failed to delete file from disk: ${file.file_path}`, e);
          }
        }
      }
    }

    // Delete files from database first (only user's files)
    await db.query('DELETE FROM drive_files WHERE folder_id = $1 AND org_id = $2 AND created_by = $3', [id, req.user.orgId, req.user.id]);

    // Delete folder from database (only user's folder)
    await db.query('DELETE FROM drive_folders WHERE id = $1 AND org_id = $2 AND created_by = $3', [id, req.user.orgId, req.user.id]);

    res.json({ message: 'Folder and its contents permanently deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFolders,
  getFiles,
  createFolder,
  uploadFile: [upload.single('file'), uploadFile],
  deleteFolder,
  deleteFile,
  restoreFile,
  restoreFolder,
  permanentDeleteFile,
  permanentDeleteFolder,
  bulkRestore,
  bulkMoveToTrash,
  bulkPermanentDelete,
  getRecentActivities,
  search
};
