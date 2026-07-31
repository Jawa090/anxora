const express = require('express');
const router = express.Router();
const candidateController = require('../../controllers/recruitment/candidateController');
const { auth } = require('../../middleware/auth');
const multerConfig = require('../../config/multer');

// Public routes (no auth required) - MUST be before auth middleware
router.get('/public/form/:token', candidateController.getCandidateByToken);
router.post('/public/form/:token/submit', candidateController.submitPublicApplicationForm);

// All other routes require authentication
router.use(auth);

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Candidate routes working', user: req.user });
});

// Candidate routes
router.post('/', candidateController.createCandidate);
router.post('/upload-cv', multerConfig.cvs.single('cv'), candidateController.uploadCV);
router.get('/', candidateController.getCandidates);
router.get('/:id/cv', (req, res, next) => {
  console.log('CV route hit! ID:', req.params.id);
  candidateController.downloadCV(req, res, next);
});
router.get('/:id', candidateController.getCandidateById);
router.put('/:id/status', candidateController.updateCandidateStatus);
router.post('/:id/shortlist', candidateController.shortlistCandidate);
router.post('/:id/screen', candidateController.screenCandidate);
router.post('/:id/send-interview-email', candidateController.sendInterviewEmail);
router.post('/:id/generate-form', candidateController.generateApplicationForm);
router.delete('/:id', candidateController.deleteCandidate);

module.exports = router;
