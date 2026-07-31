const db = require('../../config/database');

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status, customerId } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT i.*, 
             c.name as customer_name,
             TRIM(CONCAT(p.first_name, ' ', p.last_name)) as contact_name
      FROM public.invoices i
      LEFT JOIN public.customers c ON c.id = i.customer_id
      LEFT JOIN public.contacts p ON p.id = i.contact_id
      WHERE i.org_id = $1
    `;
    const params = [req.user.orgId];
    let paramIndex = 2;

    if (status && status !== 'all') {
      query += ` AND i.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (customerId) {
      query += ` AND i.customer_id = $${paramIndex}`;
      params.push(customerId);
      paramIndex++;
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Sales Order (Invoice) getAll error:', err);
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const orderResult = await db.query(
      `SELECT i.*, 
              c.name as customer_name,
              TRIM(CONCAT(p.first_name, ' ', p.last_name)) as contact_name,
              p.email as contact_email,
              p.phone as contact_phone
       FROM public.invoices i
       LEFT JOIN public.customers c ON c.id = i.customer_id
       LEFT JOIN public.contacts p ON p.id = i.contact_id
       WHERE i.id = $1 AND i.org_id = $2`,
      [id, req.user.orgId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const itemsResult = await db.query(
      `SELECT * FROM public.invoice_items WHERE invoice_id = $1`,
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
  try {
    let {
      customerId,
      contactId,
      companyName,
      contactName,
      title,
      items,
      value,
      currency,
      status,
      notes,
      dueDate,
      taxAmount,
      shippingCost,
      discountAmount
    } = req.body;

    // Resolve Customer ID from companyName if not provided
    if (!customerId && companyName) {
      const existingCustomer = await db.query(
        'SELECT id FROM public.customers WHERE name = $1 AND org_id = $2 LIMIT 1',
        [companyName, req.user.orgId]
      );
      if (existingCustomer.rows.length > 0) {
        customerId = existingCustomer.rows[0].id;
      } else {
        const newCustomer = await db.query(
          'INSERT INTO public.customers (name, org_id) VALUES ($1, $2) RETURNING id',
          [companyName, req.user.orgId]
        );
        customerId = newCustomer.rows[0].id;
      }
    }

    // Resolve Contact ID from contactName if not provided
    if (!contactId && contactName) {
      const names = contactName.trim().split(/\s+/);
      const firstName = names[0];
      const lastName = names.length > 1 ? names.slice(1).join(' ') : '';

      const existingContact = await db.query(
        'SELECT id FROM public.contacts WHERE first_name = $1 AND last_name = $2 AND org_id = $3 LIMIT 1',
        [firstName, lastName, req.user.orgId]
      );
      if (existingContact.rows.length > 0) {
        contactId = existingContact.rows[0].id;
      } else {
        const newContact = await db.query(
          'INSERT INTO public.contacts (first_name, last_name, org_id, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
          [firstName, lastName, req.user.orgId, req.user.id]
        );
        contactId = newContact.rows[0].id;
      }
    }

    // Use value as total_amount if no items
    const subtotal = items && items.length > 0
      ? items.reduce((sum, item) => sum + (item.quantity * (item.unit_price || item.unitPrice || 0)), 0)
      : (value || 0);

    const tax = taxAmount || 0;
    const shipping = shippingCost || 0;
    const discount = discountAmount || 0;
    const totalAmount = subtotal + tax + shipping - discount;

    // Generate Invoice Number
    const lastInvoiceResult = await db.query(
      'SELECT invoice_number FROM public.invoices WHERE org_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.orgId]
    );

    let nextNum = 1;
    if (lastInvoiceResult.rows.length > 0) {
      const lastInv = lastInvoiceResult.rows[0].invoice_number;
      // Extract numeric part from ORD-000001
      const match = lastInv.match(/\d+/);
      if (match) {
        nextNum = parseInt(match[0]) + 1;
      }
    }
    const invoiceNumber = `ORD-${String(nextNum).padStart(6, '0')}`;

    const orderResult = await db.query(
      `INSERT INTO public.invoices (
        org_id, created_by, customer_id, contact_id, invoice_number, 
        invoice_date, due_date, status, 
        subtotal, tax_amount, shipping_cost, discount_amount, total_amount, 
        currency, notes
      )
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        req.user.orgId,
        req.user.id,
        customerId || null,
        contactId || null,
        invoiceNumber,
        dueDate || null,
        status || 'draft',
        subtotal,
        tax,
        shipping,
        discount,
        totalAmount,
        currency || 'USD',
        notes || title || null
      ]
    );

    const orderId = orderResult.rows[0].id;

    if (items && items.length > 0) {
      for (const item of items) {
        await db.query(
          `INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price, description)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            orderId,
            item.productId || null,
            item.quantity,
            item.unitPrice || item.unit_price || 0,
            item.description || item.name || null
          ]
        );
      }
    }

    res.status(201).json(orderResult.rows[0]);
  } catch (err) {
    console.error('Sales Order create error:', err);
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, dueDate } = req.body;

    const result = await db.query(
      `UPDATE public.invoices 
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           due_date = COALESCE($3, due_date),
           updated_at = now()
       WHERE id = $4 AND org_id = $5
       RETURNING *`,
      [status, notes, dueDate, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
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
      'DELETE FROM public.invoices WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await db.query('DELETE FROM public.invoice_items WHERE invoice_id = $1', [id]);

    res.json({ message: 'Order deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};
