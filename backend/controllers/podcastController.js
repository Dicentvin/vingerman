import { callGroq } from '../config/groq.js';
import Material from '../models/Material.js';
import PodcastScript from '../models/PodcastScript.js';
import User from '../models/User.js';

export const generatePodcast = async (req, res, next) => {
  try {
    const { materialId, style = 'educational', customText } = req.body;
    let content = customText || '';

    if (materialId) {
      const material = await Material.findOne({ _id: materialId, userId: req.userId });
      if (!material) return res.status(404).json({ message: 'Material not found' });
      content = material.extractedText || `Learning material: ${material.title}`;
    }

    if (!content) return res.status(400).json({ message: 'No content provided' });

    const script = await callGroq(
      `You are an engaging German language podcast host creating ${style} episodes for learners.
Always include: German words/phrases in quotes, pronunciation guides in brackets like [GOO-ten],
English translations, example dialogues, grammar tips, and cultural notes.
Make it natural, educational and fun to listen to.`,
      `Create a ${style} German learning podcast episode based on this material:

${content.substring(0, 2000)}

Write 500-700 words structured as:
- Warm intro greeting listeners
- 5-6 key vocabulary words with pronunciation and usage
- A short example dialogue (2-3 exchanges)
- One grammar tip
- Cultural note about German-speaking countries
- Outro with encouragement

Make it sound like a real podcast, not a list.`,
      1500
    );

    if (materialId) {
      await PodcastScript.create({ userId: req.userId, materialId, style, script });
    }

    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 20 } });

    res.json({ script, style });
  } catch (err) { next(err); }
};

export const getPodcastHistory = async (req, res, next) => {
  try {
    const history = await PodcastScript.find({ userId: req.userId })
      .populate('materialId', 'title')
      .sort({ createdAt: -1 })
      .limit(10);
    res.json({ history });
  } catch (err) { next(err); }
};
