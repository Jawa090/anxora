const db = require('../../config/database');
const notificationService = require('../../services/notificationService');
const realtimeService = require('../../services/realtimeService');

// ==================== DASHBOARD STATS ====================
const getDashboardStats = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const { warehouseId } = req.query;

    const hasWarehouse = warehouseId && warehouseId !== 'all' && warehouseId !== 'biwords';

    // Total products
    let productsQuery = `
      SELECT 
        COUNT(*) as total_products,
        COUNT(*) FILTER (WHERE status = 'active') as active_products
      FROM products WHERE org_id = $1
    `;
    let productsParams = [orgId];

    if (hasWarehouse) {
      productsQuery = `
        SELECT 
          COUNT(DISTINCT p.id) as total_products,
          COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') as active_products
        FROM products p
        INNER JOIN stock s ON p.id = s.product_id
        WHERE p.org_id = $1 AND s.warehouse_id = $2
      `;
      productsParams = [orgId, warehouseId];
    }

    const productsResult = await db.query(productsQuery, productsParams);

    // Stock value
    let stockValueQuery = `
      SELECT 
        COALESCE(SUM(s.quantity), 0) as total_stock_value
      FROM stock s
      WHERE s.org_id = $1
    `;
    let stockValueParams = [orgId];

    if (hasWarehouse) {
      stockValueQuery = `
        SELECT 
          COALESCE(SUM(s.quantity), 0) as total_stock_value
        FROM stock s
        WHERE s.org_id = $1 AND s.warehouse_id = $2
      `;
      stockValueParams = [orgId, warehouseId];
    }

    const stockValueResult = await db.query(stockValueQuery, stockValueParams);

    // Low stock products
    let lowStockQuery = `
      SELECT COUNT(*) as low_stock_products
      FROM (
        SELECT p.id, SUM(s.quantity) as total_stock
        FROM products p
        LEFT JOIN stock s ON p.id = s.product_id
        WHERE p.org_id = $1 AND p.status = 'active'
        GROUP BY p.id
        HAVING SUM(s.quantity) <= COALESCE(p.min_stock_level, 10)
      ) as low_stock
    `;
    let lowStockParams = [orgId];

    if (hasWarehouse) {
      lowStockQuery = `
        SELECT COUNT(*) as low_stock_products
        FROM (
          SELECT p.id, SUM(s.quantity) as total_stock
          FROM products p
          INNER JOIN stock s ON p.id = s.product_id
          WHERE p.org_id = $1 AND p.status = 'active' AND s.warehouse_id = $2
          GROUP BY p.id
          HAVING SUM(s.quantity) <= COALESCE(p.min_stock_level, 10)
        ) as low_stock
      `;
      lowStockParams = [orgId, warehouseId];
    }

    const lowStockResult = await db.query(lowStockQuery, lowStockParams);

    // Warehouses and vendors
    const warehousesResult = await db.query(
      'SELECT COUNT(*) as total_warehouses FROM warehouses WHERE org_id = $1',
      [orgId]
    );

    const vendorsResult = await db.query(
      'SELECT COUNT(*) as total_vendors FROM vendors WHERE org_id = $1',
      [orgId]
    );

    // Purchase orders stats
    const poStatsResult = await db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_pos,
        COUNT(*) FILTER (WHERE status = 'approved') as in_transit_pos,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_pos
      FROM purchase_orders WHERE org_id = $1`,
      [orgId]
    );

    // Employee assignments (only count where product and employee still exist)
    let assignmentsQuery = `
      SELECT COUNT(*) as assigned_to_employees
      FROM employee_product_assignments epa
      JOIN products p ON epa.product_id = p.id
      JOIN employees e ON epa.employee_id = e.id
      WHERE epa.org_id = $1 AND epa.status = 'assigned'
    `;
    let assignmentsParams = [orgId];

    if (hasWarehouse) {
      assignmentsQuery = `
        SELECT COUNT(DISTINCT epa.id) as assigned_to_employees
        FROM employee_product_assignments epa
        JOIN products p ON epa.product_id = p.id
        JOIN employees e ON epa.employee_id = e.id
        JOIN stock s ON p.id = s.product_id
        WHERE epa.org_id = $1 AND epa.status = 'assigned' AND s.warehouse_id = $2
      `;
      assignmentsParams = [orgId, warehouseId];
    }

    const assignmentsResult = await db.query(assignmentsQuery, assignmentsParams);

    res.json({
      data: {
        totalProducts: parseInt(productsResult.rows[0].total_products),
        activeProducts: parseInt(productsResult.rows[0].active_products),
        totalStockValue: parseFloat(stockValueResult.rows[0].total_stock_value),
        stockValueChange: 0, // TODO: Calculate vs last month
        lowStockProducts: parseInt(lowStockResult.rows[0].low_stock_products),
        totalWarehouses: parseInt(warehousesResult.rows[0].total_warehouses),
        totalVendors: parseInt(vendorsResult.rows[0].total_vendors),
        pendingPOs: parseInt(poStatsResult.rows[0].pending_pos),
        inTransitPOs: parseInt(poStatsResult.rows[0].in_transit_pos),
        completedPOs: parseInt(poStatsResult.rows[0].completed_pos),
        assignedToEmployees: parseInt(assignmentsResult.rows[0].assigned_to_employees),
      }
    });
  } catch (err) {
    next(err);
  }
};

// ==================== EMPLOYEE ASSIGNMENTS ====================
const getEmployeeAssignments = async (req, res, next) => {
  try {
    const { employeeId, status } = req.query;

    let query = `
      SELECT 
        epa.*,
        p.name as product_name,
        p.sku,
        p.category,
        (
          SELECT w.name FROM stock s
          JOIN warehouses w ON s.warehouse_id = w.id
          WHERE s.product_id = p.id AND s.org_id = epa.org_id
          ORDER BY s.quantity DESC
          LIMIT 1
        ) as warehouse_name,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.department,
        u.avatar_url as employee_avatar,
        u1.full_name as assigned_by_name,
        u2.full_name as returned_by_name
      FROM employee_product_assignments epa
      JOIN products p ON epa.product_id = p.id
      JOIN employees e ON epa.employee_id = e.id
      LEFT JOIN users u ON LOWER(u.email) = LOWER(e.email)
      LEFT JOIN users u1 ON epa.assigned_by = u1.id
      LEFT JOIN users u2 ON epa.returned_by = u2.id
      WHERE epa.org_id = $1
    `;

    const params = [req.user.orgId];
    let paramIndex = 2;

    if (employeeId) {
      query += ` AND epa.employee_id = $${paramIndex}`;
      params.push(employeeId);
      paramIndex++;
    }

    if (status) {
      query += ` AND epa.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ' ORDER BY epa.assigned_date DESC';

    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
};

