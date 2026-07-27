import React, { useState } from 'react';
import { Database, Chrome, RefreshCw, Key, FileSpreadsheet, Server, BookOpen } from 'lucide-react';

export default function ApiDocs() {
  const [activeTab, setActiveTab] = useState<'endpoints' | 'schema' | 'vercel'>('endpoints');

  const endpoints = [
    {
      method: 'POST',
      path: '/api/analyze-decision',
      desc: 'Invokes Gemini 3.5 Flash to generate a structured strategic recommendation report from options, outcomes, and Monte Carlo trial outputs.',
      headers: {
        'Content-Type': 'application/json',
      },
      payload: `{
  "title": "Munich Senior Offer",
  "description": "Weighing senior offer in Munich vs staying in current job.",
  "category": "career",
  "options": [
    {
      "id": "opt_1",
      "title": "Accept Munich Offer",
      "scenarios": [
        { "title": "Stellar promotion & growth", "probability": 0.4, "utility": 80 },
        { "title": "High stress, hard culture", "probability": 0.6, "utility": -30 }
      ]
    }
  ],
  "simulationResults": [
    { "optionTitle": "Accept Munich Offer", "expectedValue": 14, "stdDev": 42.5 }
  ]
}`,
      response: `{
  "report": "### Executive Summary\\nBased on expectation value, Accept Munich Offer holds +14 EV..."
}`
    },
    {
      method: 'POST',
      path: '/api/suggest-scenarios',
      desc: 'Brainstorms 3-4 plausible outcome scenarios with realistic probability and utility scores for a specific decision option.',
      headers: {
        'Content-Type': 'application/json',
      },
      payload: `{
  "decisionTitle": "Buying real-estate",
  "decisionDescription": "Evaluating investing in a 2-bedroom flat.",
  "optionTitle": "Purchase with 30-year fixed loan"
}`,
      response: `{
  "scenarios": [
    { "title": "Market thrives, steady equity appreciation", "probability": 0.5, "utility": 75 },
    { "title": "Interest rates surge, local zoning worsens", "probability": 0.2, "utility": -40 },
    { "title": "Stable occupancy, flat returns", "probability": 0.3, "utility": 20 }
  ]
}`
    },
    {
      method: 'POST',
      path: '/api/cognitive-audit',
      desc: 'Performs a comprehensive cognitive debiasing audit using Gemini 3.5 Flash, detecting bias types (Optimism Bias, Loss Aversion, Planning Fallacy) and suggesting missing outcome branches.',
      headers: {
        'Content-Type': 'application/json',
      },
      payload: `{
  "title": "Startup vs Corporate Offer",
  "category": "career",
  "options": [...]
}`,
      response: `{
  "summary": "Model displays slight optimism bias on Series A funding timeline.",
  "biasAudit": [...],
  "missingScenarios": [...],
  "reframingQuestions": [...]
}`
    }
  ];

  const drizzleSchema = `import { pgTable, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Matches Firebase/NextAuth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const decisions = pgTable('decisions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  title: text('title').notNull(), // Encrypted client-side hex string if isEncrypted
  description: text('description'), // Encrypted client-side hex string if isEncrypted
  category: text('category').notNull(),
  isEncrypted: boolean('is_encrypted').default(false).notNull(),
  salt: text('salt'), // Hex salt used to derive PBKDF2 key
  iv: text('iv'),     // Hex IV used to decrypt AES-GCM payload
  options: jsonb('options').notNull(), // JSON block of Options & Scenarios
  createdAt: timestamp('created_at').defaultNow().notNull(),
});`;

  return (
    <div id="api-docs-workspace" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Developer Integration Portal
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Complete specifications of backend endpoints, database schema models, and cloud deployment guides.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8 gap-6">
        <button
          id="tab-api-endpoints"
          onClick={() => setActiveTab('endpoints')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'endpoints'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>REST API Endpoints</span>
        </button>
        <button
          id="tab-database-schema"
          onClick={() => setActiveTab('schema')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'schema'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>PostgreSQL & Drizzle Schema</span>
        </button>
        <button
          id="tab-vercel-deploy"
          onClick={() => setActiveTab('vercel')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'vercel'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Vercel Deploy Guide</span>
        </button>
      </div>

      {activeTab === 'endpoints' && (
        <div className="space-y-8 animate-fade-in">
          {endpoints.map((ep, idx) => (
            <div id={`api-endpoint-${idx}`} key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2.5 py-1 bg-teal-600 text-white font-mono text-xs font-bold rounded-md">
                  {ep.method}
                </span>
                <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                  {ep.path}
                </span>
              </div>
              
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                {ep.desc}
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Request Body (JSON)</div>
                  <pre className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                    {ep.payload}
                  </pre>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Response JSON</div>
                  <pre className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                    {ep.response}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'schema' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6 animate-fade-in">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Drizzle ORM Dialect</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 leading-relaxed">
              We define a modular schema model targeting **PostgreSQL**. The relational structure utilizes a standard JSONB block to embed option decision branches seamlessly, ensuring high query speeds and flexible future schema migrations.
            </p>
          </div>

          <pre className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-6 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
            {drizzleSchema}
          </pre>
        </div>
      )}

      {activeTab === 'vercel' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6 animate-fade-in font-sans text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cloud Run & Vercel Deployment Checklist</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Easily migrate this codebase from the current dev workspace to Vercel with PostgreSQL.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-xs shrink-0">1</div>
              <div>
                <strong className="text-slate-900 dark:text-white">Setup environment secrets</strong>
                <p className="text-slate-500 mt-1">In your Vercel/Cloud Run control panel, set the following env variables:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-500">
                  <li><code className="font-mono bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded text-xs">GEMINI_API_KEY</code>: Obtained from Google AI Studio.</li>
                  <li><code className="font-mono bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded text-xs">POSTGRES_URL</code>: Your neon.tech or Vercel Postgres connection URI.</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-xs shrink-0">2</div>
              <div>
                <strong className="text-slate-900 dark:text-white">Configure database adapters</strong>
                <p className="text-slate-500 mt-1">
                  Replace the client <code className="font-mono bg-slate-100 dark:bg-slate-950 px-1 text-xs">/src/lib/firebase.ts</code> operations with standard HTTP fetch calls to a server-side route pointing to your PostgreSQL schema.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-xs shrink-0">3</div>
              <div>
                <strong className="text-slate-900 dark:text-white">Git Push and Build</strong>
                <p className="text-slate-500 mt-1">
                  Run <code className="font-mono bg-slate-100 dark:bg-slate-950 px-1 text-xs">npm run build</code> which compiles both client React files and bundles the server into a production-ready node module inside <code className="font-mono bg-slate-100 dark:bg-slate-950 px-1 text-xs">dist/server.cjs</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
