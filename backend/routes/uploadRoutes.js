import express from 'express';
import {
  uploadMaterial as uploadCtrl, getMaterials, getMaterial, deleteMaterial, reextractText,
} from '../controllers/uploadController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadMaterial } from '../config/cloudinary.js';

const router = express.Router();
router.use(protect);

router.post('/',           uploadMaterial.single('file'), uploadCtrl);
router.get('/',            getMaterials);
router.get('/:id',         getMaterial);
router.post('/:id/extract', reextractText);
router.delete('/:id',      deleteMaterial);

export default router;
