
class MicrosoftMailOAuthService {
  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID;
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    this.redirectUri = process.env.MICROSOFT_MAIL_REDIRECT_URI;
  }

  getAuthUrl(state = null) {
    const scopes = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/Mail.ReadWrite',
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/User.Read'
    ];

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      response_mode: 'query',
      prompt: 'consent',
    });

    if (state) params.set('state', state);

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code) {
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

    if (!response.ok) throw new Error('Failed to get user info from Microsoft');

    const data = await response.json();
    return {
      email: data.mail || data.userPrincipalName,
      name: data.displayName,
    };
  }
}

module.exports = new MicrosoftMailOAuthService();
