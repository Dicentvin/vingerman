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

export const getReadableChunks = async (req, res, next) => {
  try {
    const material = await Material.findOne({ _id: req.params.id, userId: req.userId });
    if (!material) return res.status(404).json({ message: 'Material not found' });

    const { callGroqJSON } = await import('../config/groq.js');

    // If we have extracted text, chunk it. Otherwise generate content from title.
    const sourceText = material.extractedText
      ? material.extractedText.substring(0, 4000)
      : `Title: ${material.title}. File type: ${material.fileType}.`;

    const parsed = await callGroqJSON(
      `You are a German language reading coach. You ONLY respond with valid JSON.`,
      `Take this material and prepare it as a read-aloud lesson for a German learner.

Material: """
${sourceText}
"""

If the material is in German or contains German, use it directly.
If it's in English or is a title only, create a short German educational passage (8-10 sentences) about the topic.

Split the content into chunks of EXACTLY 4-5 sentences each (max 6 chunks total).
Each chunk should read naturally as a paragraph.

Return JSON:
{
  "title": "lesson title",
  "language": "de" or "en",
  "chunks": [
    {
      "id": 1,
      "text": "The 4-5 sentence paragraph text",
      "translation": "Full English translation of this chunk"
    }
  ]
}`
    );

    res.json({
      materialId: material._id,
      title: parsed.title || material.title,
      language: parsed.language || 'de',
      chunks: parsed.chunks || [],
    });
  } catch (err) { next(err); }
};

export const evaluateReading = async (req, res, next) => {
  try {
    const { originalText, spokenText, chunkId } = req.body;
    if (!originalText || !spokenText)
      return res.status(400).json({ message: 'originalText and spokenText required' });

    const { callGroq } = await import('../config/groq.js');

    const feedback = await callGroq(
      `You are a German reading coach evaluating a learner's oral reading.
Be encouraging but precise. The speech was captured via speech-to-text which may distort German phonemes.`,
      `Original text: "${originalText}"
Student's speech-to-text: "${spokenText}"

Evaluate the reading and respond with EXACTLY this format:
SCORE: X/10
ACCURACY: X%
FEEDBACK: [2-3 sentences: what they read well, specific mispronunciations or missing words, one tip]
CORRECTION: [If score < 8, write the first sentence they should re-read. If score >= 8, write "Great job!"]`,
      600
    );

    const scoreMatch   = feedback.match(/SCORE:\s*(\d+)/i);
    const accuracyMatch = feedback.match(/ACCURACY:\s*(\d+)/i);
    const feedbackMatch = feedback.match(/FEEDBACK:\s*(.+?)(?=CORRECTION:|$)/is);
    const correctionMatch = feedback.match(/CORRECTION:\s*(.+)/is);

    res.json({
      score:      scoreMatch    ? parseInt(scoreMatch[1])    : 7,
      accuracy:   accuracyMatch ? parseInt(accuracyMatch[1]) : 70,
      feedback:   feedbackMatch ? feedbackMatch[1].trim()    : feedback,
      correction: correctionMatch ? correctionMatch[1].trim() : '',
      chunkId,
    });
  } catch (err) { next(err); }
};
