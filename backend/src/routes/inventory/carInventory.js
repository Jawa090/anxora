const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const multerConfig = require('../../config/multer');
const {
  getAllCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
  getCarStats,
  uploadCarImages
} = require('../../controllers/inventory/carInventoryController');

// All routes require authentication
router.use(auth);

// Statistics
router.get('/stats', getCarStats);

// Image upload
router.post('/:id/images', multerConfig.carImages.array('images', 10), uploadCarImages);

// CRUD operations
router.get('/', getAllCars);
router.get('/:id', getCarById);
router.post('/', createCar);
router.put('/:id', updateCar);
router.delete('/:id', deleteCar);

module.exports = router;
