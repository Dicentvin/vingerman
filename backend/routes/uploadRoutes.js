import express from 'express';
import {
  uploadMaterial as uploadCtrl, getMaterials, getMaterial, deleteMaterial,
} from '../controllers/uploadController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadMaterial } from '../config/cloudinary.js';

const router = express.Router();
router.use(protect);

router.post('/',      uploadMaterial.single('file'), uploadCtrl);
router.get('/',       getMaterials);
router.get('/:id',    getMaterial);
router.delete('/:id', deleteMaterial);

export default router;
