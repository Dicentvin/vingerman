// config/groq.js
import Groq from 'groq-sdk';

const MODEL = 'llama-3.3-70b-versatile';

// ✅ Create client lazily so dotenv has already run
const getGroq = () => new Groq({ apiKey: process.env.GROQ_API_KEY });

export const callGroq = async (systemPrompt, userPrompt, maxTokens = 1500) => {
  const completion = await getGroq().chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature: 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error('Groq returned an empty response');
  return text;
};

export const callGroqJSON = async (systemPrompt, userPrompt) => {
  const completion = await getGroq().chat.completions.create({
    model: MODEL,
    max_tokens: 1500,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt + '\nYou MUST respond with valid JSON only.' },
      { role: 'user',   content: userPrompt },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Groq returned empty JSON response');
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  }
};

export default getGroq;