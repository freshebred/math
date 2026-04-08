require('dotenv').config();
const express = require('express');
const cors = require('cors');

const Groq = require('groq-sdk');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;




app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/mathnote', express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));


app.get('/', (req, res) => res.redirect('/mathnote'));

// Global Solve Rate Limiter — persisted to temp.json
// Shared across ALL users: 3 solves per 30 seconds
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 30 * 1000;
const RATE_LIMIT_FILE = path.join(__dirname, 'temp.json');

function readTimestamps() {
  try {
    const data = fs.readFileSync(RATE_LIMIT_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed.solveTimestamps) ? parsed.solveTimestamps : [];
  } catch {
    return [];
  }
}

function writeTimestamps(timestamps) {
  fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify({ solveTimestamps: timestamps }));
}

function globalSolveLimiter(req, res, next) {
  const now = Date.now();
  let timestamps = readTimestamps().filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000);
    console.log(`[RateLimit] Blocked — ${timestamps.length} solves in last 30s`);
    return res.status(429).json({
      error: 'Global rate limit reached. Too many solves — please wait a moment.',
      retryAfter
    });
  }

  timestamps.push(now);
  writeTimestamps(timestamps);
  next();
}




const groq = new Groq({ apiKey: process.env.GROQ_API });

const MODELS = [
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'groq/compound',
];


async function callGroq(messages, options = {}) {
  const { temperature = 0.3, jsonMode = false, models = MODELS } = options;

  let lastError = null;

  for (const model of models) {
    try {
      const requestOpts = {
        model,
        messages,
        temperature,
        max_tokens: 4096,
      };


      if (jsonMode) {
        requestOpts.response_format = { type: 'json_object' };
      }

      const response = await groq.chat.completions.create(requestOpts);
      const content = response.choices[0]?.message?.content || '';
      console.log(`[Groq] Success with model: ${model}`);
      return content;
    } catch (err) {
      lastError = err;
      const status = err?.status || err?.statusCode || err?.error?.status;
      console.warn(`[Groq] Model ${model} failed (status: ${status}): ${err.message}`);


      if (status === 429 || (status >= 500 && status < 600)) {
        console.log(`[Groq] Falling back to next model...`);
        continue;
      }


      throw err;
    }
  }


  throw lastError || new Error('All models failed');
}


async function callGroqJSON(messages, temperature = 0.3) {
  const raw = await callGroq(messages, { temperature, jsonMode: true });


  try {
    return JSON.parse(raw);
  } catch {

    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error('Failed to parse AI response as JSON');
  }
}




function buildSolverSystemPrompt(lang, classLevel) {
  const langInstruction = lang === 'vi'
    ? 'Respond entirely in Vietnamese. Use Vietnamese mathematical terminology.'
    : 'Respond entirely in English.';

  return `You are an expert math tutor. ${langInstruction}
The student is at the level: ${classLevel || 'General'}.

When solving a math problem, you MUST:
1. Break the solution into clear, numbered steps. Use as many or as few steps as the problem NATURALLY requires.
2. For EACH step, explain WHY you are doing it and HOW it works.
3. Show all intermediate work clearly.
4. Use LaTeX notation for all math expressions.
5. Provide animation metadata for visual steps (e.g., adding to both sides).

CRITICAL MATH FORMATTING RULE:
Whenever you write ANY mathematical expression or formula (inline or block), you MUST wrap it with the markers #LATEX and #!LATEX.
Examples:
- "We solve for #LATEX x = 5 #!LATEX" (CORRECT)
- "The quadratic formula is #LATEX x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} #!LATEX" (CORRECT)
- "We solve for x = 5" (INCORRECT - missing markers)
- "We solve for $x = 5$" (INCORRECT - do NOT use $ signs)
The "math", "result", and "finalAnswer" fields should contain ONLY the LaTeX expression itself (no #LATEX markers needed for those since they are pure math fields).
The "explanation" and "summary" fields MUST use #LATEX...#!LATEX for any math within text.

You MUST respond with a JSON object in this exact format:
{
  "steps": [
    {
      "title": "Short title for this step",
      "explanation": "Why we do this step. Use #LATEX x + 2 = 5 #!LATEX for any math.",
      "math": "x + 2 = 5",
      "result": "x = 3",
      "animation": {
        "type": "none | add_both_sides | subtract_both_sides | multiply_both_sides | divide_both_sides | square_both_sides | root_both_sides | simplify | expand | factor",
        "value": "The value being operated with (e.g. '5', 'x', '/2'). Empty if not applicable.",
        "latex": "LaTeX to display for the operation (e.g. '{\\color{red}+5}')",
        "text": "Short instruction for the animation (e.g. 'Add 5 to both sides')"
      }
    }
  ],
  "finalAnswer": "x = 3",
  "summary": "A brief plain-language summary. Use #LATEX x = 3 #!LATEX for any math."
}

RULES:
- The "steps" array must have as many entries as the problem needs.
- All LaTeX backslashes must be properly escaped for JSON (use \\\\ instead of \\).
- ALWAYS use #LATEX ... #!LATEX to wrap math in text fields (explanation, summary, title). NEVER use $ signs for math delimiters.
- The "math", "result", and "finalAnswer" fields contain pure LaTeX only (no markers needed).
- The 'math' field should be the starting state of the step, and 'result' is the ending state.
- Do NOT include any text outside the JSON object.`;
}


