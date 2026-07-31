/**
 * Microsoft (Outlook) Calendar OAuth Service
 * Uses Azure AD OAuth 2.0 + Microsoft Graph API
 */

class MicrosoftCalendarOAuthService {
  constructor() {
    this.clientId = null;
    this.clientSecret = null;
    this.redirectUri = null;
    this.initializeOAuth();
  }

  initializeOAuth() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID;
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    this.redirectUri = process.env.MICROSOFT_CALENDAR_REDIRECT_URI;

    if (!this.clientId || !this.clientSecret || this.clientId.includes('your-')) {
      console.warn('⚠️  Microsoft Calendar OAuth credentials not configured properly.');
      return;
    }

    console.log('✅ Microsoft Calendar OAuth initialized successfully');
  }

  getAuthUrl(state = null) {
    if (!this.clientId) {
      this.initializeOAuth();
      if (!this.clientId) throw new Error('Microsoft Calendar OAuth not configured');
    }

    const scopes = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'Calendars.Read',
      'User.Read'
    ];

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      response_mode: 'query',
      prompt: 'consent',
    });

    if (state) {
      params.set('state', state);
    }

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code) {
    if (!this.clientId) throw new Error('Microsoft Calendar OAuth not configured');

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Microsoft token exchange error:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }

    const tokens = await response.json();
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      expiry_date: Date.now() + (tokens.expires_in * 1000),
    };
  }

  async refreshAccessToken(refreshToken) {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Microsoft token refresh error:', error);
      throw new Error('Failed to refresh Microsoft access token');
    }

    const tokens = await response.json();
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refreshToken,
      expires_in: tokens.expires_in,
      expiry_date: Date.now() + (tokens.expires_in * 1000),
    };
  }

  async getUserInfo(accessToken) {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error('Failed to get user information from Microsoft');
    }

    const data = await response.json();
    return {
      email: data.mail || data.userPrincipalName,
      name: data.displayName,
    };
  }

  async _getValidToken(connection) {
    // Check if token is expired (with 5 min buffer)
    const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
    if (Date.now() < expiresAt - 300000) {
      return connection.access_token;
    }

    // Token expired, refresh it
    if (!connection.refresh_token) {
      throw new Error('No refresh token available. Please reconnect your Microsoft account.');
    }

    const newTokens = await this.refreshAccessToken(connection.refresh_token);
    
    // Update tokens in the database (caller should handle this, but we return new tokens)
    connection._newTokens = newTokens;
    return newTokens.access_token;
  }

  async listEvents(connection, timeMin, timeMax) {
    if (!this.clientId) throw new Error('Microsoft Calendar OAuth not configured');

    const accessToken = await this._getValidToken(connection);

    const params = new URLSearchParams({
      startDateTime: timeMin,
      endDateTime: timeMax,
      $orderby: 'start/dateTime',
      $top: '200',
    });

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/calendarview?${params.toString()}`, {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Microsoft Graph calendar error:', error);
      throw new Error('Failed to fetch events from Microsoft Calendar');
    }

    const data = await response.json();
    const events = data.value || [];

    // Map to the same format as Google Calendar events
    return events.map(event => ({
      id: event.id,
      summary: event.subject,
      description: event.bodyPreview || '',
      location: event.location?.displayName || '',
      start: {
        dateTime: event.start?.dateTime ? new Date(event.start.dateTime + 'Z').toISOString() : null,
        date: event.isAllDay ? event.start?.dateTime?.split('T')[0] : null,
      },
      end: {
        dateTime: event.end?.dateTime ? new Date(event.end.dateTime + 'Z').toISOString() : null,
      },
    }));
  }
}

module.exports = new MicrosoftCalendarOAuthService();
