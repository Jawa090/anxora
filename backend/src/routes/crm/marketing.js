const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const marketingController = require('../../controllers/crm/marketingController');

router.use(auth, requireOrg);

// Dashboard
router.get('/dashboard', marketingController.getDashboardStats);

// Email Campaigns (New Spec Table)
router.get('/email-campaigns', marketingController.getEmailCampaigns);
router.post('/email-campaigns', marketingController.createEmailCampaign);
router.get('/email-campaigns/:id', marketingController.getEmailCampaignById);
router.put('/email-campaigns/:id', marketingController.updateEmailCampaign);
router.delete('/email-campaigns/:id', marketingController.deleteEmailCampaign);

// Email Templates
router.get('/email-templates', marketingController.getEmailTemplates);
router.post('/email-templates', marketingController.createEmailTemplate);
router.put('/email-templates/:id', marketingController.updateEmailTemplate);
router.delete('/email-templates/:id', marketingController.deleteEmailTemplate);

// Campaign Audiences
router.get('/email-campaigns/:campaignId/audiences', marketingController.getCampaignAudiences);
router.post('/email-campaigns/:campaignId/audiences', marketingController.addCampaignAudience);
router.delete('/email-campaigns/:campaignId/audiences/:audienceId', marketingController.removeCampaignAudience);

// Legacy Campaigns
router.get('/campaigns', marketingController.getCampaigns);
router.post('/campaigns', marketingController.createCampaign);
router.put('/campaigns/:id', marketingController.updateCampaign);
router.delete('/campaigns/:id', marketingController.deleteCampaign);


// Lists
router.get('/lists', marketingController.getLists);
router.post('/lists', marketingController.createList);
router.put('/lists/:id', marketingController.updateList);
router.post('/lists/:id/duplicate', marketingController.duplicateList);
router.delete('/lists/:id', marketingController.deleteList);
router.get('/lists/:listId/members', marketingController.getListMembers);
router.post('/lists/:listId/members', marketingController.addListMembers);
router.get('/lists/:listId/export', marketingController.exportListMembers);

// Forms
router.get('/forms', marketingController.getForms);
router.post('/forms', marketingController.createForm);
router.put('/forms/:id', marketingController.updateForm);
router.post('/forms/:id/duplicate', marketingController.duplicateForm);
router.delete('/forms/:id', marketingController.deleteForm);
router.get('/forms/:id/submissions', marketingController.getFormSubmissions);

// Sequences
router.get('/sequences', marketingController.getSequences);
router.post('/sequences', marketingController.createSequence);
router.put('/sequences/:id', marketingController.updateSequence);
router.post('/sequences/:id/duplicate', marketingController.duplicateSequence);
router.delete('/sequences/:id', marketingController.deleteSequence);
router.get('/sequences/:id/enrollments', marketingController.getSequenceEnrollments);
router.post('/sequences/:id/enroll', marketingController.enrollContact);

// Analytics
router.get('/analytics', marketingController.getAnalytics);

// Email Sending
router.post('/campaigns/:id/send', marketingController.sendCampaign);
router.post('/campaigns/test-email', marketingController.sendTestEmail);
router.post('/campaigns/track-event', marketingController.trackEmailEvent);
router.get('/campaigns/:campaignId/recipients', marketingController.getCampaignRecipients);
router.get('/email/verify-config', marketingController.verifyEmailConfig);

module.exports = router;
