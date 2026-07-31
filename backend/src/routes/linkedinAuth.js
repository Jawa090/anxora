/**
 * LinkedIn OAuth Authentication & Job Posting Routes
 * 
 * Flow:
 * 1. Frontend redirects to LinkedIn OAuth consent screen
 * 2. User approves access
 * 3. LinkedIn redirects back with authorization code
 * 4. Backend exchanges code for access token
 * 5. Backend posts job using access token
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

/**
 * Callback route for LinkedIn OAuth
 * URL: /api/linkedin/auth/callback?code=XXX&state=YYY
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // User denied access
    if (error) {
      console.log('LinkedIn authorization denied:', error);
      return res.redirect('/recruitment/advertisements?error=linkedin_denied');
    }

    if (!code) {
      return res.status(400).json({ error: 'No authorization code received' });
    }

    // Step 1: Exchange authorization code for access token
    console.log('Exchanging LinkedIn authorization code for access token...');
    
    const tokenResponse = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      null,
      {
        params: {
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:4000/api/linkedin/auth/callback',
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;
    const expiresIn = tokenResponse.data.expires_in;

    console.log('✅ LinkedIn access token received:', accessToken.substring(0, 10) + '...');

    // Step 2: Get LinkedIn profile information (optional but useful)
    const profileResponse = await axios.get(
      'https://api.linkedin.com/v2/me',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    const profileId = profileResponse.data.id;
    console.log('LinkedIn Profile ID:', profileId);

    // Step 3: Store token in session/database for later use
    // TODO: Save token to database associated with current user
    // TODO: You'll need middleware to identify current user

    // For now, store in session
    if (req.session) {
      req.session.linkedinAccessToken = accessToken;
      req.session.linkedinTokenExpiry = Date.now() + (expiresIn * 1000);
      req.session.linkedinProfileId = profileId;
    }

    // Step 4: Try to post job (if job data is available)
    const jobPostTemplate = req.query.jobTemplate || null;
    
    if (jobPostTemplate) {
      try {
        await postJobToLinkedIn(jobPostTemplate, accessToken, profileId);
        console.log('Job successfully posted to LinkedIn');
      } catch (postError) {
        console.error('Error posting job to LinkedIn:', postError.message);
        // Don't fail - still return success even if posting fails
      }
    }

    // Redirect back to advertisement page with success message
    res.redirect('/recruitment/advertisements?status=linkedin_success');

  } catch (error) {
    console.error('LinkedIn OAuth error:', error.message);
    console.error('Error details:', error.response?.data || error);
    res.redirect('/recruitment/advertisements?error=linkedin_error&message=' + encodeURIComponent(error.message));
  }
});

/**
 * Post job to LinkedIn using access token
 * 
 * @param {string} jobTemplate - Formatted job post text
 * @param {string} accessToken - LinkedIn access token
 * @param {string} profileId - LinkedIn profile ID
 */
async function postJobToLinkedIn(jobTemplate, accessToken, profileId) {
  try {
    // Create the post
    const postResponse = await axios.post(
      'https://api.linkedin.com/v2/ugcPosts',
      {
        author: `urn:li:person:${profileId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.UGCContent': {
            shareContent: {
              shareCommentary: {
                text: jobTemplate
              },
              shareMediaCategory: 'NONE'
            }
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    console.log('Job posted to LinkedIn:', postResponse.data);
    return postResponse.data;

  } catch (error) {
    console.error('❌ Error posting to LinkedIn:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Refresh LinkedIn access token (if expired)
 * Tokens expire after 1 year, but it's good practice to refresh before expiry
 */
async function refreshLinkedInToken(refreshToken) {
  try {
    const response = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      null,
      {
        params: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET
        }
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Error refreshing LinkedIn token:', error.message);
    throw error;
  }
}

module.exports = router;
