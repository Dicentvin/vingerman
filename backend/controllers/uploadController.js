import Material from '../models/Material.js';
import { cloudinary } from '../config/cloudinary.js';
import { extractTextFromMaterial } from '../utils/textExtractor.js';

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

    // Extract text in background and cache it — don't block the upload response
    extractTextFromMaterial(material)
      .then(async (text) => {
        if (text && text.length > 20) {
          await Material.findByIdAndUpdate(material._id, { extractedText: text });
        }
      })
      .catch(err => console.error('Background text extraction failed:', err.message));

    res.status(201).json({ message: 'File uploaded successfully', material });
  } catch (err) { next(err); }
};

export const getMaterials = async (req, res, next) => {
  try {
    const materials = await Material.find({ userId: req.userId })
      .select('title originalName fileType cloudinaryUrl fileSize extractedText createdAt')
      .sort({ createdAt: -1 });
    // Add a hasText flag so the frontend knows if reading is available
    const withFlags = materials.map(m => ({
      ...m.toObject(),
      hasText: !!(m.extractedText && m.extractedText.length > 50),
    }));
    res.json({ materials: withFlags });
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

/**
 * Re-extract text from a material (useful if initial extraction failed)
 */
export const reextractText = async (req, res, next) => {
  try {
    const material = await Material.findOne({ _id: req.params.id, userId: req.userId });
    if (!material) return res.status(404).json({ message: 'Material not found' });

    const text = await extractTextFromMaterial({ ...material.toObject(), extractedText: null });
    if (text && text.length > 20) {
      await Material.findByIdAndUpdate(material._id, { extractedText: text });
    }

    res.json({
      message: 'Text extracted successfully',
      preview: text.substring(0, 300),
      length: text.length,
    });
  } catch (err) { next(err); }
};
