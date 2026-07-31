const db = require('../../config/database');
const googleCalendarOAuth = require('../../services/googleCalendarOAuth');
const icloudCalendarService = require('../../services/icloudCalendarService');
const microsoftCalendarOAuth = require('../../services/microsoftCalendarOAuth');
const realtimeService = require('../../services/realtimeService');

const getEvents = async (req, res, next) => {
  try {
    const { startDate, endDate, search } = req.query;

    let query = `
      SELECT e.*, u.full_name as creator_name 
      FROM public.calendar_events e
      LEFT JOIN public.users u ON e.created_by = u.id
      WHERE e.org_id = $1 AND e.deleted_at IS NULL
    `;
    const params = [req.user.orgId];
    
    // Privacy: Only show external events to the person who synced them
    // Regular ANXORA events (external_provider IS NULL) are shared with the org
    query += ' AND (external_provider IS NULL OR created_by = $2)';
    params.push(req.user.id);
    
    let paramIndex = 3;

    if (search) {
      query += ` AND (
        title ILIKE $${paramIndex} 
        OR description ILIKE $${paramIndex} 
        OR location ILIKE $${paramIndex}
        OR to_char(start_time, 'FMMonth') ILIKE $${paramIndex}
        OR to_char(start_time, 'FMDay') ILIKE $${paramIndex}
        OR to_char(start_time, 'DD') ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (startDate && !search) {
      query += ` AND end_time >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate && !search) {
      query += ` AND start_time <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ' ORDER BY start_time ASC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM public.calendar_events WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { title, description, startTime, endTime, location, color, allDay, recurrence, invitees = [], attachments = [] } = req.body;


    const result = await db.query(
      `INSERT INTO public.calendar_events (org_id, created_by, title, description, start_time, end_time, location, color, is_all_day, recurrence_rule, attachments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [req.user.orgId, req.user.id, title, description, startTime, endTime, location, color, allDay || false, recurrence, JSON.stringify(attachments)]
    );

    const event = result.rows[0];

    // Insert Attendees
    if (invitees && invitees.length > 0) {
      for (const invitee of invitees) {
        const attendeeEmail = typeof invitee === 'string' ? invitee : invitee.email;
        if (!attendeeEmail) continue;

        await db.query(
          `INSERT INTO public.calendar_event_attendees (event_id, email, status, is_organizer, org_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [event.id, attendeeEmail, 'pending', false, req.user.orgId]
        );
      }
    }

    // Send email notification to creator/invitees


    try {
      const emailService = require('../../services/emailService');
      const userResult = await db.query(
        'SELECT u.email, o.name as org_name FROM users u JOIN organizations o ON u.organization_id = o.id WHERE u.id = $1',
        [req.user.id]
      );
      const userData = userResult.rows[0];

      if (userData?.email) {
        const calendarLink = `${process.env.APP_URL}/collaboration/calendar`;
        const htmlBody = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 30px; color: white;">
              <h1 style="margin: 0; font-size: 24px;"> ${title} Event</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">${userData.org_name || 'ANXORA'}</p>
            </div>
            <div style="padding: 30px; background: white;">
              <h2 style="margin-top: 0; color: #1e293b;">${title}</h2>
              <div style="margin-bottom: 25px; border-left: 4px solid #6366f1; padding-left: 15px;">
                <p style="margin: 5px 0;"><strong>Start:</strong> ${new Date(startTime).toLocaleString()}</p>
                <p style="margin: 5px 0;"><strong>End:</strong> ${new Date(endTime).toLocaleString()}</p>
                ${location ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${location}</p>` : ''}
              </div>
              
              <div style="margin-bottom: 30px;">
                <h3 style="font-size: 14px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 10px;">Description</h3>
                <p style="color: #475569; line-height: 1.6;">${description || 'No description provided.'}</p>
              </div>
              <div style="text-align: center; margin-top: 30px;">
                <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                  <a href="https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${new Date(startTime).toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${new Date(endTime).toISOString().replace(/[-:]/g, '').split('.')[0]}Z&details=${encodeURIComponent(description || '')}&location=${encodeURIComponent(location || '')}" target="_blank" style="color: #1a73e8; background: #f1f5f9; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 500; border: 1px solid #e2e8f0;">
                    Google Calendar
                  </a>
                  
                </div>
              </div>

              <hr style="margin: 30px 0; border: 0; border-top: 1px solid #f1f5f9;" />
              <p style="font-size: 12px; color: #94a3b8;">Sent via ${userData.org_name} CRM. Organizer: ${userData.email}</p>
            </div>
          </div>
        `;


        // Generate ICS file content
        const formatICSDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const icsContent = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Rush CRM//Rush CRM Calendar//EN',
          'CALSCALE:GREGORIAN',
          'METHOD:REQUEST',
          'BEGIN:VEVENT',
          `UID:${event.id}@rush-crm.com`,
          `DTSTAMP:${formatICSDate(new Date())}`,
          `DTSTART:${formatICSDate(startTime)}`,
          `DTEND:${formatICSDate(endTime)}`,
          `SUMMARY:${title}`,
          `DESCRIPTION:${description || '(No description)'}`,
          `LOCATION:${location || '(No location)'}`,
          'STATUS:CONFIRMED',
          'SEQUENCE:0',
          'END:VEVENT',
          'END:VCALENDAR'
        ].join('\r\n');

        const icsAttachment = {
          filename: 'invite.ics',
          content: Buffer.from(icsContent).toString('base64'),
          type: 'text/calendar'
        };

        // Filter out any pre-existing invite.ics to prevent duplicates
        const otherAttachments = Array.isArray(attachments) ? attachments.filter(a => a.filename !== 'invite.ics') : [];
        const finalAttachments = [...otherAttachments, icsAttachment];


        // Only send to invitees. If no invitees, no emails will be sent.
        const allRecipients = [
          ...(invitees.map(i => typeof i === 'string' ? i : i.email).filter(Boolean))
        ].map(email => email?.toLowerCase().trim());

        const uniqueRecipients = [...new Set(allRecipients.filter(Boolean))];

        if (uniqueRecipients.length > 0) {
          // Send emails in background to avoid blocking the response
          (async () => {
            try {
              for (const recipient of uniqueRecipients) {
                await emailService.sendEmail({
                  from: `"${userData.org_name || 'ANXORA'}" <${process.env.SMTP_USER}>`,
                  to: recipient,
                  subject: `📅 Event Created: ${title}`,
                  html: htmlBody,
                  text: `New Event: ${title}\n\nTime: ${new Date(startTime).toLocaleString()}\nLocation: ${location || 'N/A'}\nDescription: ${description || 'N/A'}`,
                  attachments: finalAttachments
                });
              }
            } catch (backgroundEmailErr) {
              console.error('Background email notification failed:', backgroundEmailErr);
            }
          })();
        }
      }
    } catch (err) {
      console.error('Failed to prepare calendar event notification:', err);
    }


    // Fetch creator name for real-time broadcast
    const creatorResult = await db.query(
      "SELECT full_name as name FROM users WHERE id = $1",
      [req.user.id]
    );
    event.creator_name = creatorResult.rows[0]?.name;

    realtimeService.broadcastToOrg(req.user.orgId, 'calendar:event-created', event);

    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
};


const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, startTime, endTime, location, color, allDay, recurrence, attachments } = req.body;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (startTime !== undefined) { fields.push(`start_time = $${paramIndex++}`); values.push(startTime); }
    if (endTime !== undefined) { fields.push(`end_time = $${paramIndex++}`); values.push(endTime); }
    if (location !== undefined) { fields.push(`location = $${paramIndex++}`); values.push(location); }
    if (color !== undefined) { fields.push(`color = $${paramIndex++}`); values.push(color); }
    if (allDay !== undefined) { fields.push(`is_all_day = $${paramIndex++}`); values.push(allDay); }
    if (recurrence !== undefined) { fields.push(`recurrence = $${paramIndex++}`); values.push(recurrence); }
    if (attachments !== undefined) { fields.push(`attachments = $${paramIndex++}`); values.push(JSON.stringify(attachments)); }


    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = now()`);
    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE public.calendar_events SET ${fields.join(', ')} 
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const updatedEvent = result.rows[0];
    realtimeService.broadcastToOrg(req.user.orgId, 'calendar:event-updated', updatedEvent);
    res.json(updatedEvent);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE public.calendar_events SET deleted_at = now() WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'calendar:event-deleted', { id });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
};

const getGoogleAuthUrl = async (req, res, next) => {
  try {
    const state = JSON.stringify({
      userId: req.user.id,
      orgId: req.user.orgId,
      timestamp: Date.now(),
      type: 'calendar'
    });
    const authUrl = googleCalendarOAuth.getAuthUrl(state);
    res.json({ authUrl });
  } catch (err) {
    next(err);
  }
};

const googleCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (!code) throw new Error('Authorization code is missing');

    let userId = req.user?.id;
    let orgId = req.user?.orgId;

    if (state) {
      try {
        const parsed = JSON.parse(state);
        userId = userId || parsed.userId;
        orgId = orgId || parsed.orgId;
      } catch (err) {
        console.warn('Could not parse state parameter:', err.message);
      }
    }

    if (!userId || !orgId) {
      // In case user session is not available (though it should be for the start)
      // but callback can happen after session timeout if not careful.
      // Redirect back with error for now.
      return res.redirect(process.env.APP_URL + '/collaboration/calendar?error=unauthorized');
    }

    const tokens = await googleCalendarOAuth.exchangeCodeForTokens(code);
    const userInfo = await googleCalendarOAuth.getUserInfo(tokens.access_token);

    // Save to calendar_connections
    await db.query(
      `INSERT INTO public.calendar_connections (org_id, user_id, provider, calendar_name, external_calendar_id, access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (org_id, user_id, provider) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       updated_at = now()`,
      [
        orgId,
        userId,
        'google',
        userInfo.email,
        userInfo.email,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date ? new Date(tokens.expiry_date) : null
      ]
    );

    // Redirect to frontend calendar page
    res.redirect(process.env.APP_URL + '/collaboration/calendar?connected=google');
  } catch (err) {
    console.error('❌ Google Calendar callback error:', err);
    res.redirect(process.env.APP_URL + '/collaboration/calendar?error=' + encodeURIComponent(err.message));
  }
};

