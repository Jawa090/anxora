const db = require('../../config/database');

// ============================================================================
// CAR INVENTORY CRUD
// ============================================================================

const getAllCars = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      workspaceId, 
      status, 
      make, 
      model, 
      year,
      minPrice,
      maxPrice,
      condition,
      search
    } = req.query;
    
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        ci.*,
        cw.name as workspace_name,
        u.full_name as created_by_name
      FROM car_inventory ci
      LEFT JOIN car_workspaces cw ON ci.workspace_id = cw.id
      LEFT JOIN users u ON ci.created_by = u.id
      WHERE ci.org_id = $1
    `;
    
    const params = [req.user.orgId];
    let paramIndex = 2;

    if (workspaceId) {
      query += ` AND ci.workspace_id = $${paramIndex}`;
      params.push(workspaceId);
      paramIndex++;
    }

    if (status) {
      query += ` AND ci.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (make) {
      query += ` AND LOWER(ci.make) = LOWER($${paramIndex})`;
      params.push(make);
      paramIndex++;
    }

    if (model) {
      query += ` AND LOWER(ci.model) LIKE LOWER($${paramIndex})`;
      params.push(`%${model}%`);
      paramIndex++;
    }

    if (year) {
      query += ` AND ci.year = $${paramIndex}`;
      params.push(year);
      paramIndex++;
    }

    if (minPrice) {
      query += ` AND ci.selling_price >= $${paramIndex}`;
      params.push(minPrice);
      paramIndex++;
    }

    if (maxPrice) {
      query += ` AND ci.selling_price <= $${paramIndex}`;
      params.push(maxPrice);
      paramIndex++;
    }

    if (condition) {
      query += ` AND ci.condition = $${paramIndex}`;
      params.push(condition);
      paramIndex++;
    }

    if (search) {
      query += ` AND (
        LOWER(ci.make) LIKE LOWER($${paramIndex}) OR
        LOWER(ci.model) LIKE LOWER($${paramIndex}) OR
        LOWER(ci.stock_number) LIKE LOWER($${paramIndex}) OR
        LOWER(ci.vin) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY ci.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    
    // Get total count
    let countQuery = `SELECT COUNT(*) FROM car_inventory ci WHERE ci.org_id = $1`;
    const countParams = [req.user.orgId];
    let countIndex = 2;
    
    if (workspaceId) {
      countQuery += ` AND ci.workspace_id = $${countIndex}`;
      countParams.push(workspaceId);
      countIndex++;
    }
    if (status) {
      countQuery += ` AND ci.status = $${countIndex}`;
      countParams.push(status);
      countIndex++;
    }
    
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get all cars error:', err);
    next(err);
  }
};

const getCarById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        ci.*,
        cw.name as workspace_name,
        cw.location as workspace_location,
        u.full_name as created_by_name
       FROM car_inventory ci
       LEFT JOIN car_workspaces cw ON ci.workspace_id = cw.id
       LEFT JOIN users u ON ci.created_by = u.id
       WHERE ci.id = $1 AND ci.org_id = $2`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }

    // Get documents
    const docs = await db.query(
      'SELECT * FROM car_documents WHERE car_id = $1 ORDER BY created_at DESC',
      [id]
    );

    // Get service history
    const services = await db.query(
      'SELECT * FROM car_service_history WHERE car_id = $1 ORDER BY service_date DESC',
      [id]
    );

    // Get inquiries count
    const inquiries = await db.query(
      'SELECT COUNT(*) as count FROM car_inquiries WHERE car_id = $1',
      [id]
    );

    res.json({
      ...result.rows[0],
      documents: docs.rows,
      service_history: services.rows,
      inquiries_count: parseInt(inquiries.rows[0].count)
    });
  } catch (err) {
    console.error('Get car by ID error:', err);
    next(err);
  }
};

