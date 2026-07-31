const db = require('../../config/database');
const multer = require('multer');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { ensureDefaultStages, DEFAULT_LEAD_STAGES } = require('./leadController');
const { DEFAULT_DEAL_STAGES } = require('./dealController');

/**
 * Normalizes a string for comparison by removing special characters, 
 * whitespace, and converting to lowercase.
 */
const normalizeString = (str) => {
  if (!str) return '';
  return str.toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
};

// Configure multer for file uploads
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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

// Detect fields from uploaded file
const detectFields = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let headers = [];
    let sampleData = [];

    if (ext === '.csv') {
      // Parse CSV
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            if (results.length < 5) results.push(data);
          })
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
      // Parse Excel
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (jsonData.length > 0) {
        headers = Object.keys(jsonData[0]);
        sampleData = jsonData.slice(0, 5);
      }
    }

    // Suggest field mappings based on common patterns
    const fieldMappings = suggestFieldMappings(headers);

    res.json({
      fileName: req.file.originalname,
      filePath: req.file.filename,
      headers,
      sampleData,
      suggestedMappings: fieldMappings,
      totalRows: ext === '.csv' ? (await new Promise((resolve) => {
        let count = 0;
        fs.createReadStream(filePath).pipe(csv()).on('data', () => count++).on('end', () => resolve(count));
      })) : (XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]).length)
    });
  } catch (err) {
    next(err);
  }
};

