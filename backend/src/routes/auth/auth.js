const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const authController = require('../../controllers/auth/authController');
const multerConfig = require('../../config/multer');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/verify-invite/:token', authController.verifyInvite);
router.post('/accept-invite', authController.acceptInvite);
router.get('/profile', auth, authController.getProfile);
router.put('/profile', auth, authController.updateProfile);
router.post('/logout', auth, authController.logout);
router.post('/change-password', auth, authController.changePassword);
router.patch('/notification-settings', auth, authController.updateNotificationSettings);
router.post('/upload-avatar', auth, multerConfig.profiles.single('avatar'), authController.uploadAvatar);

module.exports = router;
