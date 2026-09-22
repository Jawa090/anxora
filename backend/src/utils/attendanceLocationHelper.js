const db = require('../config/database');

let cachedPublicIp = null;
let lastPublicIpFetch = 0;

/**
 * Resolves external public IP of the host machine (useful when running locally)
 */
async function getMachinePublicIp() {
  const now = Date.now();
  if (cachedPublicIp && (now - lastPublicIpFetch < 5000)) {
    return cachedPublicIp;
  }
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.ip) {
        cachedPublicIp = data.ip;
        lastPublicIpFetch = now;
        return data.ip;
      }
    }
  } catch (e) {
    // fallback
  }
  return cachedPublicIp || '127.0.0.1';
}

/**
 * Extracts and cleans client IP from request.
 */
function getClientIp(req) {
  let ip = null;
  const customHeader = req.headers['x-client-public-ip'];
  if (customHeader && typeof customHeader === 'string' && customHeader.trim()) {
    ip = customHeader.trim();
  }
  if (!ip && req.body && typeof req.body.client_public_ip === 'string' && req.body.client_public_ip.trim()) {
    ip = req.body.client_public_ip.trim();
  }
  if (!ip) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const list = String(forwarded).split(',');
      ip = list[0]?.trim();
    }
  }
  if (!ip) {
    ip = req.headers['x-real-ip'] || req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
  }
  if (!ip) return cachedPublicIp || '127.0.0.1';

  // Normalize IPv6-mapped IPv4 e.g. ::ffff:192.168.1.1
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  // Normalize localhost IPv6 to IPv4
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  ip = ip.trim();

  // If request is from localhost loopback and we have resolved external public IP, use it
  if ((ip === '127.0.0.1' || ip === 'localhost') && cachedPublicIp) {
    return cachedPublicIp;
  }

  return ip;
}

/**
 * Checks if a given IP matches an allowed IP (exact or CIDR).
 */
function isIpMatch(clientIp, allowedIpPattern) {
  if (!allowedIpPattern) return false;
  const pattern = allowedIpPattern.trim();
  if (pattern === '*' || pattern === 'any') return true;

  // Exact match
  if (clientIp === pattern) return true;

  // CIDR match (e.g. 192.168.1.0/24)
  if (pattern.includes('/')) {
    try {
      const [range, bits = '32'] = pattern.split('/');
      const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);
      
      const ipToInt = (ipStr) =>
        ipStr
          .split('.')
          .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;

      return (ipToInt(clientIp) & mask) === (ipToInt(range) & mask);
    } catch (e) {
      return false;
    }
  }

  return false;
}

/**
 * Validates attendance action access based on:
 * 1. Office IP restrictions (if enabled for organization)
 * 2. Approved WFH status for today
 * 3. Clock-out exception if session is already active
 */
async function validateAttendanceAccess({ req, employeeId, orgId, action }) {
  const clientIp = getClientIp(req);

  // 1. Fetch active office IPs for this org
  const ipRes = await db.query(
    'SELECT ip_address, label FROM public.office_ip_restrictions WHERE org_id = $1 AND is_active = true',
    [orgId]
  );
  const activeOfficeIps = ipRes.rows;

  // RULE 1: By default, if no office IP is configured (null/empty), anyone can check in from anywhere!
  if (activeOfficeIps.length === 0) {
    return {
      allowed: true,
      reason: 'no_office_ips_configured',
      clientIp,
    };
  }

  // RULE 2: Office IP is configured -> Check if current client IP matches any active office IP
  const matchedOfficeIp = activeOfficeIps.find((o) => isIpMatch(clientIp, o.ip_address));
  if (matchedOfficeIp) {
    return {
      allowed: true,
      inOffice: true,
      clientIp,
      officeLabel: matchedOfficeIp.label,
    };
  }

  // RULE 3: User is OUTSIDE office. Check if employee has an APPROVED Work From Home (WFH) for today
  const wfhRes = await db.query(
    `SELECT id, status, start_date, end_date, reason
     FROM public.wfh_requests
     WHERE employee_id = $1 AND org_id = $2
       AND CURRENT_DATE >= start_date AND CURRENT_DATE <= end_date
     ORDER BY CASE WHEN status = 'approved' THEN 1 WHEN status = 'pending' THEN 2 ELSE 3 END
     LIMIT 1`,
    [employeeId, orgId]
  );

  const activeWfh = wfhRes.rows[0];

  // If approved for WFH today -> ALLOWED from ANY network or IP!
  if (activeWfh && activeWfh.status === 'approved') {
    return {
      allowed: true,
      hasApprovedWfh: true,
      clientIp,
      wfhId: activeWfh.id,
    };
  }

  // RULE 4: Outside office & no approved WFH -> Clock-out exception if session is already active today
  const normalizedAction = String(action || '').toLowerCase().replace('_', '-');
  if (normalizedAction === 'clock-out') {
    const today = new Date().toISOString().split('T')[0];
    const sessionRes = await db.query(
      `SELECT id, clock_in, clock_out FROM public.attendance
       WHERE employee_id = $1 AND org_id = $2 AND DATE(date) = $3
         AND clock_in IS NOT NULL AND clock_out IS NULL
       LIMIT 1`,
      [employeeId, orgId, today]
    );

    if (sessionRes.rows.length > 0) {
      return {
        allowed: true,
        isClockOutException: true,
        clientIp,
        message: 'Clock-out permitted for existing active session.',
      };
    }
  }

  // Otherwise, deny action with descriptive status
  const wfhStatusText = activeWfh?.status === 'pending'
    ? 'Your Work From Home (WFH) request for today is currently pending approval.'
    : activeWfh?.status === 'rejected'
    ? 'Your Work From Home (WFH) request for today was rejected.'
    : 'No approved Work From Home (WFH) request found for today.';

  let actionText = 'Clock-in';
  if (normalizedAction === 'break-start') actionText = 'Starting a break';
  else if (normalizedAction === 'break-end') actionText = 'Ending a break';
  else if (normalizedAction === 'clock-out') actionText = 'Clock-out';

  const errorMessage = `${actionText} blocked: You are outside the office network (Your IP: ${clientIp}). ${wfhStatusText} Please connect to the office Wi-Fi or request an approved Work From Home (WFH) schedule.`;

  return {
    allowed: false,
    error: errorMessage,
    clientIp,
    wfhStatus: activeWfh?.status || 'none',
  };
}

module.exports = {
  getClientIp,
  getMachinePublicIp,
  isIpMatch,
  validateAttendanceAccess,
};
