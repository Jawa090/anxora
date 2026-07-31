const db = require('../../config/database');
const Joi = require('joi');

const templateSchema = Joi.object({
  id: Joi.any().optional(),
  key: Joi.string().required(),
  value: Joi.any().optional(),
  type: Joi.string().optional().default('string'),
  sectionId: Joi.string().optional().allow(null, ''),
  afterFieldId: Joi.string().optional().allow(null, '')
}).unknown(true);

const bulkSaveSchema = Joi.array().items(templateSchema);

const getTemplates = async (req, res, next) => {
  try {
    const { entityType } = req.params;
    const orgId = req.user.orgId;

    const result = await db.query(
      'SELECT key, type, section_id as "sectionId", after_field_id as "afterFieldId" FROM crm_custom_field_templates WHERE org_id = $1 AND entity_type = $2 ORDER BY created_at ASC',
      [orgId, entityType]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const saveTemplates = async (req, res, next) => {
  try {
    const { entityType } = req.params;
    const orgId = req.user.orgId;
    const { error, value: templates } = bulkSaveSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Start a transaction to replace templates
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing templates for this org/entityType
      await client.query(
        'DELETE FROM crm_custom_field_templates WHERE org_id = $1 AND entity_type = $2',
        [orgId, entityType]
      );

      // Insert new templates
      if (templates.length > 0) {
        for (const template of templates) {
          await client.query(
            'INSERT INTO crm_custom_field_templates (org_id, entity_type, key, type, section_id, after_field_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [orgId, entityType, template.key, template.type, template.sectionId, template.afterFieldId]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ message: 'Templates saved successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTemplates,
  saveTemplates
};