const createCar = async (req, res, next) => {
  try {
    const {
      workspaceId,
      stockNumber,
      vin,
      make,
      model,
      year,
      trimLevel,
      bodyType,
      exteriorColor,
      interiorColor,
      transmission,
      fuelType,
      engineSize,
      cylinders,
      drivetrain,
      condition,
      mileage,
      mileageUnit,
      purchasePrice,
      sellingPrice,
      msrp,
      currency,
      status,
      features,
      standardFeatures,
      optionalFeatures,
      doors,
      seats,
      mpgCity,
      mpgHighway,
      horsepower,
      torque,
      previousOwners,
      accidentHistory,
      serviceHistory,
      warrantyInfo,
      registrationNumber,
      registrationExpiry,
      insuranceExpiry,
      primaryImage,
      images,
      videoUrl,
      location,
      warehouseId,
      description,
      internalNotes,
      tags
    } = req.body;

    if (!workspaceId || !make || !model || !year || !sellingPrice) {
      return res.status(400).json({ 
        error: 'Workspace, make, model, year, and selling price are required' 
      });
    }

    // Generate stock number if not provided
    let finalStockNumber = stockNumber;
    if (!finalStockNumber) {
      const countResult = await db.query(
        'SELECT COUNT(*) FROM car_inventory WHERE org_id = $1',
        [req.user.orgId]
      );
      const count = parseInt(countResult.rows[0].count) + 1;
      finalStockNumber = `CAR-${String(count).padStart(6, '0')}`;
    }

    const result = await db.query(
      `INSERT INTO car_inventory (
        org_id, workspace_id, stock_number, vin, make, model, year, trim_level,
        body_type, exterior_color, interior_color, transmission, fuel_type,
        engine_size, cylinders, drivetrain, condition, mileage, mileage_unit,
        purchase_price, selling_price, msrp, currency, status, features,
        standard_features, optional_features, doors, seats, mpg_city, mpg_highway,
        horsepower, torque, previous_owners, accident_history, service_history,
        warranty_info, registration_number, registration_expiry, insurance_expiry,
        primary_image, images, video_url, location, warehouse_id, description,
        internal_notes, tags, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44,
        $45, $46, $47, $48
      ) RETURNING *`,
      [
        req.user.orgId, workspaceId, finalStockNumber, vin || null, make, model, year, trimLevel || null,
        bodyType || null, exteriorColor || null, interiorColor || null, transmission || null, fuelType || null,
        engineSize || null, cylinders || null, drivetrain || null, condition || 'used', mileage || 0, mileageUnit || 'km',
        purchasePrice || null, sellingPrice, msrp || null, currency || 'USD', status || 'available', 
        features ? JSON.stringify(features) : '[]',
        standardFeatures || null, optionalFeatures || null, doors || null, seats || null, mpgCity || null, mpgHighway || null,
        horsepower || null, torque || null, previousOwners || 0, accidentHistory || false, serviceHistory || null,
        warrantyInfo || null, registrationNumber || null, registrationExpiry || null, insuranceExpiry || null,
        primaryImage || null, images ? JSON.stringify(images) : '[]', videoUrl || null, location || null, warehouseId || null, 
        description || null, internalNotes || null, tags || '{}', req.user.id
      ]
    );

    // Log activity
    await db.query(
      `INSERT INTO car_activity_log (org_id, workspace_id, car_id, activity_type, description, user_id, user_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user.orgId, workspaceId, result.rows[0].id, 'created',
        `Car added: ${year} ${make} ${model}`, req.user.id, req.user.full_name || req.user.email
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create car error:', err);
    next(err);
  }
};

const updateCar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      'workspace_id', 'stock_number', 'vin', 'make', 'model', 'year', 'trim_level',
      'body_type', 'exterior_color', 'interior_color', 'transmission', 'fuel_type',
      'engine_size', 'cylinders', 'drivetrain', 'condition', 'mileage', 'mileage_unit',
      'purchase_price', 'selling_price', 'msrp', 'currency', 'status', 'features',
      'standard_features', 'optional_features', 'doors', 'seats', 'mpg_city', 'mpg_highway',
      'horsepower', 'torque', 'previous_owners', 'accident_history', 'service_history',
      'warranty_info', 'registration_number', 'registration_expiry', 'insurance_expiry',
      'primary_image', 'images', 'video_url', 'location', 'warehouse_id', 'description',
      'internal_notes', 'tags', 'availability_date', 'sold_date', 'reserved_by', 'reserved_until'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbField} = $${paramIndex}`);
        
        // Handle JSON fields
        if (['features', 'images'].includes(field)) {
          values.push(JSON.stringify(updates[field]));
        } else {
          values.push(updates[field]);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_by = $${paramIndex}`);
    values.push(req.user.id);
    paramIndex++;

    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE car_inventory SET ${fields.join(', ')} 
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }

    // Log activity
    await db.query(
      `INSERT INTO car_activity_log (org_id, workspace_id, car_id, activity_type, description, changes, user_id, user_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.user.orgId, result.rows[0].workspace_id, id, 'updated',
        `Car updated: ${result.rows[0].year} ${result.rows[0].make} ${result.rows[0].model}`,
        JSON.stringify(updates), req.user.id, req.user.full_name || req.user.email
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update car error:', err);
    next(err);
  }
};

const deleteCar = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if car has been sold
    const checkSale = await db.query(
      'SELECT id FROM car_sales WHERE car_id = $1',
      [id]
    );

    if (checkSale.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete car with sales history. Consider marking as sold instead.' 
      });
    }

    const result = await db.query(
      'DELETE FROM car_inventory WHERE id = $1 AND org_id = $2 RETURNING *',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }

    res.json({ message: 'Car deleted successfully' });
  } catch (err) {
    console.error('Delete car error:', err);
    next(err);
  }
};

