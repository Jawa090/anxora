const db = require('../../config/database');
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');

// Helper to resolve dates of a month
function getMonthDateRange(monthStr) {
  // monthStr is expected as YYYY-MM
  const [year, month] = monthStr.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0)); // last day of month
  return { startDate, endDate };
}

// Find employee record by user_id
async function getEmployeeByUserId(userId, orgId) {
  const result = await db.query(
    'SELECT id, first_name, last_name, employee_id FROM public.employees WHERE user_id = $1 AND org_id = $2',
    [userId, orgId]
  );
  return result.rows[0];
}

const getAttendanceExcelReport = async (req, res, next) => {
  try {
    const { month, userId } = req.query;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });
    }

    const { startDate, endDate } = getMonthDateRange(month);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const isAdmin = ['super_admin', 'admin', 'manager'].includes(req.user.role);
    let query = `
      SELECT 
        a.*,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.employee_id as emp_code
      FROM public.attendance a
      JOIN public.employees e ON a.employee_id = e.id
      WHERE a.org_id = $1 AND a.date >= $2 AND a.date <= $3
    `;
    const params = [req.user.orgId, startStr, endStr];

    if (!isAdmin || userId) {
      const targetUserId = isAdmin ? userId : req.user.id;
      const employee = await getEmployeeByUserId(targetUserId, req.user.orgId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee record not found for selected user' });
      }
      query += ` AND a.employee_id = $4`;
      params.push(employee.id);
    }

    query += ` ORDER BY e.first_name ASC, a.date ASC`;
    const { rows: records } = await db.query(query, params);

    // Format data for sheet
    const dataRows = records.map(r => {
      const recordDate = typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date).toISOString().split('T')[0];
      const inTime = r.clock_in ? new Date(r.clock_in).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '—';
      const outTime = r.clock_out ? new Date(r.clock_out).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '—';
      
      const hours = r.total_hours_worked ? parseFloat(r.total_hours_worked).toFixed(1) : 0;
      const extra = r.extra_time ? parseFloat(r.extra_time).toFixed(1) : 0;
      const less = r.less_time ? parseFloat(r.less_time).toFixed(1) : 0;

      return {
        'Employee Code': r.emp_code || 'N/A',
        'Employee Name': r.employee_name,
        'Date': recordDate,
        'Clock In': inTime,
        'Clock Out': outTime,
        'Hours Worked': hours,
        'Extra Time': extra,
        'Less Time': less,
        'Status': r.status.toUpperCase()
      };
    });

    // Create Worksheet
    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${month}.xlsx`);
    res.send(buf);
  } catch (err) {
    next(err);
  }
};

const getLeavesExcelReport = async (req, res, next) => {
  try {
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });
    }

    const { startDate, endDate } = getMonthDateRange(month);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Select all leave requests in org for selected month range
    const query = `
      SELECT 
        lr.id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.employee_id as emp_code,
        lt.name as leave_type_name,
        lr.start_date,
        lr.end_date,
        lr.days_requested,
        lr.status,
        lr.rejection_reason,
        lr.paid_status
      FROM public.leave_requests lr
      JOIN public.employees e ON lr.employee_id = e.id
      JOIN public.leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.org_id = $1 
        AND lr.start_date <= $2 
        AND lr.end_date >= $3
      ORDER BY e.first_name ASC, lr.start_date ASC
    `;
    // Filter leave requests that overlap with the selected month
    const { rows: leaves } = await db.query(query, [req.user.orgId, endStr, startStr]);

    // Format data for sheet
    const dataRows = leaves.map(l => ({
      'Employee Code': l.emp_code || 'N/A',
      'Employee Name': l.employee_name,
      'Leave Type': l.leave_type_name,
      'Start Date': new Date(l.start_date).toISOString().split('T')[0],
      'End Date': new Date(l.end_date).toISOString().split('T')[0],
      'Days Requested': l.days_requested,
      'Paid Status': l.paid_status || 'N/A',
      'Status': l.status.toUpperCase(),
      'Rejection Reason': l.rejection_reason || ''
    }));

    // Create Worksheet
    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leaves Report');

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=leaves_report_${month}.xlsx`);
    res.send(buf);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAttendanceExcelReport,
  getLeavesExcelReport
};
