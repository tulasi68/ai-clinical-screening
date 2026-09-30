import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSession, getSession, saveSession, saveOutput, getOutput,
  getSessionByPatientToken
} from './store.js';
import { nextStep, consolidate, nextFollowUp } from './ai.js';
import {
  SITE_QUESTION, FIXED_SETS, MAX_AI_QUESTIONS, siteOf, nextFixedQuestion,
  questionDef, inputSpec, resolveAnswer, localizeQuestion
} from './flow.js';

const app = express();
app.use(express.json({ limit: '256kb' }));
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '../public')));
const port = Number(process.env.PORT || 3000);
const maxQuestions = () => Number(process.env.MAX_QUESTIONS || 12);

const SUPPORTED_UI_LANGS = new Set(['en','kn','hi','ta','te','ml','bn','or','as','mr','ur','bho','mai','ne','mni','brx']);
function normalizeUiLang(value) {
  const s = String(value || 'en').toLowerCase().trim();
  if (SUPPORTED_UI_LANGS.has(s)) return s;
  for (const c of SUPPORTED_UI_LANGS) {
    if (s === c || s.startsWith(c + '-') || s.startsWith(c + '_')) return c;
  }
  return 'en';
}

/** Localize fixed question using hard-coded strings in flow.js (no live translate API). */
async function localizeForPatient(q, lang) {
  const L = normalizeUiLang(lang);
  const loc = localizeQuestion(q, L) || q;
  return {
    text: loc.text || q.text,
    options: loc.options || q.options || [],
  };
}
