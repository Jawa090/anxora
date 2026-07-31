const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const calendarController = require('../../controllers/collaboration/calendarController');

// OAuth callback routes MUST be public because the providers redirect the browser here
// without auth headers. We use the 'state' parameter to identify the user.
router.get('/auth/google/callback', calendarController.googleCallback);
router.get('/auth/microsoft/callback', calendarController.microsoftCallback);
router.get('/:id/ics', calendarController.getEventIcs);

router.use(auth, requireOrg);

router.get('/', calendarController.getEvents);
router.get('/auth/google', calendarController.getGoogleAuthUrl);
router.get('/auth/microsoft', calendarController.getMicrosoftAuthUrl);
router.get('/connections', calendarController.getConnections);
router.delete('/connections/:id', calendarController.disconnect);
router.post('/sync/:provider', calendarController.syncEvents);
router.post('/auth/icloud', calendarController.connectICloud);
router.get('/:id', calendarController.getById);
router.post('/', calendarController.create);
router.put('/:id', calendarController.update);
router.delete('/:id', calendarController.remove);

module.exports = router;
