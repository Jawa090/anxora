const db = require('../../config/database');
const multer = require('multer');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Re-use the same upload storage as lead import
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../public/uploads/imports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  }
});

// Suggest field mappings for contacts
const suggestFieldMappings = (headers) => {
  const mappings = {};
  const patterns = {
    first_name: /^(first[_\s]?name|firstname|given[_\s]?name|first)$/i,
    last_name:  /^(last[_\s]?name|lastname|surname|family[_\s]?name|last)$/i,
    email:      /^(email|e[_\-]?mail|contact[_\s]?email|mail)$/i,
    phone:      /^(phone|mobile|telephone|contact[_\s]?number|tel|cell)$/i,
    position:   /^(position|job[_\s]?title|title|role|designation)$/i,
    company_name: /^(company|company[_\s]?name|organization|org|business)$/i,
    source:     /^(source|lead[_\s]?source|origin|channel)$/i,
    notes:      /^(notes|description|comments|remarks|details)$/i,
    contact_type: /^(type|contact[_\s]?type|category)$/i,
    linkedin_url: /^(linkedin|linked[_\s]?in)$/i,
    website:    /^(website|url|web|site|link)$/i,
  };

  headers.forEach(header => {
    const lowerHeader = header.toLowerCase().trim();
    if (/^(sr|s\.?no|serial|#|no\.)$/i.test(lowerHeader)) {
      mappings[header] = null;
      return;
    }
    for (const [field, pattern] of Object.entries(patterns)) {
      if (pattern.test(lowerHeader)) {
        mappings[header] = field;
        return;
      }
    }
    mappings[header] = null;
  });

  return mappings;
};

// Detect fields from uploaded file
const detectFields = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let headers = [];
    let sampleData = [];

    if (ext === '.csv') {
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => { if (results.length < 5) results.push(data); })
          .on('end', () => {
            if (results.length > 0) {
              headers = Object.keys(results[0]);
              sampleData = results;
            }
            resolve();
          })
          .on('error', reject);
      });
    } else {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      if (jsonData.length > 0) {
        headers = Object.keys(jsonData[0]);
        sampleData = jsonData.slice(0, 5);
      }
    }

    res.json({
      fileName: req.file.originalname,
      filePath: req.file.filename,
      headers,
      sampleData,
      suggestedMappings: suggestFieldMappings(headers),
      totalRows: sampleData.length
    });
  } catch (err) {
    next(err);
  }
};

// Import contacts with field mapping
const importContacts = async (req, res, next) => {
  try {
    const { filePath, fieldMapping, skipDuplicates = true } = req.body;

    if (!filePath || !fieldMapping) {
      return res.status(400).json({ error: 'File path and field mapping are required' });
    }

    const fullPath = path.join(__dirname, '../../uploads/imports', filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Parse file
    const ext = path.extname(filePath).toLowerCase();
    let rows = [];

    if (ext === '.csv') {
      await new Promise((resolve, reject) => {
        fs.createReadStream(fullPath)
          .pipe(csv())
          .on('data', (data) => rows.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
    } else {
      const workbook = XLSX.readFile(fullPath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(worksheet);
    }

    let successful = 0;
    let failed = 0;
    let duplicates = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Map CSV fields → contact fields
        const contactData = {};
        for (const [csvField, dbField] of Object.entries(fieldMapping)) {
          if (dbField && row[csvField] !== undefined && row[csvField] !== '') {
            contactData[dbField] = String(row[csvField]).trim();
          }
        }

        // Require at least a first name or email
        if (!contactData.first_name && !contactData.email) {
          contactData.first_name = 'N/A';
        }

        // Check for duplicates by email
        if (skipDuplicates && contactData.email) {
          const existing = await db.query(
            'SELECT id FROM contacts WHERE org_id = $1 AND email = $2',
            [req.user.orgId, contactData.email]
          );
          if (existing.rows.length > 0) {
            duplicates++;
            continue;
          }
        }

        // Build INSERT
        const columns = ['org_id', 'created_by', 'source'];
        const values = [req.user.orgId, req.user.id, contactData.source || 'import'];

        const allowedColumns = [
          'first_name', 'last_name', 'email', 'phone',
          'position', 'company_name', 'notes', 'contact_type',
          'linkedin_url', 'website'
        ];

        for (const col of allowedColumns) {
          if (contactData[col]) {
            columns.push(col);
            values.push(contactData[col]);
          }
        }

        const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');

        await db.query(
          `INSERT INTO contacts (${columns.join(', ')}) VALUES (${placeholders})`,
          values
        );

        successful++;
      } catch (err) {
        errors.push({ row: i + 1, error: err.message });
        failed++;
      }
    }

    res.json({
      total: rows.length,
      successful,
      failed,
      duplicates,
      errors: errors.slice(0, 10)
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { upload, detectFields, importContacts };