const createEmployeeAssignment = async (req, res, next) => {
  try {
    const { employee_id, product_id, quantity, condition_at_assignment, notes } = req.body;

    // Check if product has enough stock
    const stockCheck = await db.query(
      'SELECT COALESCE(SUM(quantity), 0) as total_stock FROM stock WHERE product_id = $1 AND org_id = $2',
      [product_id, req.user.orgId]
    );

    const availableStock = parseInt(stockCheck.rows[0]?.total_stock || 0);
    
    console.log(`Stock check for product ${product_id}: Available=${availableStock}, Requested=${quantity}`);
    
    if (availableStock < quantity) {
      return res.status(400).json({ 
        error: 'Insufficient stock available',
        available: availableStock,
        requested: quantity
      });
    }

    const result = await db.query(
      `INSERT INTO employee_product_assignments (
        org_id, employee_id, product_id, quantity, 
        condition_at_assignment, notes, assigned_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [req.user.orgId, employee_id, product_id, quantity, condition_at_assignment, notes, req.user.id]
    );

    // Reduce stock (from warehouse with most stock)
    const targetStock = await db.query(
      `SELECT id, warehouse_id FROM stock 
       WHERE product_id = $1 AND org_id = $2 AND quantity >= $3
       ORDER BY quantity DESC
       LIMIT 1`,
      [product_id, req.user.orgId, quantity]
    );

    let targetWarehouseId = null;
    if (targetStock.rows.length > 0) {
      targetWarehouseId = targetStock.rows[0].warehouse_id;
      await db.query(
        'UPDATE stock SET quantity = quantity - $1 WHERE id = $2',
        [quantity, targetStock.rows[0].id]
      );
    }

    // Fetch employee name and product name for notification
    const empResult = await db.query(
      `SELECT CONCAT(e.first_name, ' ', e.last_name) as employee_name, e.user_id,
              p.name as product_name, u.role as user_role
       FROM employees e
       JOIN products p ON p.id = $2
       LEFT JOIN public.users u ON u.id = e.user_id
       WHERE e.id = $1`,
      [employee_id, product_id]
    );

    const empData = empResult.rows[0];

    // Send in-app notification to the employee (if they have a user account AND they are admin/super_admin)
    if (empData?.user_id && (empData.user_role === 'admin' || empData.user_role === 'super_admin')) {
      await notificationService.notify(
        req.user.orgId,
        empData.user_id,
        'general',
        'Product Assigned to You',
        `${quantity} unit(s) of "${empData.product_name}" have been assigned to you.`,
        '/inventory/assignments',
        req.user.id,
        { assignment_id: result.rows[0].id, product_id, quantity }
      );
    }

    // Also notify all org admins/managers
    const admins = await notificationService.getOrgAdmins(req.user.orgId);
    if (admins.length > 0) {
      await notificationService.notify(
        req.user.orgId,
        admins,
        'general',
        'Product Assigned',
        `${quantity} unit(s) of "${empData?.product_name || 'product'}" assigned to ${empData?.employee_name || 'employee'}.`,
        '/inventory/assignments',
        req.user.id,
        { assignment_id: result.rows[0].id, product_id, quantity }
      );
    }

    // Emit org-wide real-time event so all clients update instantly
    if (realtimeService.io) {
      realtimeService.io.to(`org:${req.user.orgId}`).emit('inventory:assignment', {
        action: 'created',
        assignment: result.rows[0],
        product_id,
        employee_id,
        quantity,
        employee_name: empData?.employee_name,
        product_name: empData?.product_name,
      });
    }

    // Log stock movement activity
    if (targetWarehouseId) {
      const empName = empData?.employee_name || 'employee';
      const prodName = empData?.product_name || 'product';
      await db.query(
        `INSERT INTO public.stock_movements (
          org_id, product_id, warehouse_id, type, quantity, reference, notes, created_by
        ) VALUES ($1, $2, $3, 'out', $4, $5, $6, $7)`,
        [
          req.user.orgId, 
          product_id, 
          targetWarehouseId, 
          quantity, 
          `Assign to ${empName}`, 
          `${prodName} assigned to employee ${empName}`, 
          req.user.id
        ]
      ).catch((e) => console.error('Failed to log stock movement on assignment:', e.message));
    }

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const returnEmployeeAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { condition_at_return, notes } = req.body;

    // Get assignment details
    const assignment = await db.query(
      'SELECT * FROM employee_product_assignments WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (assignment.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignmentData = assignment.rows[0];

    // If assignment is already returned, delete it completely
    if (assignmentData.status === 'returned') {
      await db.query(
        'DELETE FROM employee_product_assignments WHERE id = $1 AND org_id = $2',
        [id, req.user.orgId]
      );
      return res.json({ message: 'Assignment record deleted successfully' });
    }

    // Auto-detect which warehouse to return stock to:
    // 1st: warehouse that already has a stock row for this product (highest qty)
    // 2nd: fallback to any warehouse in the org
    const stockRow = await db.query(
      `SELECT warehouse_id FROM stock 
       WHERE product_id = $1 AND org_id = $2 
       ORDER BY quantity DESC 
       LIMIT 1`,
      [assignmentData.product_id, req.user.orgId]
    );

    let targetWarehouseId = stockRow.rows[0]?.warehouse_id;

    // Fallback: any warehouse in org
    if (!targetWarehouseId) {
      const whRow = await db.query(
        'SELECT id FROM warehouses WHERE org_id = $1 LIMIT 1',
        [req.user.orgId]
      );
      targetWarehouseId = whRow.rows[0]?.id;
    }

    // Update assignment status
    const result = await db.query(
      `UPDATE employee_product_assignments 
       SET status = 'returned', 
           return_date = CURRENT_DATE,
           condition_at_return = $1,
           notes = COALESCE($2, notes),
           returned_by = $3
       WHERE id = $4 AND org_id = $5
       RETURNING *`,
      [condition_at_return, notes, req.user.id, id, req.user.orgId]
    );

    // Add stock back to auto-detected warehouse
    if (targetWarehouseId) {
      // If stock row exists, increment; otherwise insert
      const existing = await db.query(
        'SELECT id FROM stock WHERE product_id = $1 AND warehouse_id = $2 AND org_id = $3',
        [assignmentData.product_id, targetWarehouseId, req.user.orgId]
      );

      if (existing.rows.length > 0) {
        await db.query(
          `UPDATE stock SET quantity = quantity + $1 
           WHERE product_id = $2 AND warehouse_id = $3 AND org_id = $4`,
          [assignmentData.quantity, assignmentData.product_id, targetWarehouseId, req.user.orgId]
        );
      } else {
        await db.query(
          `INSERT INTO stock (org_id, product_id, warehouse_id, quantity) 
           VALUES ($1, $2, $3, $4)`,
          [req.user.orgId, assignmentData.product_id, targetWarehouseId, assignmentData.quantity]
        );
      }
    }

    // Log return stock movement activity
    if (targetWarehouseId) {
      // Fetch product name and employee name
      const info = await db.query(
        `SELECT p.name as product_name, CONCAT(e.first_name, ' ', e.last_name) as employee_name 
         FROM products p, employees e 
         WHERE p.id = $1 AND e.id = $2`,
        [assignmentData.product_id, assignmentData.employee_id]
      );
      const prodName = info.rows[0]?.product_name || 'product';
      const empName = info.rows[0]?.employee_name || 'employee';

      await db.query(
        `INSERT INTO public.stock_movements (
          org_id, product_id, warehouse_id, type, quantity, reference, notes, created_by
        ) VALUES ($1, $2, $3, 'in', $4, $5, $6, $7)`,
        [
          req.user.orgId, 
          assignmentData.product_id, 
          targetWarehouseId, 
          assignmentData.quantity, 
          `Return from ${empName}`, 
          `${prodName} returned by employee ${empName}`, 
          req.user.id
        ]
      ).catch((e) => console.error('Failed to log stock movement on return:', e.message));
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ==================== STOCK ADJUSTMENTS ====================
const getStockAdjustments = async (req, res, next) => {
  try {
    const { product_id, warehouse_id } = req.query;

    let query = `
      SELECT 
        sa.*,
        p.name as product_name,
        p.sku,
        w.name as warehouse_name,
        u.full_name as adjusted_by_name
      FROM stock_adjustments sa
      JOIN products p ON sa.product_id = p.id
      JOIN warehouses w ON sa.warehouse_id = w.id
      LEFT JOIN users u ON sa.adjusted_by = u.id
      WHERE sa.org_id = $1
    `;

    const params = [req.user.orgId];
    let paramIndex = 2;

    if (product_id) {
      query += ` AND sa.product_id = $${paramIndex}`;
      params.push(product_id);
      paramIndex++;
    }

    if (warehouse_id) {
      query += ` AND sa.warehouse_id = $${paramIndex}`;
      params.push(warehouse_id);
      paramIndex++;
    }

    query += ' ORDER BY sa.created_at DESC LIMIT 100';

    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
};

const createStockAdjustment = async (req, res, next) => {
  try {
    const { product_id, warehouse_id, adjustment_type, quantity_adjusted, reason, reference_number } = req.body;

    // Get current stock
    const stockResult = await db.query(
      'SELECT quantity FROM stock WHERE product_id = $1 AND warehouse_id = $2 AND org_id = $3',
      [product_id, warehouse_id, req.user.orgId]
    );

    if (stockResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stock record not found' });
    }

    const quantityBefore = stockResult.rows[0].quantity;
    const quantityAfter = adjustment_type === 'increase' 
      ? quantityBefore + quantity_adjusted 
      : quantityBefore - quantity_adjusted;

    if (quantityAfter < 0) {
      return res.status(400).json({ error: 'Adjustment would result in negative stock' });
    }

    // Create adjustment record
    const result = await db.query(
      `INSERT INTO stock_adjustments (
        org_id, product_id, warehouse_id, adjustment_type,
        quantity_before, quantity_adjusted, quantity_after,
        reason, reference_number, adjusted_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        req.user.orgId, product_id, warehouse_id, adjustment_type,
        quantityBefore, quantity_adjusted, quantityAfter,
        reason, reference_number, req.user.id
      ]
    );

    // Update stock
    await db.query(
      'UPDATE stock SET quantity = $1 WHERE product_id = $2 AND warehouse_id = $3 AND org_id = $4',
      [quantityAfter, product_id, warehouse_id, req.user.orgId]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardStats,
  getEmployeeAssignments,
  createEmployeeAssignment,
  returnEmployeeAssignment,
  getStockAdjustments,
  createStockAdjustment,
};

module.exports = {
  getDashboardStats,
  getEmployeeAssignments,
  assignProductToEmployee: createEmployeeAssignment,
  removeAssignment: returnEmployeeAssignment,
  getStockAdjustments,
  createStockAdjustment,
};
