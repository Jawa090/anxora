const db = require('../../config/database');
const path = require('path');
const fs = require('fs');

const getByEntity = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT d.*, 
              COALESCE(p.full_name, 'Unknown User') as user_name
       FROM public.crm_documents d
       LEFT JOIN public.profiles p ON p.id = d.user_id
       WHERE d.entity_type = $1 AND d.entity_id = $2 AND d.org_id = $3
       ORDER BY d.created_at DESC
       LIMIT $4 OFFSET $5`,
      [entityType, entityId, req.user.orgId, limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const upload = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const filePath = `/uploads/crm/${file.filename}`;

    const result = await db.query(
      `INSERT INTO public.crm_documents 
       (org_id, user_id, entity_type, entity_id, file_name, file_path, mime_type, file_size, provider)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.user.orgId,
        req.user.id,
        entityType,
        entityId,
        file.originalname,
        filePath,
        file.mimetype,
        file.size,
        'local'
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM public.crm_documents 
       WHERE id = $1 AND org_id = $2
       RETURNING file_path`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Optional: Delete the physical file
    const filePath = result.rows[0].file_path;
    const absolutePath = path.join(__dirname, '../../../public', filePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    next(err);
  }
};

const uploadTemp = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const filePath = `/uploads/crm/${file.filename}`;

    res.status(201).json({ 
      file_path: filePath, 
      file_name: file.originalname,
      mime_type: file.mimetype,
      file_size: file.size
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getByEntity,
  upload,
  remove,
  uploadTemp
};