const getMicrosoftAuthUrl = async (req, res, next) => {
  try {
    const state = JSON.stringify({
      userId: req.user.id,
      orgId: req.user.orgId,
      timestamp: Date.now(),
      type: 'calendar'
    });
    const authUrl = microsoftCalendarOAuth.getAuthUrl(state);
    res.json({ authUrl });
  } catch (err) {
    next(err);
  }
};

const microsoftCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (!code) throw new Error('Authorization code is missing');

    let userId = req.user?.id;
    let orgId = req.user?.orgId;

    if (state) {
      try {
        const parsed = JSON.parse(state);
        userId = userId || parsed.userId;
        orgId = orgId || parsed.orgId;
      } catch (err) {
        console.warn('Could not parse state parameter:', err.message);
      }
    }

    if (!userId || !orgId) {
      return res.redirect(process.env.APP_URL + '/collaboration/calendar?error=unauthorized');
    }

    const tokens = await microsoftCalendarOAuth.exchangeCodeForTokens(code);
    const userInfo = await microsoftCalendarOAuth.getUserInfo(tokens.access_token);

    // Save to calendar_connections
    await db.query(
      `INSERT INTO public.calendar_connections (org_id, user_id, provider, calendar_name, external_calendar_id, access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT ON CONSTRAINT calendar_connections_unique_user_provider DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       updated_at = now()`,
      [
        orgId,
        userId,
        'microsoft',
        userInfo.email,
        userInfo.email,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date ? new Date(tokens.expiry_date) : null
      ]
    );

    // Redirect to frontend calendar page
    res.redirect(process.env.APP_URL + '/collaboration/calendar?connected=microsoft');
  } catch (err) {
    console.error('❌ Microsoft Calendar callback error:', err);
    res.redirect(process.env.APP_URL + '/collaboration/calendar?error=' + encodeURIComponent(err.message));
  }
};