// Smart field mapping suggestions
const suggestFieldMappings = (headers) => {
  const mappings = {};
  const patterns = {
    // Basic fields
    title: /^(title|name|lead[\s_]?name|contact[\s_]?name|full[\s_]?name|caller)$/i,
    email: /^(email|e[\s_-]?mail|contact[\s_]?email|mail)$/i,
    phone: /^(phone|mobile|telephone|contact[\s_]?number|tel|cell)$/i,
    company: /^(company|company[\s_]?name|organization|org|business)$/i,
    companyEmail: /^(company[\s_]?email|org[\s_]?email|business[\s_]?email)$/i,
    companyPhone: /^(company[\s_]?phone|org[\s_]?phone|business[\s_]?phone)$/i,
    designation: /^(designation|title|job[\s_]?title|position|role)$/i,
    
    // Status and source
    source: /^(source|lead[\s_]?source|origin|channel|first[\s_]?intent)$/i,
    status: /^(status|stage|lead[\s_]?status|current[\s_]?status|state)$/i,
    
    // Value and business
    value: /^(value|amount|deal[\s_]?value|revenue|price|offer)$/i,
    website: /^(website|url|web|site|link)$/i,
    address: /^(address|location|city|street|area)$/i,
    
    // Notes and communication
    notes: /^(notes|description|comments|remarks|details|leads[\s_]?notes)$/i,
    agentName: /^(agent|sales[\s_]?rep|assigned[\s_]?to|owner|handler)$/i,
    serviceInterested: /^(service|product|interest|interested[\s_]?in|offering)$/i,
    
    // Company details
    companySize: /^(company[\s_]?size|employees|team[\s_]?size|staff)$/i,
    decisionMaker: /^(decision[\s_]?maker|authority|buyer|dm)$/i,
    
    // Dates and tracking
    interactionNotes: /^(interaction|conversation|discussion|first[\s_]?reply|last[\s_]?reply)$/i,
    createdAt: /^(created[\s_]?at|created[\s_]?on|date[\s_]?created|registration[\s_]?date|signup[\s_]?date)$/i,
    expectedCloseDate: /^(expected[\s_]?close[\s_]?date|close[\s_]?date|deal[\s_]?date)$/i,
    tags: /^(tags|labels|category|categories)$/i,
    priority: /^(priority|importance|urgency)$/i,
    
    // Additional mappings for your specific fields
    // sr no -> skip (internal reference)
    // response date -> last_contacted_date or created_at
    // caller -> title/name
    // first reply -> interaction_notes
    // last reply -> interaction_notes
    
    // CRM Specific patterns from user files
    lastContactedDate: /^(last[\s_]?contacted[\s_]?date|response[\s_]?date|last[\s_]?reply|first[\s_]?reply|last[\s_]?touch)$/i,
    nextFollowUpDate: /^(next[\s_]?follow[\s_]?up[\s_]?date|follow[\s_]?up[\s_]?date|second[\s_]?follow[\s_]?up|follow[\s_]?up)$/i,
    interactionNotes: /^(interaction[\s_]?notes|client[\s_]?responses|responses|conversation|discussion)$/i,
    agentName: /^(agent|sales[\s_]?rep|assigned[\s_]?to|owner|handler|marketer[\s_]?name|handled[\s_]?by)$/i,
    createdAt: /^(date|created[\s_]?at|entry[\s_]?date|submission[\s_]?date|query[\s_]?date)$/i,
  };

  headers.forEach(header => {
    const lowerHeader = header.toLowerCase().trim();
    
    // Skip serial number fields
    if (/^(sr|s\.?no|serial|#|no\.)$/i.test(lowerHeader)) {
      mappings[header] = null;
      return;
    }

    // Special case for Email/Name headers that might have extra spaces from user files
    if (/email/i.test(lowerHeader)) {
      mappings[header] = 'email';
      return;
    }
    if (/name/i.test(lowerHeader) && !/company/i.test(lowerHeader)) {
      mappings[header] = 'name';
      return;
    }
    if (/phone|contact[\s_]?number/i.test(lowerHeader)) {
      mappings[header] = 'phone';
      return;
    }
    if (/company/i.test(lowerHeader)) {
      mappings[header] = 'companyName';
      return;
    }
    
    // Check patterns
    for (const [field, pattern] of Object.entries(patterns)) {
      if (pattern.test(lowerHeader)) {
        mappings[header] = field;
        return;
      }
    }
    
    // If no match, keep as unmapped
    mappings[header] = null;
  });

  return mappings;
};

// Robust date parser for imports
const parseImportDate = (dateStr) => {
  if (!dateStr) return null;
  
  // If it's already a Date object or a timestamp number
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'number') {
    // Handle Excel serial dates
    if (dateStr > 25569) {
      return new Date((dateStr - 25569) * 86400 * 1000);
    }
    return new Date(dateStr);
  }

  const str = String(dateStr).trim();
  if (!str) return null;

  // Try parsing as ISO
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Try DD/MM/YYYY or MM/DD/YYYY
  const parts = str.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0]);
    const p2 = parseInt(parts[1]);
    const p3 = parseInt(parts[2]);

    // Assume YYYY at the end or beginning
    if (p3 > 1000) {
      // Could be DD/MM/YYYY or MM/DD/YYYY
      // Try to guess based on values
      if (p1 > 12) { // DD/MM/YYYY
        d = new Date(p3, p2 - 1, p1);
      } else { // MM/DD/YYYY
        d = new Date(p3, p1 - 1, p2);
      }
    } else if (p1 > 1000) { // YYYY/MM/DD
      d = new Date(p1, p2 - 1, p3);
    }
  }

  return isNaN(d.getTime()) ? null : d;
};

