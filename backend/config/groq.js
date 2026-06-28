import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = 'llama-3.3-70b-versatile';

export const callGroq = async (systemPrompt, userPrompt, maxTokens = 1500) => {
  const completion = await groq.chat.completions.create({
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

export const callGroqJSON = async (systemPrompt, userPrompt, maxTokens = 4000) => {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt + '\nYou MUST respond with valid JSON only.' },
      { role: 'user',   content: userPrompt },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Groq returned empty JSON response');

  // Strip markdown fences if present
  let text = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Try direct parse first
  try { return JSON.parse(text); } catch {}

  // Attempt to recover a truncated JSON object by closing open structures
  try {
    // Count open braces/brackets and close them
    let depth = 0;
    let inStr = false, escape = false;
    for (const ch of text) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{' || ch === '[') depth++;
      if (ch === '}' || ch === ']') depth--;
    }
    // Remove trailing incomplete key/value
    let fixed = text.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, '');
    // Close open structures
    const closers = [];
    let d2 = 0, in2 = false, esc2 = false;
    for (const ch of fixed) {
      if (esc2) { esc2 = false; continue; }
      if (ch === '\\') { esc2 = true; continue; }
      if (ch === '"') { in2 = !in2; continue; }
      if (in2) continue;
      if (ch === '{') closers.push('}');
      if (ch === '[') closers.push(']');
      if (ch === '}' || ch === ']') closers.pop();
    }
    fixed += closers.reverse().join('');
    return JSON.parse(fixed);
  } catch {
    console.error('[groq] JSON parse failed. Raw length:', raw.length, 'Finish reason:', completion.choices[0]?.finish_reason);
    throw new Error('AI response could not be parsed as JSON. Please try again.');
  }
};

export default groq;
