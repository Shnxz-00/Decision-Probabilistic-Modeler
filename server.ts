import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google GenAI SDK if the key is present
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} else {
  console.warn('GEMINI_API_KEY not found in environment variables. Gemini features will be inactive.');
}

// REST API Endpoints

/**
 * @api {post} /api/generate-decision-model Auto-generate a complete decision model from a prompt
 * @apiDescription Uses Gemini 3.1 Flash-Lite for ultra-fast generation of options, scenarios, probabilities, and utilities.
 */
app.post('/api/generate-decision-model', async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'Gemini AI service is not configured on the server.' });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Please provide a valid decision prompt.' });
  }

  const systemInstruction = `You are a world-class probabilistic strategist. Given a user's decision dilemma, build a complete decision tree structure.
Category MUST be one of: "career", "finance", "relationship", "health", "education", "general".
Provide 2-3 distinct, realistic options.
For each option, provide 2-3 mutually exclusive scenarios with realistic probabilities summing to 1.0 (or close) and utility scores from -100 (disaster) to +100 (ideal).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `Create a complete decision model for: "${prompt}"`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['title', 'description', 'category', 'options'],
          properties: {
            title: { type: Type.STRING, description: 'Clear, concise decision title.' },
            description: { type: Type.STRING, description: 'Summary of the decision context and key stakes.' },
            category: { type: Type.STRING, description: 'One of: career, finance, relationship, health, education, general.' },
            options: {
              type: Type.ARRAY,
              description: 'Array of choices/options.',
              items: {
                type: Type.OBJECT,
                required: ['title', 'scenarios'],
                properties: {
                  title: { type: Type.STRING, description: 'Option choice title.' },
                  scenarios: {
                    type: Type.ARRAY,
                    description: 'Outcome scenarios for this option.',
                    items: {
                      type: Type.OBJECT,
                      required: ['title', 'probability', 'utility'],
                      properties: {
                        title: { type: Type.STRING, description: 'Scenario outcome title.' },
                        probability: { type: Type.NUMBER, description: 'Probability decimal between 0.05 and 0.95.' },
                        utility: { type: Type.NUMBER, description: 'Utility score between -100 and +100.' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text || '{}');
    res.json(parsedData);
  } catch (error: any) {
    console.error('Error generating decision model:', error);
    res.status(500).json({ error: 'Failed to auto-generate decision model.', details: error.message });
  }
});

/**
 * @api {post} /api/analyze-decision Analyze a decision
 * @apiDescription Supports multi-tiered Gemini models: gemini-3.1-flash-lite (fast), gemini-3.5-flash (general), gemini-3.1-pro-preview (complex).
 */
app.post('/api/analyze-decision', async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'Gemini AI service is not configured on the server.' });
  }

  const { title, description, category, options, simulationResults, depth } = req.body;

  if (!title || !options || !Array.isArray(options)) {
    return res.status(400).json({ error: 'Missing required decision fields: title, options.' });
  }

  // Model selection based on requested task depth
  let selectedModel = 'gemini-3.5-flash'; // default general
  if (depth === 'fast') {
    selectedModel = 'gemini-3.1-flash-lite';
  } else if (depth === 'complex' || depth === 'deep') {
    selectedModel = 'gemini-3.1-pro-preview';
  }

  const prompt = `
You are an expert decision analyst and strategist specializing in Bayesian inference, expected value theory, and probabilistic modeling.
Analyze the following decision model and provide a comprehensive recommendation report.

---
DECISION TO BE MADE:
Title: ${title}
Description: ${description || 'No description provided.'}
Category: ${category}

OPTIONS & THEIR SCENARIOS:
${options.map((opt: any) => {
  return `Option: "${opt.title}"
  Scenarios:
  ${(opt.scenarios || []).map((sc: any) => `- "${sc.title}" with Probability ${Math.round(sc.probability * 100)}% and Utility Score ${sc.utility}/100`).join('\n  ')}`;
}).join('\n\n')}