// Import leads or deals with field mapping
const importLeads = async (req, res, next) => {
  try {
    const { filePath, fieldMapping, workspaceId, skipDuplicates = true, entityType = 'lead' } = req.body;
    const tableName = entityType === 'deal' ? 'deals' : 'leads';

    if (!filePath || !fieldMapping) {
      return res.status(400).json({ error: 'File path and field mapping are required' });
    }

    const fullPath = path.join(__dirname, '../../uploads/imports', filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Create import record
    const importRecord = await db.query(
      `INSERT INTO lead_imports 
       (org_id, workspace_id, imported_by, source_type, file_name, file_path, field_mapping, status, entity_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.user.orgId,
        workspaceId || null,
        req.user.id,
        path.extname(filePath).toLowerCase() === '.csv' ? 'csv' : 'excel',
        path.basename(filePath),
        filePath,
        JSON.stringify(fieldMapping),
        'processing',
        entityType
      ]
    );

    const importId = importRecord.rows[0].id;

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

    // Import leads
    let successful = 0;
    let failed = 0;
    let duplicates = 0;
    const errors = [];

    // Ensure default stages exist for both pipelines
    await ensureDefaultStages(req.user.orgId, 'leads');
    await ensureDefaultStages(req.user.orgId, 'deals');

    // Fetch all stages for the org to perform case-insensitive matching
    const stagesResult = await db.query(
      'SELECT stage_key, stage_label, pipeline FROM pipeline_stages WHERE org_id = $1',
      [req.user.orgId]
    );
    const existingStages = stagesResult.rows;


    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Map fields
        const leadData = {};
        for (const [csvField, dbField] of Object.entries(fieldMapping)) {
          if (dbField && row[csvField] !== undefined && row[csvField] !== null && row[csvField] !== '') {
            const value = String(row[csvField]).trim();
            if (!value) continue;
            
            // If the field already has a value, concatenate or merge
            if (leadData[dbField]) {
              const nonConcatenateFields = ['value', 'probability', 'hourlyRate', 'hoursOfWork', 'proposalAmount', 'invoiceAmount', 'lastContactedDate', 'nextFollowUpDate', 'expectedCloseDate', 'createdAt'];
              const spaceFields = ['title', 'name', 'firstName', 'lastName', 'contactName', 'contactFirstName', 'contactLastName', 'company', 'companyName', 'address', 'city', 'state', 'zip', 'country', 'agentName', 'designation', 'jobTitle'];
              
              if (dbField === 'tags') {
                leadData[dbField] = `${leadData[dbField]}, ${value}`;
              } else if (spaceFields.includes(dbField)) {
                leadData[dbField] += ` ${value}`;
              } else if (!nonConcatenateFields.includes(dbField) || dbField.startsWith('custom_')) {
                leadData[dbField] += ` | ${value}`;
              } else {
                // For strictly single-value fields (dates, numbers), keep the latest
                leadData[dbField] = value;
              }
            } else {
              leadData[dbField] = value;
            }
          }
        }

        // Skip completely empty rows
        if (Object.keys(leadData).length === 0) {
          continue;
        }

        // Pre-processing: Merge city/state/zip/country into address if address is mapped
        const addressComponents = [];
        if (leadData.city) addressComponents.push(leadData.city);
        if (leadData.state) addressComponents.push(leadData.state);
        if (leadData.zip) addressComponents.push(leadData.zip);
        if (leadData.country) addressComponents.push(leadData.country);
        
        if (addressComponents.length > 0) {
          const compStr = addressComponents.join(', ');
          if (leadData.address) {
            if (!leadData.address.includes(compStr)) {
              leadData.address = `${leadData.address}, ${compStr}`;
            }
          } else {
            leadData.address = compStr;
          }
        }

        // Pre-fill Name/Title if missing to avoid validation error
        if (!leadData.title && !leadData.name) {
          leadData.title = 'N/A';
          if (entityType !== 'deal') {
            leadData.name = 'N/A';
          }
        }

        // Check for duplicates
        if (skipDuplicates && leadData.email) {
          const existing = await db.query(
            `SELECT id FROM ${tableName} WHERE org_id = $1 AND email = $2`,
            [req.user.orgId, leadData.email]
          );
          if (existing.rows.length > 0) {
            duplicates++;
            continue;
          }
        }

        // Build dynamic INSERT query based on available fields
        const dbFieldsData = {};
        const fieldMap = {
          email: 'email',
          phone: 'phone',
          firstName: entityType === 'deal' ? 'contact_first_name' : 'first_name',
          lastName: entityType === 'deal' ? 'contact_last_name' : 'last_name',
          name: entityType === 'deal' ? 'title' : 'name',
          title: 'title',
          company: 'company_name',
          companyName: 'company_name',
          companyEmail: 'company_email',
          companyPhone: 'company_phone',
          designation: entityType === 'deal' ? 'designation' : 'designation', // both have it
          jobTitle: entityType === 'deal' ? 'designation' : 'job_title', // Deals use designation for job title
          customerType: 'customer_type',
          source: 'source',
          sourceInfo: 'source_info',
          contactName: 'contact_name',
          description: 'description',
          status: 'status',
          stage: 'stage',
          pipeline: 'pipeline',
          value: 'value',
          currency: 'currency',
          priority: 'priority',
          website: 'website',
          address: 'address',
          notes: 'notes',
          agentName: 'agent_name',
          assignedTo: 'assigned_to',
          serviceInterested: 'service_interested',
          companySize: 'company_size',
          decisionMaker: 'decision_maker',
          industry: 'source_info',
          phoneType: 'phone_type',
          emailType: 'email_type',
          websiteType: 'website_type',
          interactionNotes: 'interaction_notes',
          lastContactedDate: 'last_contacted_date',
          nextFollowUpDate: 'next_follow_up_date',
          expectedCloseDate: 'expected_close_date',
          externalSourceId: 'external_source_id',
          tags: 'tags',
          createdAt: 'created_at',
          // Deal-specific
          probability: 'probability',
          clientType: 'client_type',
          projectType: 'project_type',
          paymentMethod: 'payment_method',
          invoiceLink: 'invoice_link',
          hourlyRate: 'hourly_rate',
          hoursOfWork: 'hours_of_work',
          proposalAmount: 'proposal_amount',
          invoiceAmount: 'invoice_amount',
          scope: 'scope',
          projectBlueprints: 'project_blueprints',
          availableToEveryone: 'available_to_everyone',
          quotationReceived: 'quotation_received',
          qaStatus: 'qa_status',
          feedback: 'feedback',
          feedbackDetails: 'feedback_details',
        };

        // Populate dbFieldsData from mapped leadData
        for (const [frontendField, dbColumn] of Object.entries(fieldMap)) {
          if (leadData[frontendField] !== undefined && leadData[frontendField] !== null && leadData[frontendField] !== '') {
            let value = leadData[frontendField];
            let finalValue;

            // Handle special data types
            if (['value', 'probability', 'hourlyRate', 'hoursOfWork', 'proposalAmount', 'invoiceAmount'].includes(frontendField)) {
              finalValue = parseFloat(value) || 0;
            } else if (frontendField === 'tags') {
              if (Array.isArray(value)) {
                finalValue = value;
              } else if (typeof value === 'string') {
                finalValue = value.split(',').map(t => t.trim()).filter(Boolean);
              } else {
                finalValue = [];
              }
            } else if (['lastContactedDate', 'nextFollowUpDate', 'expectedCloseDate', 'createdAt'].includes(frontendField)) {
              finalValue = parseImportDate(value);
            } else {
              finalValue = typeof value === 'string' ? value.trim() : value;
            }

            if (dbFieldsData[dbColumn]) {
              // Concatenate for text-based database columns if they come from different frontend fields
              const nonConcatenateColumns = ['value', 'probability', 'hourly_rate', 'hours_of_work', 'proposal_amount', 'invoice_amount', 'last_contacted_date', 'next_follow_up_date', 'expected_close_date', 'created_at', 'tags'];
              
              if (!nonConcatenateColumns.includes(dbColumn)) {
                if (!dbFieldsData[dbColumn].includes(String(finalValue))) {
                   dbFieldsData[dbColumn] = `${dbFieldsData[dbColumn]} | ${finalValue}`;
                }
              } else if (dbColumn === 'tags') {
                const existingTags = Array.isArray(dbFieldsData[dbColumn]) ? dbFieldsData[dbColumn] : [];
                const newTags = Array.isArray(finalValue) ? finalValue : [];
                dbFieldsData[dbColumn] = [...new Set([...existingTags, ...newTags])];
              } else {
                dbFieldsData[dbColumn] = finalValue;
              }
            } else {
              dbFieldsData[dbColumn] = finalValue;
            }
          }
        }

        // Pre-sync: For leads, status and stage are the same concept.
        // For deals, status is a high-level state (open/won/lost), stage is the pipeline position.
        if (entityType === 'deal') {
          // For deals: if user mapped a "Stage" column, use it for stage only (not status)
          if (!dbFieldsData.stage && dbFieldsData.status) {
            // User mapped to 'status' but it's really a pipeline stage
            dbFieldsData.stage = dbFieldsData.status;
          }
        } else {
          // For leads: status and stage mirror each other
          if (dbFieldsData.stage && !dbFieldsData.status) {
            dbFieldsData.status = dbFieldsData.stage;
          } else if (!dbFieldsData.stage && dbFieldsData.status) {
            dbFieldsData.stage = dbFieldsData.status;
          }
        }

        // 1. Title/Name fallback (required)
        // For Deals, only 'title' exists. For Leads, both 'title' and 'name' exist.
        if (entityType === 'deal') {
          if (!dbFieldsData.title) {
            dbFieldsData.title = leadData.title || leadData.name || 'N/A';
          }
          // Clean up any stray 'name' field if it leaked in
          delete dbFieldsData.name;
        } else {
          // Lead path
          if (!dbFieldsData.title && !dbFieldsData.name) {
            const fallbackValue = leadData.title || leadData.name || 'N/A';
            dbFieldsData.title = fallbackValue;
            dbFieldsData.name = fallbackValue;
          } else if (dbFieldsData.title && !dbFieldsData.name) {
            dbFieldsData.name = dbFieldsData.title;
          } else if (!dbFieldsData.title && dbFieldsData.name) {
            dbFieldsData.title = dbFieldsData.name;
          }
        }

        // 2. Source default
        if (!dbFieldsData.source) dbFieldsData.source = 'import';
        
        // 3. Pipeline default
        if (!dbFieldsData.pipeline) dbFieldsData.pipeline = entityType === 'deal' ? 'deals' : 'leads';

        // 4. Stage & Status matching/defaults
        const currentPipeline = dbFieldsData.pipeline || (entityType === 'deal' ? 'deals' : 'leads');
        const pipelineStages = existingStages.filter(s => s.pipeline === currentPipeline);
        
        // Logical defaults based on standard keys
        // User requested 'unqualified' as the global default for imports if empty or not matched
        const standardDefault = 'unqualified';
        
        // If we have stages in DB, try to find 'unqualified', otherwise fallback to a pipeline-specific safe default
        let fallbackStageKey = pipelineStages.find(s => s.stage_key === 'unqualified')?.stage_key;
        
        if (!fallbackStageKey) {
          const pipelineSafeDefault = entityType === 'deal' ? 'drawings_received' : 'new';
          fallbackStageKey = pipelineStages.find(s => s.stage_key === pipelineSafeDefault)?.stage_key || 
                            (pipelineStages.length > 0 ? pipelineStages[0].stage_key : pipelineSafeDefault);
        }

        if (dbFieldsData.stage) {
          const normalizedInput = normalizeString(dbFieldsData.stage);
          
          // Find case-insensitive match in existing stages for this pipeline
          const matchedStage = pipelineStages.find(s => 
            normalizeString(s.stage_key) === normalizedInput || 
            normalizeString(s.stage_label) === normalizedInput
          );

          if (matchedStage) {
            dbFieldsData.stage = matchedStage.stage_key;
          } else {
            // No match found, fallback to 'unqualified'
            dbFieldsData.stage = fallbackStageKey;
          }
        } else {
          // Empty stage, default to 'unqualified'
          dbFieldsData.stage = fallbackStageKey;
        }
        
        // Sync status with the resolved stage
        if (entityType === 'deal') {
          // For deals, status is a high-level state: open, won, lost
          // Only override if status is currently a stage key (invalid for deals)
          const dealStatusValues = ['open', 'won', 'lost', 'unqualified'];
          if (!dbFieldsData.status || !dealStatusValues.includes(dbFieldsData.status.toLowerCase())) {
            dbFieldsData.status = 'open';
          }
        } else {
          // For leads, status mirrors stage
          dbFieldsData.status = dbFieldsData.stage;
        }


        const columns = ['org_id', 'workspace_id', 'import_id', 'created_by'];
        const values = [req.user.orgId, workspaceId || null, importId, req.user.id];

        // Push all processed dbFieldsData to columns/values
        for (const [col, val] of Object.entries(dbFieldsData)) {
          columns.push(col);
          if (col === 'source_info' && typeof val === 'string') {
            // If source_info was concatenated as a string, wrap it in an object for JSONB compatibility
            values.push(JSON.stringify({ info: val }));
          } else if (typeof val === 'object' && val !== null) {
            values.push(JSON.stringify(val));
          } else {
            values.push(val);
          }
        }

        // Handle custom fields
        const customFieldsObj = {};
        Object.entries(leadData).forEach(([key, val]) => {
          if (key.startsWith('custom_')) {
            const fieldName = key.replace('custom_', '');
            customFieldsObj[fieldName] = val;
          }
        });

        if (Object.keys(customFieldsObj).length > 0) {
          columns.push('custom_fields');
          values.push(JSON.stringify(customFieldsObj));
        }

        // Build placeholders
        const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');

        // Insert record
        const result = await db.query(
          `INSERT INTO ${tableName} (${columns.join(', ')}) 
           VALUES (${placeholders})
           RETURNING id`,
          values
        );
        const leadId = result.rows[0].id;
        
        // Log individual activity
        await db.query(
          `INSERT INTO crm_activities 
           (org_id, user_id, entity_type, entity_id, activity_type, title, description)
           VALUES ($1, $2, $3, $4, 'created', $5, $6)`,
          [req.user.orgId, req.user.id, entityType, leadId, `${entityType === 'lead' ? 'Lead' : 'Deal'} Imported`, `${entityType === 'lead' ? 'Lead' : 'Deal'} imported via bulk upload from ${path.basename(filePath)}`]
        );

        successful++;
      } catch (err) {
        errors.push({ row: i + 1, error: err.message });
        failed++;
      }
    }

    // Log summary activity for the entire import
    if (successful > 0) {
      await db.query(
        `INSERT INTO crm_activities 
         (org_id, user_id, entity_type, entity_id, activity_type, title, description)
         VALUES ($1, $2, 'system', $1, 'import', 'Bulk ${entityType === 'lead' ? 'Lead' : 'Deal'} Import', $3)`,
        [
          req.user.orgId, 
          req.user.id, 
          `Successfully imported ${successful} ${entityType === 'lead' ? 'leads' : 'deals'} from ${path.basename(filePath)} (${failed} failed, ${duplicates} duplicates skipped)`
        ]
      );
    }

    // Update import record
    await db.query(
      `UPDATE lead_imports 
       SET total_rows = $1, successful_imports = $2, failed_imports = $3, 
           duplicate_skipped = $4, status = $5, error_log = $6, completed_at = NOW()
       WHERE id = $7`,
      [
        rows.length,
        successful,
        failed,
        duplicates,
        failed > 0 ? 'partial' : 'completed',
        JSON.stringify(errors),
        importId
      ]
    );

    res.json({
      importId,
      total: rows.length,
      successful,
      failed,
      duplicates,
      errors: errors.slice(0, 10) // Return first 10 errors
    });
  } catch (err) {
    next(err);
  }
};

// Get import history
const getImportHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, workspaceId, entityType } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT li.*, w.name as workspace_name
      FROM lead_imports li
      LEFT JOIN workgroups w ON w.id = li.workspace_id
      WHERE li.org_id = $1
    `;
    const params = [req.user.orgId];
    let paramIndex = 2;

    if (workspaceId) {
      query += ` AND li.workspace_id = $${paramIndex}`;
      params.push(workspaceId);
      paramIndex++;
    }
    
    if (entityType) {
      query += ` AND li.entity_type = $${paramIndex}`;
      params.push(entityType);
      paramIndex++;
    }

    query += ` ORDER BY li.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const countResult = await db.query(
      'SELECT COUNT(*) FROM lead_imports WHERE org_id = $1',
      [req.user.orgId]
    );

    res.json({
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  upload,
  detectFields,
  importLeads,
  getImportHistory
};
