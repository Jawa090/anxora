const db = require('../../config/database');

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status, vendorId } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT po.*, v.name as vendor_name, w.name as warehouse_name,
             COALESCE(SUM(poi.quantity), 0) as item_count,
             string_agg(p.name || ' (x' || poi.quantity || ')', ', ') as product_names
      FROM public.purchase_orders po
      LEFT JOIN public.vendors v ON v.id = po.vendor_id
      LEFT JOIN public.warehouses w ON w.id = po.warehouse_id
      LEFT JOIN public.purchase_order_items poi ON poi.purchase_order_id = po.id
      LEFT JOIN public.products p ON p.id = poi.product_id
      WHERE po.org_id = $1
    `;
    const params = [req.user.orgId];
    let paramIndex = 2;

    if (status) {
      query += ` AND po.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (vendorId) {
      query += ` AND po.vendor_id = $${paramIndex}`;
      params.push(vendorId);
      paramIndex++;
    }

    query += ` GROUP BY po.id, v.id, v.name, w.name ORDER BY po.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Purchase Order getAll error:', err);
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const orderResult = await db.query(
      `SELECT po.*, v.name as vendor_name, v.email as vendor_email, w.name as warehouse_name
       FROM public.purchase_orders po
       LEFT JOIN public.vendors v ON v.id = po.vendor_id
       LEFT JOIN public.warehouses w ON w.id = po.warehouse_id
       WHERE po.id = $1 AND po.org_id = $2`,
      [id, req.user.orgId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const itemsResult = await db.query(
      `SELECT poi.*, p.name as product_name, p.sku
       FROM public.purchase_order_items poi
       LEFT JOIN public.products p ON p.id = poi.product_id
       WHERE poi.purchase_order_id = $1`,
      [id]
    );

    res.json({
      ...orderResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { vendorId, warehouseId, items, notes, expectedDeliveryDate, status, taxAmount, shippingCost, discountAmount } = req.body;

    // Calculate subtotal from items
    const subtotal = items && items.length > 0
      ? items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
      : req.body.totalAmount || 0;

    // Calculate total amount
    const tax = taxAmount || 0;
    const shipping = shippingCost || 0;
    const discount = discountAmount || 0;
    const totalAmount = subtotal + tax + shipping - discount;

    const validStatuses = ['pending', 'approved', 'ordered', 'received', 'cancelled'];
    const orderStatus = validStatuses.includes(status) ? status : 'pending';

    await client.query('BEGIN');

    // Generate PO number - use the latest PO number instead of count to avoid duplicates if POs are deleted
    const lastPoResult = await client.query(
      'SELECT po_number FROM public.purchase_orders WHERE org_id = $1 ORDER BY po_number DESC LIMIT 1',
      [req.user.orgId]
    );
    let nextNum = 1;
    if (lastPoResult.rows.length > 0) {
      const lastPo = lastPoResult.rows[0].po_number;
      // Extract number from PO-XXXXXX
      const numericPart = lastPo.split('-')[1];
      if (numericPart) {
        nextNum = parseInt(numericPart) + 1;
      }
    }
    const poNumber = `PO-${String(nextNum).padStart(6, '0')}`;

    const orderResult = await client.query(
      `INSERT INTO public.purchase_orders (
        org_id, created_by, vendor_id, warehouse_id, po_number, order_date, 
        subtotal, tax_amount, shipping_cost, discount_amount, total_amount, 
        notes, expected_delivery, status
      )
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [req.user.orgId, req.user.id, vendorId, warehouseId || null, poNumber, subtotal, tax, shipping, discount, totalAmount, notes, expectedDeliveryDate || null, orderStatus]
    );

    const orderId = orderResult.rows[0].id;

    if (items && items.length > 0) {
      for (const item of items) {
        let realProductId = item.productId;
        let isUuid = true;
        try {
          if (!realProductId || String(realProductId).startsWith('custom-')) {
            isUuid = false;
          }
        } catch (e) {
          isUuid = false;
        }

        let prodCheck = { rows: [] };
        if (isUuid) {
          prodCheck = await client.query('SELECT id FROM public.products WHERE id = $1 AND org_id = $2', [realProductId, req.user.orgId]).catch(() => ({ rows: [] }));
        }

        if (prodCheck.rows.length === 0) {
          const newSku = 'SKU-' + Math.random().toString(36).substr(2, 9).toUpperCase();
          const newProdResult = await client.query(
            `INSERT INTO public.products (org_id, name, sku, price, cost, status, created_by)
             VALUES ($1, $2, $3, $4, $5, 'active', $6)
             RETURNING id`,
            [req.user.orgId, item.name || 'New Product', newSku, item.unitPrice || 0, item.unitPrice || 0, req.user.id]
          );
          realProductId = newProdResult.rows[0].id;
        }

        await client.query(
          `INSERT INTO public.purchase_order_items (purchase_order_id, product_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [orderId, realProductId, item.quantity, item.unitPrice]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(orderResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Purchase Order create error:', err);
    next(err);
  } finally {
    client.release();
  }
};

const update = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { vendorId, warehouseId, items, notes, expectedDeliveryDate, status, totalAmount } = req.body;

    await client.query('BEGIN');

    // Fetch the existing PO details before updating
    const existingPoResult = await client.query(
      'SELECT warehouse_id, status FROM public.purchase_orders WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (existingPoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    let oldWarehouseId = existingPoResult.rows[0].warehouse_id;
    const oldStatus = existingPoResult.rows[0].status;

    // Resolve fallback if previously received but no warehouse was saved
    if (!oldWarehouseId && oldStatus === 'received') {
      const warehouseResult = await client.query(
        'SELECT id FROM public.warehouses WHERE org_id = $1 LIMIT 1',
        [req.user.orgId]
      );
      oldWarehouseId = warehouseResult.rows[0]?.id;
    }

    // Fetch old items to revert stock if previously received
    const oldItemsResult = await client.query(
      'SELECT * FROM public.purchase_order_items WHERE purchase_order_id = $1',
      [id]
    );
    const oldItems = oldItemsResult.rows;

    // 1. If previously received, revert/deduct old stock from old warehouse
    if (oldStatus === 'received' && oldWarehouseId) {
      for (const item of oldItems) {
        await client.query(
          `UPDATE public.stock 
           SET quantity = GREATEST(0, quantity - $1), updated_at = NOW()
           WHERE product_id = $2 AND warehouse_id = $3 AND org_id = $4`,
          [item.quantity, item.product_id, oldWarehouseId, req.user.orgId]
        );
        // Record stock movement (outbound adjustment)
        await client.query(
          `INSERT INTO public.stock_movements (org_id, product_id, warehouse_id, type, quantity, reference, notes, created_by)
           VALUES ($1, $2, $3, 'adjustment', $4, $5, 'PO Edited - Old Stock Reversed', $6)`,
          [req.user.orgId, item.product_id, oldWarehouseId, -item.quantity, `PO-${id}`, req.user.id]
        );
      }
    }

    // Calculate subtotal from items if present
    const subtotal = items && items.length > 0
      ? items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
      : totalAmount || 0;

    const result = await client.query(
      `UPDATE public.purchase_orders 
       SET vendor_id = COALESCE($1, vendor_id),
           warehouse_id = $2,
           expected_delivery = COALESCE($3, expected_delivery),
           status = COALESCE($4, status),
           notes = COALESCE($5, notes),
           subtotal = $6,
           total_amount = $7,
           updated_at = now()
       WHERE id = $8 AND org_id = $9
       RETURNING *`,
      [vendorId || null, warehouseId || null, expectedDeliveryDate || null, status || null, notes || null, subtotal, totalAmount || subtotal, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (items) {
      // Delete old items
      await client.query('DELETE FROM public.purchase_order_items WHERE purchase_order_id = $1', [id]);

      // Insert new items
      for (const item of items) {
        let realProductId = item.productId;
        let isUuid = true;
        try {
          if (!realProductId || String(realProductId).startsWith('custom-')) {
            isUuid = false;
          }
        } catch (e) {
          isUuid = false;
        }

        let prodCheck = { rows: [] };
        if (isUuid) {
          prodCheck = await client.query('SELECT id FROM public.products WHERE id = $1 AND org_id = $2', [realProductId, req.user.orgId]).catch(() => ({ rows: [] }));
        }

        if (prodCheck.rows.length === 0) {
          const newSku = 'SKU-' + Math.random().toString(36).substr(2, 9).toUpperCase();
          const newProdResult = await client.query(
            `INSERT INTO public.products (org_id, name, sku, price, cost, status, created_by)
             VALUES ($1, $2, $3, $4, $5, 'active', $6)
             RETURNING id`,
            [req.user.orgId, item.name || 'New Product', newSku, item.unitPrice || 0, item.unitPrice || 0, req.user.id]
          );
          realProductId = newProdResult.rows[0].id;
        }

        await client.query(
          `INSERT INTO public.purchase_order_items (purchase_order_id, product_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [id, realProductId, item.quantity, item.unitPrice]
        );
      }
    }

    // 2. If new status is received, add new stock to the new warehouse
    const newStatus = result.rows[0].status;
    const newWarehouseId = result.rows[0].warehouse_id;

    if (newStatus === 'received' && newWarehouseId) {
      const newItemsResult = await client.query(
        'SELECT * FROM public.purchase_order_items WHERE purchase_order_id = $1',
        [id]
      );
      for (const item of newItemsResult.rows) {
        const existingStock = await client.query(
          `SELECT * FROM public.stock WHERE product_id = $1 AND warehouse_id = $2 AND org_id = $3`,
          [item.product_id, newWarehouseId, req.user.orgId]
        );

        if (existingStock.rows.length > 0) {
          await client.query(
            `UPDATE public.stock 
             SET quantity = quantity + $1, updated_at = NOW()
             WHERE product_id = $2 AND warehouse_id = $3 AND org_id = $4`,
            [item.quantity, item.product_id, newWarehouseId, req.user.orgId]
          );
        } else {
          await client.query(
            `INSERT INTO public.stock (org_id, product_id, warehouse_id, quantity, created_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [req.user.orgId, item.product_id, newWarehouseId, item.quantity, req.user.id]
          );
        }

        // Record stock movement (inbound purchase)
        await client.query(
          `INSERT INTO public.stock_movements (org_id, product_id, warehouse_id, type, quantity, reference, notes, created_by)
           VALUES ($1, $2, $3, 'purchase', $4, $5, 'PO Received / Edited', $6)`,
          [req.user.orgId, item.product_id, newWarehouseId, item.quantity, `PO-${id}`, req.user.id]
        );
      }
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Purchase Order update error:', err);
    next(err);
  } finally {
    client.release();
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'approved', 'ordered', 'received', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get current PO info to see previous status and warehouse
    const currentPoResult = await db.query(
      'SELECT status, warehouse_id FROM public.purchase_orders WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (currentPoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const oldStatus = currentPoResult.rows[0].status;
    let warehouseId = currentPoResult.rows[0].warehouse_id;

    // Fallback to first warehouse if PO has no warehouse selected
    if (!warehouseId) {
      const warehouseResult = await db.query(
        'SELECT id FROM public.warehouses WHERE org_id = $1 LIMIT 1',
        [req.user.orgId]
      );
      warehouseId = warehouseResult.rows[0]?.id;

      if (warehouseId) {
        await db.query(
          'UPDATE public.purchase_orders SET warehouse_id = $1 WHERE id = $2 AND org_id = $3',
          [warehouseId, id, req.user.orgId]
        );
      }
    }

    const result = await db.query(
      `UPDATE public.purchase_orders 
       SET status = $1, updated_at = now()
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      [status, id, req.user.orgId]
    );

    const items = await db.query(
      'SELECT * FROM public.purchase_order_items WHERE purchase_order_id = $1',
      [id]
    );

    // If changing to received, add to stock
    if (oldStatus !== 'received' && status === 'received') {
      for (const item of items.rows) {
        if (warehouseId) {
          const existingStock = await db.query(
            `SELECT * FROM public.stock WHERE product_id = $1 AND warehouse_id = $2 AND org_id = $3`,
            [item.product_id, warehouseId, req.user.orgId]
          );

          if (existingStock.rows.length > 0) {
            await db.query(
              `UPDATE public.stock 
               SET quantity = quantity + $1, updated_at = NOW()
               WHERE product_id = $2 AND warehouse_id = $3 AND org_id = $4`,
              [item.quantity, item.product_id, warehouseId, req.user.orgId]
            );
          } else {
            await db.query(
              `INSERT INTO public.stock (org_id, product_id, warehouse_id, quantity, created_by)
               VALUES ($1, $2, $3, $4, $5)`,
              [req.user.orgId, item.product_id, warehouseId, item.quantity, req.user.id]
            );
          }

          // Record stock movement with correct warehouse_id
          await db.query(
            `INSERT INTO public.stock_movements (org_id, product_id, warehouse_id, type, quantity, reference, notes, created_by)
             VALUES ($1, $2, $3, 'purchase', $4, $5, 'PO Received', $6)`,
            [req.user.orgId, item.product_id, warehouseId, item.quantity, `PO-${id}`, req.user.id]
          );
        }
      }
    }
    // If changing away from received, deduct from stock
    else if (oldStatus === 'received' && status !== 'received') {
      for (const item of items.rows) {
        if (warehouseId) {
          await db.query(
            `UPDATE public.stock 
             SET quantity = GREATEST(0, quantity - $1), updated_at = NOW()
             WHERE product_id = $2 AND warehouse_id = $3 AND org_id = $4`,
            [item.quantity, item.product_id, warehouseId, req.user.orgId]
          );

          // Record stock movement with correct warehouse_id
          await db.query(
            `INSERT INTO public.stock_movements (org_id, product_id, warehouse_id, type, quantity, reference, notes, created_by)
             VALUES ($1, $2, $3, 'adjustment', $4, $5, 'PO Status Changed from Received', $6)`,
            [req.user.orgId, item.product_id, warehouseId, -item.quantity, `PO-${id}`, req.user.id]
          );
        }
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM public.purchase_orders WHERE id = $1 AND org_id = $2 AND status = \'pending\' RETURNING id',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found or cannot be deleted' });
    }

    await db.query('DELETE FROM public.purchase_order_items WHERE purchase_order_id = $1', [id]);

    res.json({ message: 'Purchase order deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  updateStatus,
  remove,
};
