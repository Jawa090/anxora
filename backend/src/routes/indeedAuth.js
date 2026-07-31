/**
 * Indeed OAuth Authentication & Job Posting Routes
 * 
 * Flow:
 * 1. Frontend redirects to Indeed OAuth consent screen
 * 2. User approves access
 * 3. Indeed redirects back with authorization code
 * 4. Backend exchanges code for access token
 * 5. Backend posts job using access token
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

/**
 * Callback route for Indeed OAuth
 * URL: /api/indeed/auth/callback?code=XXX&state=YYY
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // User denied access
    if (error) {
      console.log('Indeed authorization denied:', error);
      return res.redirect('/recruitment/advertisements?error=indeed_denied');
    }

    if (!code) {
      return res.status(400).json({ error: 'No authorization code received' });
    }

    // Step 1: Exchange authorization code for access token
    console.log('Exchanging Indeed authorization code for access token...');
    
    const tokenResponse = await axios.post(
      'https://secure.indeed.com/oauth/authorize',
      {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.INDEED_REDIRECT_URI || 'http://localhost:4000/api/indeed/auth/callback',
        client_id: process.env.INDEED_CLIENT_ID,
        client_secret: process.env.INDEED_CLIENT_SECRET
      }
    );

    const accessToken = tokenResponse.data.access_token;
    const expiresIn = tokenResponse.data.expires_in;

    console.log('Indeed access token received:', accessToken.substring(0, 10) + '...');

    // Step 2: Get company information (optional but useful)
    const companyResponse = await axios.get(
      'https://api.indeed.com/company',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    const companyId = companyResponse.data.id;
    console.log('Indeed Company ID:', companyId);

    // Step 3: Store token in session/database for later use
    // TODO: Save token to database associated with current user
    // TODO: You'll need middleware to identify current user

    // For now, store in session
    if (req.session) {
      req.session.indeedAccessToken = accessToken;
      req.session.indeedTokenExpiry = Date.now() + (expiresIn * 1000);
      req.session.indeedCompanyId = companyId;
    }

    // Step 4: Try to post job (if job data is available)
    const jobData = req.query.jobData || null;
    
    if (jobData) {
      try {
        await postJobToIndeed(JSON.parse(jobData), accessToken, companyId);
        console.log('Job successfully posted to Indeed');
      } catch (postError) {
        console.error('Error posting job to Indeed:', postError.message);
        // Don't fail - still return success even if posting fails
      }
    }

    // Redirect back to advertisement page with success message
    res.redirect('/recruitment/advertisements?status=indeed_success');

  } catch (error) {
    console.error('Indeed OAuth error:', error.message);
    console.error('Error details:', error.response?.data || error);
    res.redirect('/recruitment/advertisements?error=indeed_error&message=' + encodeURIComponent(error.message));
  }
});

/**
 * Post job to Indeed using access token
 * 
 * @param {object} jobData - Job details object
 * @param {string} accessToken - Indeed access token
 * @param {string} companyId - Indeed company ID
 */
async function postJobToIndeed(jobData, accessToken, companyId) {
  try {
    // Format job data for Indeed API
    const indeedJobData = {
      title: jobData.title,
      description: jobData.description,
      requirements: jobData.requirements,
      location: jobData.location,
      employmentType: mapEmploymentType(jobData.employmentType),
      experienceLevel: jobData.experienceLevel,
      salaryRange: jobData.salaryRange ? jobData.salaryRange : undefined,
      applicationDeadline: jobData.applicationDeadline,
      contactEmail: jobData.contactEmail,
      contactPhone: jobData.contactPhone
    };

    // Post job to Indeed
    const postResponse = await axios.post(
      `https://api.indeed.com/company/${companyId}/jobs`,
      indeedJobData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    console.log('Job posted to Indeed:', postResponse.data);
    return postResponse.data;

  } catch (error) {
    console.error('❌ Error posting to Indeed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Map employment type to Indeed format
 */
function mapEmploymentType(type) {
  const mapping = {
    'full-time': 'FULLTIME',
    'part-time': 'PARTTIME',
    'contract': 'CONTRACT',
    'internship': 'INTERN',
    'temporary': 'TEMPORARY'
  };
  return mapping[type] || 'FULLTIME';
}

/**
 * Refresh Indeed access token (if expired)
 */
async function refreshIndeedToken(refreshToken) {
  try {
    const response = await axios.post(
      'https://secure.indeed.com/oauth/authorize',
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.INDEED_CLIENT_ID,
        client_secret: process.env.INDEED_CLIENT_SECRET
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Error refreshing Indeed token:', error.message);
    throw error;
  }
}

module.exports = router;
