const multerConfig = require('../config/multer');

/**
 * Utility to get a multer upload middleware dynamically
 * @param {string} folder - Destination folder under uploads/
 * @param {number} sizeLimitInMB - Max file size in MB
 * @param {string} type - 'all', 'image', 'document', 'spreadsheet'
 * @returns {import('multer').Multer}
 */
const getUploader = (folder, sizeLimitInMB = 20, type = 'all') => {
  return multerConfig.upload(folder, sizeLimitInMB, type);
};

/**
 * Common uploaders for quick access
 */
const upload = {
  // Images (Profile, Cars, etc.)
  image: (folder = 'images') => getUploader(folder, 5, 'image'),
  
  // Documents (PDF, Doc, etc.)
  document: (folder = 'documents') => getUploader(folder, 20, 'document'),
  
  // Everything
  any: (folder = 'other') => getUploader(folder, 50, 'all'),
  
  // Specific for large files
  large: (folder = 'large') => getUploader(folder, 100, 'all')
};

module.exports = {
  getUploader,
  upload
};
