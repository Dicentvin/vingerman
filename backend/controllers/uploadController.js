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

    // Extract text in background — don't block the upload response
    extractTextFromMaterial(material)
      .then(async (text) => {
        if (text && text.length > 20 && !text.startsWith('[')) {
          await Material.findByIdAndUpdate(material._id, { extractedText: text });
          console.log(`[upload] Text extracted for "${material.title}" — ${text.length} chars`);
        }
      })
      .catch(err => console.error('[upload] Background extraction failed:', err.message));

    res.status(201).json({ message: 'File uploaded successfully', material });
  } catch (err) { next(err); }
};

export const getMaterials = async (req, res, next) => {
  try {
    const materials = await Material.find({ userId: req.userId })
      .select('title originalName fileType cloudinaryUrl fileSize extractedText createdAt')
      .sort({ createdAt: -1 });

    const withFlags = materials.map(m => ({
      ...m.toObject(),
      // hasText: true only if extraction succeeded (not a failure message)
      hasText: !!(m.extractedText && m.extractedText.length > 50 && !m.extractedText.startsWith('[')),
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
      await cloudinary.uploader.destroy(material.cloudinaryPublicId, { resource_type: 'raw' })
        .catch(e => console.warn('[upload] Cloudinary delete warning:', e.message));
    }

    await material.deleteOne();
    res.json({ message: 'Material deleted successfully' });
  } catch (err) { next(err); }
};

/**
 * Force re-extract text — clears bad cached result and tries again.
 * Called via POST /api/upload/:id/extract
 */
export const reextractText = async (req, res, next) => {
  try {
    const material = await Material.findOne({ _id: req.params.id, userId: req.userId });
    if (!material) return res.status(404).json({ message: 'Material not found' });

    // Clear cached text so extractor doesn't short-circuit
    await Material.findByIdAndUpdate(material._id, { extractedText: '' });
    const freshMaterial = { ...material.toObject(), extractedText: '' };

    const text = await extractTextFromMaterial(freshMaterial);

    if (text && text.length > 20 && !text.startsWith('[')) {
      await Material.findByIdAndUpdate(material._id, { extractedText: text });
      res.json({
        success: true,
        message: 'Text extracted successfully',
        preview: text.substring(0, 400),
        length:  text.length,
      });
    } else {
      // Store the error message so we don't keep retrying
      await Material.findByIdAndUpdate(material._id, { extractedText: text });
      res.status(422).json({
        success: false,
        message: text || 'Could not extract text from this file.',
        hint:    'Try the "Paste Text" tab and paste your slide content manually.',
      });
    }
  } catch (err) { next(err); }
};
