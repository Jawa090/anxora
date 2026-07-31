const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const driveController = require('../../controllers/collaboration/driveController');
const driveIntegrationsController = require('../../controllers/collaboration/driveIntegrationsController');
const { getUploader } = require('../../utils/fileUpload');

// Configure multer for file uploads (100MB limit, any file type)
const upload = getUploader('drive', 100, 'all');

// Public route for OAuth callbacks
router.get('/oauth-callback', driveIntegrationsController.oauthCallback);

router.use(auth, requireOrg);

// Folders
router.get('/folders', driveController.getFolders);
router.post('/folders', driveController.createFolder);
router.post('/folders/:id/restore', driveController.restoreFolder);
router.delete('/folders/:id', driveController.deleteFolder);
router.delete('/folders/:id/permanent', driveController.permanentDeleteFolder);

// Files
router.get('/files', driveController.getFiles);
router.post('/files/upload', upload.single('file'), driveController.uploadFile);
router.delete('/files/:id', driveController.deleteFile);
router.post('/files/:id/restore', driveController.restoreFile);
router.delete('/files/:id/permanent', driveController.permanentDeleteFile);

// Activities
router.get('/activities', driveController.getRecentActivities);

// Bulk actions
router.post('/bulk/trash', driveController.bulkMoveToTrash);
router.post('/bulk/restore', driveController.bulkRestore);
router.post('/bulk/delete-permanent', driveController.bulkPermanentDelete);

module.exports = router;