const getConnections = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, provider, calendar_name, last_sync_at, created_at FROM public.calendar_connections WHERE org_id = $1 AND user_id = $2',
      [req.user.orgId, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const disconnect = async (req, res, next) => {
  try {
    const { id } = req.params;

    // The frontend passes provider names like "google". We support both UUIDs and provider names.
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);

    let deletedProvider = id;

    if (isUuid) {
      const conn = await db.query(
        'DELETE FROM public.calendar_connections WHERE id = $1 AND org_id = $2 AND user_id = $3 RETURNING provider',
        [id, req.user.orgId, req.user.id]
      );
      if (conn.rows.length > 0) deletedProvider = conn.rows[0].provider;
    } else {
      await db.query(
        'DELETE FROM public.calendar_connections WHERE provider = $1 AND org_id = $2 AND user_id = $3',
        [id, req.user.orgId, req.user.id]
      );
    }

    // Clean up local events that were synchronized from this provider, 
    // but preserve the "deleted" markers so they don't come back on re-sync
    await db.query(
      'DELETE FROM public.calendar_events WHERE external_provider = $1 AND org_id = $2 AND created_by = $3 AND deleted_at IS NULL',
      [deletedProvider, req.user.orgId, req.user.id]
    );

    res.json({ success: true, message: 'Calendar disconnected and related events cleared' });
  } catch (err) {
    next(err);
  }
};

