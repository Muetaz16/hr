import { Router } from 'express';
import { authenticateToken, authorizeRoles, authorizePermissions, authorizeAccess } from '../middleware/auth';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/userController';
import {
    getDepartments, createDepartment, updateDepartment, deleteDepartment,
    getGroups, createGroup, updateGroup, deleteGroup,
    getDivisions, createDivision, updateDivision, deleteDivision
} from '../controllers/orgController';
import {
    getAllDirectorates, createDirectorate, updateDirectorate, deleteDirectorate
} from '../controllers/directorateController';
import { getHats, createHat, updateHat, deleteHat } from '../controllers/functionalHatController';
import { PERMISSIONS, POSITIONS, POSITION_DEFAULTS } from '../utils/accessCatalog';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// Users (Admin only)
router.get('/users', authorizeAccess([], ['manage_users']), getUsers);
router.post('/users', authorizeAccess([], ['manage_users']), createUser);
router.put('/users/:id', authorizeAccess([], ['manage_users']), updateUser);
router.delete('/users/:id', authorizeAccess([], ['manage_users']), deleteUser);

// Access catalog — permission definitions + position default bundles. Lets the
// Access Management UI render toggles without duplicating the catalog by hand.
router.get('/access-catalog', authorizeAccess([], ['manage_users']), (_req, res) => {
    res.json({ permissions: PERMISSIONS, positions: POSITIONS, positionDefaults: POSITION_DEFAULTS });
});

// Functional hats (managed on the Access Management screen)
router.get('/functional-hats', authorizeAccess([], ['manage_users']), getHats);
router.post('/functional-hats', authorizeAccess([], ['manage_users']), createHat);
router.put('/functional-hats/:id', authorizeAccess([], ['manage_users']), updateHat);
router.delete('/functional-hats/:id', authorizeAccess([], ['manage_users']), deleteHat);

// Departments (Admin/HR only)
// Departments (Viewable by all staff)
router.get('/departments', authorizeRoles('SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_OFFICE', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'EMPLOYEE', 'GENERAL_MANAGER', 'CHAIRMAN'), getDepartments);
router.post('/departments', authorizeAccess(['HR_MANAGER'], ['manage_departments']), createDepartment);
router.put('/departments/:id', authorizeAccess(['HR_MANAGER'], ['manage_departments']), updateDepartment);
router.delete('/departments/:id', authorizeAccess(['HR_MANAGER'], ['manage_departments']), deleteDepartment);

// Groups (Admin/HR only)
router.get('/groups', getGroups);
router.post('/groups', authorizeAccess(['HR_MANAGER'], ['manage_groups']), createGroup);
router.put('/groups/:id', authorizeAccess(['HR_MANAGER'], ['manage_groups']), updateGroup);
router.delete('/groups/:id', authorizeAccess(['HR_MANAGER'], ['manage_groups']), deleteGroup);

// Divisions
router.get('/divisions', getDivisions);
router.post('/divisions', authorizeAccess(['HR_MANAGER'], ['manage_divisions']), createDivision);
router.put('/divisions/:id', authorizeAccess(['HR_MANAGER'], ['manage_divisions']), updateDivision);
router.delete('/divisions/:id', authorizeAccess(['HR_MANAGER'], ['manage_divisions']), deleteDivision);

// Directorates
router.get('/directorates', getAllDirectorates);
router.post('/directorates', authorizeAccess(['HR_MANAGER'], ['manage_directorates']), createDirectorate);
router.put('/directorates/:id', authorizeAccess(['HR_MANAGER'], ['manage_directorates']), updateDirectorate);
router.delete('/directorates/:id', authorizeAccess(['HR_MANAGER'], ['manage_directorates']), deleteDirectorate);

export default router;