app.post('/mathnote/api/solve', globalSolveLimiter, async (req, res) => {
  try {
    const { problem, classLevel, lang, history } = req.body;
    if (!problem) return res.status(400).json({ error: 'No problem provided' });

    const systemPrompt = buildSolverSystemPrompt(lang, classLevel);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []),
      { role: 'user', content: `Solve this math problem step by step:\n${problem}` }
    ];

    const parsed = await callGroqJSON(messages);
    console.log('Parsed AI response:', JSON.stringify(parsed).substring(0, 500));


    const solution = {
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      finalAnswer: parsed.finalAnswer || parsed.final_answer || '',
      summary: parsed.summary || ''
    };

    res.json({ solution, rawResponse: JSON.stringify(parsed) });
  } catch (err) {
    console.error('Solve error:', err);
    res.status(500).json({ error: 'Failed to solve problem', details: err.message });
  }
});


app.post('/mathnote/api/animate', async (req, res) => {
  try {
    const { problem, steps, lang } = req.body;
    if (!steps || !Array.isArray(steps)) return res.status(400).json({ error: 'No steps provided' });

    const langInstruction = lang === 'vi'
      ? 'Respond entirely in Vietnamese.'
      : 'Respond entirely in English.';

    const systemPrompt = `You are an animation annotator for a math step-by-step solver. ${langInstruction}
You will receive the already-solved steps of a math problem.
Your ONLY job is to decide what visual animation each step should show.
Do NOT re-solve the problem. Do NOT change any math, equations, or explanation text.

For each step, output ONLY the "animation" object — nothing else per step.

For each step, determine the operation happening (adding to both sides, dividing, simplifying, etc.).
ALMOST EVERY STEP SHOULD HAVE A MEANINGFUL ANIMATION TYPE.
Only use "none" if the step is purely descriptive with zero mathematical change.
If unsure, use "simplify" or "combine_like_terms".

COLOR MARKERS for the "latex" field:
To highlight what's being done, wrap the key action in a color marker:
  Red:    #COLOR-RED   content   #!COLOR-RED
  Blue:   #COLOR-BLUE  content   #!COLOR-BLUE
  Green:  #COLOR-GREEN content   #!COLOR-GREEN
  Orange: #COLOR-ORANGE content  #!COLOR-ORANGE
  Purple: #COLOR-PURPLE content  #!COLOR-PURPLE

Examples:
  "+5 to both sides" → "#COLOR-RED +5 #!COLOR-RED"
  "divide by 2"      → "#COLOR-BLUE \\div 2 #!COLOR-BLUE"
  "subtract 3x"      → "#COLOR-RED -3x #!COLOR-RED"
  "multiply by 1/2"  → "#COLOR-GREEN \\times \\frac{1}{2} #!COLOR-GREEN"

NEVER use raw \\color or \\textcolor. ONLY use the #COLOR-X markers.

Return a JSON object with a "steps" array, one entry per input step, each containing ONLY the "animation" field:
{
  "steps": [
    { "animation": { "type": "add_both_sides", "value": "5", "latex": "#COLOR-RED +5 #!COLOR-RED", "text": "Add 5 to both sides" } },
    { "animation": { "type": "divide_both_sides", "value": "2", "latex": "#COLOR-BLUE \\div 2 #!COLOR-BLUE", "text": "Divide both sides by 2" } }
  ]
}

Animation types: none | add_both_sides | subtract_both_sides | multiply_both_sides | divide_both_sides | square_both_sides | root_both_sides | simplify | expand | factor | combine_like_terms`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Problem: ${problem}\n\nSteps:\n${JSON.stringify(steps)}` }
    ];

    const parsed = await callGroqJSON(messages);

    // ALWAYS use original steps as the source of truth for math content.
    // Only extract the `animation` field from the AI response by index.
    // This guarantees the AI can never replace or alter the actual equations.
    const aiSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
    const merged = steps.map((s, i) => ({
      ...s,
      animation: aiSteps[i]?.animation || { type: 'none', value: '', latex: '', text: '' }
    }));
    res.json({ steps: merged });

  } catch (err) {
    console.error('Animate API error:', err);
    res.status(500).json({ error: 'Failed to generate animations', details: err.message });
  }
});


app.post('/mathnote/api/ask_step', async (req, res) => {
  try {
    const { step, problem, question, lang, stepNumber, totalSteps, slideType } = req.body;

    const langInstruction = lang === 'vi'
      ? 'Respond in Vietnamese.'
      : 'Respond in English.';


    const stepLabel = stepNumber && totalSteps
      ? `Step ${stepNumber} of ${totalSteps}${step?.title ? ` — "${step.title}"` : ''}`
      : (step?.title || 'the current step');

    const slideContext = slideType === 'action'
      ? `The student is currently viewing the operation/action being applied in this step.`
      : slideType === 'equation'
      ? `The student is currently viewing the equation state for this step.`
      : `The student is currently viewing the result of this step.`;

    const systemPrompt = `You are a helpful math tutor. ${langInstruction}
The student is solving: ${problem || 'a math problem'}

They are currently on ${stepLabel}.
${slideContext}

Step details:
- Title: ${step?.title || 'N/A'}
- Explanation: ${step?.explanation || 'N/A'}
- Math: ${step?.math || 'N/A'}
- Result: ${step?.result || 'N/A'}

Answer the student's question about THIS specific step concisely (1–2 sentences max). Reference the step context directly in your answer so the student knows you understand where they are.
CRITICAL: When writing ANY math expression, wrap it with #LATEX and #!LATEX markers. Example: "In this step, we get #LATEX x = 5 #!LATEX by dividing both sides by 2." NEVER use $ signs for math.`;

    const response = await callGroq([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ]);

    res.json({ answer: response });

  } catch (err) {
    console.error('Ask Step Error:', err);
    res.status(500).json({ error: 'Failed to answer question' });
  }
});