// ============================================================================
// STATISTICS
// ============================================================================

const getCarStats = async (req, res, next) => {
  try {
    const { workspaceId } = req.query;

    let whereClause = 'WHERE org_id = $1';
    const params = [req.user.orgId];
    
    if (workspaceId) {
      whereClause += ' AND workspace_id = $2';
      params.push(workspaceId);
    }

    const stats = await db.query(
      `SELECT 
        COUNT(*) as total_cars,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'sold') as sold,
        COUNT(*) FILTER (WHERE status = 'reserved') as reserved,
        COUNT(*) FILTER (WHERE condition = 'new') as new_cars,
        COUNT(*) FILTER (WHERE condition = 'used') as used_cars,
        AVG(selling_price) as avg_price,
        SUM(selling_price) FILTER (WHERE status = 'available') as total_inventory_value
       FROM car_inventory ${whereClause}`,
      params
    );

    res.json(stats.rows[0]);
  } catch (err) {
    console.error('Get car stats error:', err);
    next(err);
  }
};

// ============================================================================
// IMAGE UPLOAD
// ============================================================================

const uploadCarImages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { setPrimary } = req.body; // Index of image to set as primary

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    // Get current car data
    const carResult = await db.query(
      'SELECT images, primary_image FROM car_inventory WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (carResult.rows.length === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const currentImages = carResult.rows[0].images || [];
    const imagePaths = req.files.map(file => `/uploads/cars/${file.filename}`);
    const allImages = [...currentImages, ...imagePaths];

    // Set primary image
    let primaryImage = carResult.rows[0].primary_image;
    if (setPrimary !== undefined) {
      const primaryIndex = parseInt(setPrimary);
      if (primaryIndex >= 0 && primaryIndex < allImages.length) {
        primaryImage = allImages[primaryIndex];
      }
    } else if (!primaryImage && allImages.length > 0) {
      // Set first image as primary if no primary exists
      primaryImage = allImages[0];
    }

    // Update car with new images
    const result = await db.query(
      `UPDATE car_inventory 
       SET images = $1, primary_image = $2, updated_by = $3
       WHERE id = $4 AND org_id = $5
       RETURNING *`,
      [JSON.stringify(allImages), primaryImage, req.user.id, id, req.user.orgId]
    );

    // Log activity
    await db.query(
      `INSERT INTO car_activity_log (org_id, workspace_id, car_id, activity_type, description, user_id, user_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user.orgId, result.rows[0].workspace_id, id, 'images_uploaded',
        `${req.files.length} image(s) uploaded`, req.user.id, req.user.full_name || req.user.email
      ]
    );

    res.json({
      message: 'Images uploaded successfully',
      images: allImages,
      primaryImage: primaryImage
    });
  } catch (err) {
    console.error('Upload car images error:', err);
    next(err);
  }
};

module.exports = {
  getAllCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
  getCarStats,
  uploadCarImages
};
