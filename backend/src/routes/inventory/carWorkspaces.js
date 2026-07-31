const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const {
  getAllWorkspaces,
  getWorkspaceById,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember
} = require('../../controllers/inventory/carWorkspaceController');

// All routes require authentication
router.use(auth);

// Workspace CRUD
router.get('/', getAllWorkspaces);
router.get('/:id', getWorkspaceById);
router.post('/', createWorkspace);
router.put('/:id', updateWorkspace);
router.delete('/:id', deleteWorkspace);

// Workspace members
router.get('/:id/members', getWorkspaceMembers);
router.post('/:id/members', addWorkspaceMember);
router.delete('/:id/members/:memberId', removeWorkspaceMember);

module.exports = router;