MONTE CARLO SIMULATION RESULTS:
${(simulationResults || []).map((res: any) => {
  return `- Option "${res.optionTitle}": Expected Value = ${res.expectedValue}, StdDev (Volatility/Risk) = ${res.stdDev}, Risk of Regret (Utility < 0) = ${res.riskOfRegret}%, Prob of Great Outcome (Utility >= 50) = ${res.greatOutcomeProb}%`;
}).join('\n')}
---

Please format your response in professional Markdown and structure it as follows:

1. **Executive Summary**: A clear 2-3 sentence recommendation of the optimal choice based on both mathematical expected value and risk tolerance profiles.
2. **Quantitative Comparison**: A tabular comparison of the options' expected values, volatility (risk), and regret probability.
3. **Key Trade-offs**: Detail the critical risks and upside opportunities for each option. Explain what each choice "buys" the user in exchange for what sacrifices.
4. **Strategic Recommendations & Next Steps**: Actionable, structured recommendations (e.g., "To make Option A safer, find ways to mitigate the 'failure scenario' risk..."). Suggest specific information the user could gather to reduce uncertainty (Value of Information).

Keep the tone highly analytical, supportive, objective, and realistic. Use elegant display styling.
`;

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        temperature: 0.4,
      }
    });

    res.json({ report: response.text, modelUsed: selectedModel });
  } catch (error: any) {
    console.error('Error generating decision analysis:', error);
    // Graceful fallback to gemini-3.5-flash if gemini-3.1-pro-preview requires key fallback
    if (selectedModel !== 'gemini-3.5-flash') {
      try {
        const fallbackRes = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: { temperature: 0.4 }
        });
        return res.json({ report: fallbackRes.text, modelUsed: 'gemini-3.5-flash (fallback)' });
      } catch (fErr: any) {
        return res.status(500).json({ error: 'Failed to generate analysis.', details: fErr.message });
      }
    }
    res.status(500).json({ error: 'Failed to generate analysis from Gemini.', details: error.message });
  }
});

/**
 * @api {post} /api/suggest-scenarios Brainstorm scenarios for an option
 * @apiDescription Uses Gemini 3.1 Flash-Lite for quick scenario suggestions.
 */
app.post('/api/suggest-scenarios', async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'Gemini AI service is not configured.' });
  }

  const { decisionTitle, decisionDescription, optionTitle } = req.body;

  if (!decisionTitle || !optionTitle) {
    return res.status(400).json({ error: 'Missing decisionTitle or optionTitle.' });
  }

  const prompt = `
Context: The user is making a complex decision titled "${decisionTitle}" (${decisionDescription || 'no description'}).
Specifically, they are considering the option: "${optionTitle}".

Identify 3-4 highly plausible mutually exclusive or major independent scenarios/outcomes that could result from choosing "${optionTitle}".
For each scenario:
1. Provide a concise title.
2. Assign a realistic probability (expressed as a decimal between 0.0 and 1.0) based on typical life outcomes.
3. Assign a relative utility score between -100 (catastrophic outcome) and +100 (spectacular success).
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['scenarios'],
          properties: {
            scenarios: {
              type: Type.ARRAY,
              description: 'List of brainstormed scenarios/outcomes.',
              items: {
                type: Type.OBJECT,
                required: ['title', 'probability', 'utility'],
                properties: {
                  title: { type: Type.STRING, description: 'Concise title of the outcome scenario.' },
                  probability: { type: Type.NUMBER, description: 'Probability decimal between 0.05 and 0.95.' },
                  utility: { type: Type.NUMBER, description: 'Utility value between -100 and 100.' },
                }
              }
            }
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text || '{}');
    res.json(parsedData);
  } catch (error: any) {
    console.error('Error suggesting scenarios:', error);
    res.status(500).json({ error: 'Failed to brainstorm scenarios.', details: error.message });
  }
});

