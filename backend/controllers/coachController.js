import { callGroqJSON } from '../config/groq.js';

// ── Level sentence config ─────────────────────────────────────────────────────

const LEVEL_CFG = {
  A1: { words: '4-6',  style: 'very simple present tense, basic vocabulary only' },
  A2: { words: '6-10', style: 'simple sentences, present and past tense, common phrases' },
  B1: { words: '8-14', style: 'varied tenses, conjunctions, subordinate clauses' },
  B2: { words: '12-18',style: 'complex structures, conditionals, idiomatic expressions' },
  C1: { words: '15-22',style: 'advanced syntax, nuanced vocabulary, varied sentence types' },
};

// ── Generate practice sentences ───────────────────────────────────────────────

export const generateSentences = async (req, res, next) => {
  try {
    const { level = 'B1', topic = 'daily life' } = req.body;
    const cfg = LEVEL_CFG[level] || LEVEL_CFG.B1;

    const parsed = await callGroqJSON(
      `You are a German language speaking coach. Generate practice sentences for pronunciation drills. Respond with valid JSON only.`,
      `Generate 8 German sentences for speaking practice at ${level} level on the topic "${topic}".

Each sentence:
- ${cfg.words} words long
- Style: ${cfg.style}
- Natural, conversational German a native speaker would actually say
- Gradually increasing difficulty within the set
- Include a pronunciation tip for any tricky sounds

Return ONLY this JSON:
{
  "sentences": [
    {
      "de": "German sentence here",
      "en": "English translation",
      "tip": "Optional: pronunciation tip about a specific sound, e.g. 'The ü sound: round lips as if saying oo, then say ee'"
    }
  ]
}

Generate exactly 8 sentence objects. Tips should focus on phonetics specific to each sentence.`,
      2000
    );

    if (!Array.isArray(parsed.sentences) || parsed.sentences.length < 3) {
      return res.status(500).json({ message: 'Failed to generate sentences. Please try again.' });
    }

    const sentences = parsed.sentences.slice(0, 8).map(s => ({
      de:  String(s.de  || '').trim(),
      en:  String(s.en  || '').trim(),
      tip: String(s.tip || '').trim(),
    })).filter(s => s.de && s.en);

    res.json({ sentences });
  } catch (err) { next(err); }
};

// ── Score pronunciation attempt ───────────────────────────────────────────────

export const scoreAttempt = async (req, res, next) => {
  try {
    const { target, transcript, level = 'B1' } = req.body;

    if (!target || !transcript) {
      return res.status(400).json({ message: 'Target and transcript are required.' });
    }

    // Normalise both strings for comparison
    const normalise = str => str
      .toLowerCase()
      .replace(/[.,!?;:'"„"«»]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const targetWords     = normalise(target).split(' ');
    const transcriptWords = normalise(transcript).split(' ');

    // Word-by-word comparison with fuzzy matching
    const wordResults = targetWords.map(tw => {
      // Exact match
      if (transcriptWords.includes(tw)) return { word: tw, status: 'correct' };

      // Close match (within 2 edit distance or starts with same 3 chars)
      const closeMatch = transcriptWords.find(uw => {
        if (Math.abs(uw.length - tw.length) > 3) return false;
        if (tw.length >= 3 && uw.startsWith(tw.slice(0, 3))) return true;
        return levenshtein(uw, tw) <= 2;
      });
      if (closeMatch) return { word: tw, status: 'close' };

      return { word: tw, status: 'wrong' };
    });

    // Check for extra missing words
    const correctCount = wordResults.filter(w => w.status === 'correct').length;
    const closeCount   = wordResults.filter(w => w.status === 'close').length;
    const total        = targetWords.length;

    const accuracyScore = Math.round(((correctCount + closeCount * 0.5) / total) * 100);

    // Fluency: based on word count ratio and order similarity
    const wordCountRatio = Math.min(1, transcriptWords.length / total);
    const fluencyScore   = Math.round(wordCountRatio * accuracyScore * 0.95 + accuracyScore * 0.05);

    const score = Math.round((accuracyScore * 0.6) + (fluencyScore * 0.4));

    // AI feedback
    const feedbackParsed = await callGroqJSON(
      `You are a German pronunciation coach. Give brief, encouraging feedback. Respond with valid JSON only.`,
      `A ${level} student tried to say:
Target:     "${target}"
They said:  "${transcript}"
Score: ${score}/100

Give 1-2 sentences of specific, constructive feedback in English. Focus on what they did well and one specific improvement.
Also give a short pronunciation tip targeting the hardest sound in this sentence.

Return JSON: { "feedback": "...", "tip": "..." }`,
      500
    );

    res.json({
      transcript,
      score:         Math.min(100, Math.max(0, score)),
      fluencyScore:  Math.min(100, Math.max(0, fluencyScore)),
      accuracyScore: Math.min(100, Math.max(0, accuracyScore)),
      wordResults,
      feedback:      feedbackParsed.feedback || 'Good effort! Keep practising.',
      tip:           feedbackParsed.tip       || '',
    });
  } catch (err) {
    console.error('[coach] score error:', err.message);
    next(err);
  }
};

// ── Levenshtein distance ──────────────────────────────────────────────────────

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}
