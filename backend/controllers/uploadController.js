import Material from '../models/Material.js';
import { cloudinary } from '../config/cloudinary.js';

export const uploadMaterial = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const { originalname, size, path: url, filename } = req.file;
    const ext = originalname.split('.').pop().toLowerCase();

    const material = await Material.create({
      userId:             req.userId,
      title:              req.body.title || originalname.replace(/\.[^/.]+$/, ''),
      originalName:       originalname,
      fileType:           ext,
      cloudinaryUrl:      url,
      cloudinaryPublicId: filename,
      fileSize:           size,
    });

    res.status(201).json({ message: 'File uploaded successfully', material });
  } catch (err) { next(err); }
};

export const getMaterials = async (req, res, next) => {
  try {
    const materials = await Material.find({ userId: req.userId })
      .select('title originalName fileType cloudinaryUrl fileSize createdAt')
      .sort({ createdAt: -1 });
    res.json({ materials });
  } catch (err) { next(err); }
};

export const getMaterial = async (req, res, next) => {
  try {
    const material = await Material.findOne({ _id: req.params.id, userId: req.userId });
    if (!material) return res.status(404).json({ message: 'Material not found' });
    res.json({ material });
  } catch (err) { next(err); }
};

export const deleteMaterial = async (req, res, next) => {
  try {
    const material = await Material.findOne({ _id: req.params.id, userId: req.userId });
    if (!material) return res.status(404).json({ message: 'Material not found' });

    if (material.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(material.cloudinaryPublicId, { resource_type: 'raw' });
    }

    await material.deleteOne();
    res.json({ message: 'Material deleted successfully' });
  } catch (err) { next(err); }
};
