const ical = require('node-ical');

class ICloudCalendarService {
  async getClient(email, password) {
    if (!email || !password) {
      throw new Error('iCloud credentials are required to connect');
    }

    const { createDAVClient } = await import('tsdav');

    return await createDAVClient({
      serverUrl: 'https://caldav.icloud.com',
      credentials: {
        username: email,
        password,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });
  }

  async listEvents(connection, timeMin, timeMax) {
    // The access_token stores the email, refresh_token stores the password
    const email = connection.access_token;
    const password = connection.refresh_token;
    
    const client = await this.getClient(email, password);
    const calendars = await client.fetchCalendars();
    
    let allEvents = [];
    
    for (const calendar of calendars) {
      try {
        const calendarObjects = await client.fetchCalendarObjects({
          calendar,
        });
        
        for (const obj of calendarObjects) {
          if (!obj.data) continue;
          
          try {
            const parsed = await ical.async.parseICS(obj.data);
            for (const k in parsed) {
              if (parsed.hasOwnProperty(k)) {
                const ev = parsed[k];
                if (ev.type === 'VEVENT') {
                  const start = ev.start;
                  const end = ev.end;
                  if (!start) continue;

                  const isAllDay = !start.datetype || start.datetype === 'date';
                  
                  // Basic filtering by time range (tsdav fetchCalendarObjects timeRange is sometimes not strictly supported by all endpoints, filtering locally is safer)
                  const eventStartDate = new Date(start);
                  if (eventStartDate < new Date(timeMin) || eventStartDate > new Date(timeMax)) {
                     continue;
                  }

                  allEvents.push({
                    id: ev.uid || k,
                    summary: ev.summary,
                    description: ev.description,
                    location: ev.location,
                    start: { dateTime: start.toISOString(), date: isAllDay ? start.toISOString().split('T')[0] : null },
                    end: end ? { dateTime: end.toISOString() } : { dateTime: start.toISOString() }
                  });
                }
              }
            }
          } catch (err) {
            console.error('Error parsing ICS object for iCloud calendar:', err);
          }
        }
      } catch (err) {
        console.error('Error fetching calendar objects from an iCloud calendar:', err);
      }
    }
    
    return allEvents;
  }
}

module.exports = new ICloudCalendarService();
