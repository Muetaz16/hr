import { Router } from 'express';
import { getAllSalaryStructures, getSalaryStructure } from '../controllers/salaryStructureController';

const router = Router();

router.get('/', getAllSalaryStructures);
router.get('/lookup', getSalaryStructure);

export default router;