/**
 * @api {post} /api/pre-mortem-analysis Perform a Pre-Mortem analysis on a choice
 * @apiDescription Uses Gemini 3.5 Flash to project worst-case scenarios and risk mitigations.
 */
app.post('/api/pre-mortem-analysis', async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'Gemini AI service is not configured.' });
  }

  const { decisionTitle, optionTitle, scenarios } = req.body;

  const prompt = `
Imagine we are 3 years in the future. The user chose Option "${optionTitle}" for decision "${decisionTitle}", and it turned out to be a total failure.
Analyze why it failed, what hidden blind spots caused it, and 3 specific proactive steps the user can take RIGHT NOW to prevent this pre-mortem disaster.

Current scenarios modeled:
${(scenarios || []).map((s: any) => `- ${s.title} (prob: ${s.probability}, utility: ${s.utility})`).join('\n')}

Provide the response in Markdown with bullet points.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: { temperature: 0.5 }
    });

    res.json({ preMortem: response.text });
  } catch (error: any) {
    console.error('Pre-mortem error:', error);
    res.status(500).json({ error: 'Failed to generate pre-mortem analysis.', details: error.message });
  }
});

/**
 * @api {post} /api/decision-chat Interactive Decision Assistant Q&A
 * @apiDescription Uses Gemini 3.5 Flash for conversational guidance on the active decision model.
 */
app.post('/api/decision-chat', async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'Gemini AI service is not configured.' });
  }

  const { decisionTitle, options, userMessage, conversationHistory } = req.body;

  const systemInstruction = `You are a Bayesian Decision Science Assistant.
The user is currently analyzing the decision model: "${decisionTitle}".
Options modeled: ${JSON.stringify(options || [])}.

Answer user questions objectively, using decision theory concepts like expected value, opportunity cost, risk tolerance, and value of information.
Keep responses concise, friendly, and structured.`;

  try {
    const chat = ai.chats.create({
      model: 'gemini-3.5-flash',
      config: {
        systemInstruction,
        temperature: 0.3
      }
    });

    // Replay conversation history if present
    if (Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        if (msg.role === 'user') {
          await chat.sendMessage({ message: msg.content });
        }
      }
    }

    const response = await chat.sendMessage({ message: userMessage });
    res.json({ reply: response.text });
  } catch (error: any) {
    console.error('Decision chat error:', error);
    res.status(500).json({ error: 'Failed to chat with Decision Assistant.', details: error.message });
  }
});

/**
 * @api {post} /api/cognitive-audit Analyze decision model for cognitive biases and missing scenarios
 * @apiDescription Uses Gemini 3.5 Flash to evaluate user assumptions against decision-making frameworks.
 */
app.post('/api/cognitive-audit', async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'Gemini AI service is not configured.' });
  }

  const { title, description, category, options } = req.body;

  if (!title || !options || !Array.isArray(options)) {
    return res.status(400).json({ error: 'Missing decision parameters (title, options).' });
  }

  const systemInstruction = `You are an expert behavioral scientist and decision analyst specializing in cognitive debiasing and decision frameworks (Bayesian reasoning, Prospect Theory, Reference Class Forecasting, Pre-Mortem analysis).
Your task is to analyze the user's decision model, detect potential cognitive biases or unrealistic assumptions, identify missing scenarios/blind spots, and provide debiasing reframing questions.

Standard Cognitive Decision Frameworks to consider:
1. Overconfidence & Optimism Bias: Overestimating positive outcome probabilities or underestimating downside risks.
2. Sunk Cost & Status Quo Bias: Unjustified weighting of current path or past investment.
3. Loss Aversion & Risk Myopia: Overreacting to short-term downside vs expected long-term value.
4. Planning Fallacy: Unrealistic timelines or ignoring execution friction.
5. Availability / Black Swan Blind Spot: Omitting low-probability high-impact events.
6. Confirmation / Framing Bias: Asymmetric detail between options.

Be constructively critical, rigorous, and actionable.`;

  const prompt = `