app.post('/mathnote/api/verify', async (req, res) => {
  try {
    const { problem, solution, lang } = req.body;

    const langInstruction = lang === 'vi'
      ? 'Respond entirely in Vietnamese.'
      : 'Respond entirely in English.';

    const messages = [
      {
        role: 'system',
        content: `You are a math verification expert. ${langInstruction}
Your job is to carefully check if a given solution to a math problem is correct.
Go through each step and verify the logic and calculations.

Respond in valid JSON format:
{
  "isCorrect": true/false,
  "confidence": "high/medium/low",
  "issues": ["list of any issues found"],
  "correctedAnswer": "the correct answer if the original is wrong (in LaTeX)",
  "explanation": "brief explanation of your verification"
}

Do NOT include any text outside the JSON object. Do NOT wrap the JSON in markdown code blocks.`
      },
      {
        role: 'user',
        content: `Problem: ${problem}\n\nProposed Solution:\n${JSON.stringify(solution)}\n\nPlease verify if this solution is correct.`
      }
    ];

    const parsed = await callGroqJSON(messages, 0.1);

    res.json({ verification: parsed });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Failed to verify solution', details: err.message });
  }
});


app.post('/mathnote/api/explain', async (req, res) => {
  try {
    const { step, history, lang, classLevel } = req.body;

    const langInstruction = lang === 'vi'
      ? 'Respond entirely in Vietnamese. Use simple Vietnamese.'
      : 'Respond entirely in English. Use simple, clear language.';

    const messages = [
      {
        role: 'system',
        content: `You are a patient math tutor explaining a concept to a ${classLevel || 'general'} level student. ${langInstruction}
Explain the given step in the simplest possible terms. Use analogies and examples if helpful.
CRITICAL: When writing ANY math expression, wrap it with #LATEX and #!LATEX markers. Example: "We subtract #LATEX 3 #!LATEX from both sides to get #LATEX x = 5 #!LATEX". NEVER use $ signs for math.
Keep it concise but thorough.`
      },
      ...(history || []),
      {
        role: 'user',
        content: `Please explain this step in simple terms so I can understand:\n\n${JSON.stringify(step)}`
      }
    ];

    const result = await callGroq(messages);
    res.json({ explanation: result });
  } catch (err) {
    console.error('Explain error:', err);
    res.status(500).json({ error: 'Failed to explain step', details: err.message });
  }
});




app.post('/mathnote/api/graph-solve', globalSolveLimiter, async (req, res) => {
  try {
    const { equation, points, degree, question, graphContext, lang, classLevel } = req.body;

    const langInstruction = lang === 'vi'
      ? 'Respond entirely in Vietnamese.'
      : 'Respond entirely in English.';

    let problemText = '';


    if (graphContext) {
      problemText += `Current graph state:\n${graphContext}\n\n`;
    }


    if (question) {
      problemText += `User's question: ${question}`;
    } else if (equation) {
      problemText += `Analyze this equation for graphing: ${equation}
Find key features like intercepts, vertex/critical points, domain, range, asymptotes if applicable.`;
    } else if (points && points.length > 0) {
      const pointsStr = points.map(p => `(${p.x}, ${p.y})`).join(', ');
      problemText += `Given these points: ${pointsStr}
The polynomial degree is ${degree || 'to be determined'}.
Find the equation that fits these points and analyze its key features.`;
    } else {
      return res.status(400).json({ error: 'No equation, points, or question provided' });
    }

    const systemPrompt = buildSolverSystemPrompt(lang, classLevel);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: problemText }
    ];

    const parsed = await callGroqJSON(messages);


    const graphAnalysis = {
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      finalAnswer: parsed.finalAnswer || parsed.final_answer || '',
      summary: parsed.summary || ''
    };

    res.json({ graphAnalysis });
  } catch (err) {
    console.error('Graph-solve error:', err);
    res.status(500).json({ error: 'Failed to analyze graph', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Nom's Calculator server running on http://localhost:${PORT}/mathnote`);
});