const connectICloud = async (req, res, next) => {
  try {
    const { appleId, appPassword } = req.body;

    const email = appleId || process.env.APPLE_EMAIL;
    const password = appPassword || process.env.APPLE_PASSWORD;

    if (!email || !password) {
      return res.status(400).json({ error: 'Apple ID and App-Specific Password are required.' });
    }

    // Verify credentials
    await icloudCalendarService.getClient(email, password);

    await db.query(
      `INSERT INTO public.calendar_connections (org_id, user_id, provider, calendar_name, access_token, refresh_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ON CONSTRAINT calendar_connections_unique_user_provider DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       updated_at = now()`,
      [req.user.orgId, req.user.id, 'icloud', email, email, password]
    );

    res.json({ success: true, message: 'iCloud Calendar connected' });
  } catch (err) {
    console.error('iCloud connection error:', err);
    res.status(401).json({ error: 'Failed to connect. Ensure you use an App-Specific Password.' });
  }
};

const syncEvents = async (req, res, next) => {
  try {
    const { provider = 'google' } = req.params;

    // 1. Get tokens
    const connResult = await db.query(
      'SELECT * FROM public.calendar_connections WHERE org_id = $1 AND user_id = $2 AND provider = $3',
      [req.user.orgId, req.user.id, provider]
    );

    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'No connection found for this provider' });
    }

    const connection = connResult.rows[0];
    const now = new Date();
    const timeMin = new Date(now.setMonth(now.getMonth() - 3)).toISOString();
    const timeMax = new Date(now.setMonth(now.getMonth() + 9)).toISOString();

    // 2. Fetch from Provider
    let events = [];
    let color = '#4285F4'; // Google Blue
    if (provider === 'google') {
      events = await googleCalendarOAuth.listEvents(connection, timeMin, timeMax);
    } else if (provider === 'icloud') {
      events = await icloudCalendarService.listEvents(connection, timeMin, timeMax);
      color = '#10b981'; // iCloud Green/Emerald
    } else if (provider === 'microsoft') {
      events = await microsoftCalendarOAuth.listEvents(connection, timeMin, timeMax);
      color = '#0078d4'; // Microsoft Blue
      // If tokens were refreshed during the request, update them in DB
      if (connection._newTokens) {
        await db.query(
          'UPDATE public.calendar_connections SET access_token = $1, refresh_token = $2, expires_at = $3 WHERE id = $4',
          [connection._newTokens.access_token, connection._newTokens.refresh_token, new Date(connection._newTokens.expiry_date), connection.id]
        );
      }
    } else {
      return res.status(400).json({ error: 'Provider not supported for sync yet' });
    }

    // 3. Upsert into local DB
    for (const event of events) {
      if (!event.start?.dateTime && !event.start?.date) continue;

      const startTime = event.start.dateTime || event.start.date;
      let endTime = event.end?.dateTime || event.end?.date;
      if (!endTime) endTime = startTime;

      const externalId = event.id || String(event.uid);
      
      // Assign special colors for holidays and birthdays
      let eventColor = color;
      if (event.isHoliday) eventColor = '#10b981'; // Emerald/Green for holidays
      else if (event.isBirthday) eventColor = '#f43f5e'; // Rose/Pink for birthdays

      await db.query(
        `INSERT INTO public.calendar_events (
          org_id, created_by, title, description, location, 
          start_time, end_time, is_all_day, external_calendar_id, external_provider, color
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (external_calendar_id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          location = EXCLUDED.location,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          is_all_day = EXCLUDED.is_all_day,
          color = EXCLUDED.color,
          updated_at = now()
        WHERE calendar_events.deleted_at IS NULL`,
        [
          req.user.orgId,
          req.user.id,
          event.summary || '(No Title)',
          event.description || '',
          event.location || '',
          startTime,
          endTime,
          !!event.start.date, // If only 'date' is present, it's all day
          externalId,
          provider,
          eventColor
        ]
      );
    }

    // 4. Update last sync time
    await db.query(
      'UPDATE public.calendar_connections SET last_sync_at = now() WHERE id = $1',
      [connection.id]
    );

    res.json({ success: true, count: events.length });
  } catch (err) {
    next(err);
  }
};

const getEventIcs = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM public.calendar_events WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Event not found');
    }

    const event = result.rows[0];
    const { title, description, start_time, end_time, location } = event;

    const formatICSDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Rush CRM//Rush CRM Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${event.id}@rush-crm.com`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(start_time)}`,
      `DTEND:${formatICSDate(end_time)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description || '(No description)'}`,
      `LOCATION:${location || '(No location)'}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="event-${id}.ics"`);
    res.send(icsContent);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getEvents,
  getById,
  create,
  update,
  remove,
  getGoogleAuthUrl,
  googleCallback,
  getMicrosoftAuthUrl,
  microsoftCallback,
  getConnections,
  disconnect,
  syncEvents,
  connectICloud,
  getEventIcs
};