Analyze this decision model:
Title: "${title}"
Description: "${description || 'None'}"
Category: "${category || 'general'}"

Options & Scenarios:
${JSON.stringify(options, null, 2)}

Provide a structured cognitive audit in valid JSON adhering to the required schema.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['summary', 'biasAudit', 'missingScenarios', 'reframingQuestions'],
          properties: {
            summary: { type: Type.STRING, description: '2-3 sentence overall cognitive evaluation of this decision tree.' },
            biasAudit: {
              type: Type.ARRAY,
              description: 'List of detected cognitive biases or probability/utility distortions.',
              items: {
                type: Type.OBJECT,
                required: ['biasType', 'targetOptionOrScenario', 'observation', 'debiasingAdvice', 'severity'],
                properties: {
                  biasType: { type: Type.STRING, description: 'Name of the cognitive bias (e.g. Overconfidence Bias, Sunk Cost Fallacy, Loss Aversion).' },
                  targetOptionOrScenario: { type: Type.STRING, description: 'Which option or scenario this bias applies to.' },
                  observation: { type: Type.STRING, description: 'Specific evidence in the user model showing this bias.' },
                  debiasingAdvice: { type: Type.STRING, description: 'How to adjust probability or utility to correct for this bias.' },
                  severity: { type: Type.STRING, description: 'One of: high, medium, low.' }
                }
              }
            },
            missingScenarios: {
              type: Type.ARRAY,
              description: 'Suggested missing scenarios or blind spot branches.',
              items: {
                type: Type.OBJECT,
                required: ['optionId', 'optionTitle', 'suggestedTitle', 'suggestedProbability', 'suggestedUtility', 'reasoning'],
                properties: {
                  optionId: { type: Type.STRING, description: 'ID or exact title of option where this scenario is missing.' },
                  optionTitle: { type: Type.STRING, description: 'Title of the option.' },
                  suggestedTitle: { type: Type.STRING, description: 'Title for the suggested scenario.' },
                  suggestedProbability: { type: Type.NUMBER, description: 'Decimal probability between 0.05 and 0.95.' },
                  suggestedUtility: { type: Type.NUMBER, description: 'Utility between -100 and +100.' },
                  reasoning: { type: Type.STRING, description: 'Why this scenario is critical for realistic decision making.' }
                }
              }
            },
            reframingQuestions: {
              type: Type.ARRAY,
              description: '3-4 debiasing questions based on decision science frameworks.',
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const auditData = JSON.parse(response.text || '{}');
    res.json(auditData);
  } catch (error: any) {
    console.error('Cognitive audit error:', error);
    res.status(500).json({ error: 'Failed to generate cognitive audit.', details: error.message });
  }
});

/**
 * @api {get} /api/db-schema-docs PostgreSQL DB Schema Documentation
 * @apiDescription Endpoint documenting the PostgreSQL database schema for Vercel/Postgres deployment.
 */
app.get('/api/db-schema-docs', (req, res) => {
  res.json({
    framework: 'drizzle-orm',
    dialect: 'postgresql',
    schema: `
import { pgTable, text, timestamp, boolean, doublePrecision, integer, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Firebase UID or Auth Provider ID
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const decisions = pgTable('decisions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  title: text('title').notNull(), // Encrypted or plain text
  description: text('description'), // Encrypted or plain text
  category: text('category').notNull(), // e.g. 'career', 'finance'
  isEncrypted: boolean('is_encrypted').default(false).notNull(),
  salt: text('salt'), // PBKDF2 salt if encrypted
  iv: text('iv'),     // AES-GCM IV if encrypted
  options: jsonb('options').notNull(), // Embedded complex Options & Scenarios array JSON
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
    `,
    migrationGuide: 'To deploy to Vercel, replace /src/lib/firebase.ts with your PostgreSQL integration via Drizzle ORM, and update authentication to use NextAuth.js or Firebase Auth Admin in edge middleware.'
  });
});

// Setup Vite Dev Server / Static files handler

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
