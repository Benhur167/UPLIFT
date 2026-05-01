// uplift-backend/routes/storyRoutes.js
const express = require('express');
const router = express.Router();
const Story = require('../models/Story');
const { toks, cos } = require('../utils/text');
const authCheck = require('../middleware/authCheck');

// --------------------
// Protected: create a problem story
// POST /api/stories
// --------------------
router.post('/',async (req, res) => {
  try {
    const { title = '', content, tags = [] } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: 'content required' });

    const doc = await Story.create({
      username: req.user?.username || req.body.username || 'anonymous',
      title,
      content,
      tags,
      type: 'problem'
    });

    res.status(201).json(doc);
  } catch (e) {
    console.error('POST /api/stories error', e);
    res.status(500).json({ message: 'failed to create problem story' });
  }
});

// --------------------
// Protected: create a success story
// POST /api/stories/success
// --------------------
router.post('/success', authCheck, async (req, res) => {
  try {
    const { title = '', content, tags = [] } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: 'content required' });

    const doc = await Story.create({
      username: req.user?.username || req.body.username || 'anonymous',
      title,
      content,
      tags,
      type: 'success'
    });

    res.status(201).json(doc);
  } catch (e) {
    console.error('POST /api/stories/success error', e);
    res.status(500).json({ message: 'failed to create success story' });
  }
});

// --------------------
// Public: list recent stories (all types)
// GET /api/stories
// --------------------
router.get('/', async (_req, res) => {
  try {
    const list = await Story.find().sort({ createdAt: -1 }).limit(100);
    res.json(list);
  } catch (e) {
    console.error('GET /api/stories error', e);
    res.status(500).json({ message: 'failed to fetch stories' });
  }
});

// --------------------
// Public: latest success stories
// GET /api/stories/success/latest
// --------------------
router.get('/success/latest', async (_req, res) => {
  try {
    const list = await Story.find({ type: 'success' }).sort({ createdAt: -1 }).limit(20);
    res.json(list);
  } catch (e) {
    console.error('GET /api/stories/success/latest error', e);
    res.status(500).json({ message: 'failed to fetch success stories' });
  }
});

// --------------------
// Public: find similar PROBLEM stories
// GET /api/stories/similar?q=...
// --------------------
router.get('/similar', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    let candidates;
    try {
      // prefer text-search index (requires a text index on content/tags)
      candidates = await Story
        .find({ $text: { $search: q }, type: 'problem' }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(100);
    } catch {
      // fallback to most recent problem stories
      candidates = await Story.find({ type: 'problem' }).sort({ createdAt: -1 }).limit(100);
    }

    const qTokens = toks(q);
    const scored = candidates.map(s => ({
      s,
      score: 0.7 * cos(qTokens, toks(s.content || '')) +
             0.3 * cos(qTokens, toks((s.tags || []).join(' ')))
    }));

    scored.sort((a, b) => b.score - a.score);
    const THRESHOLD = 0.12;
    const results = scored.filter(x => x.score >= THRESHOLD).slice(0, 12).map(x => x.s);
    res.json(results);
  } catch (e) {
    console.error('GET /api/stories/similar error', e);
    res.status(500).json({ message: 'failed to match problem stories' });
  }
});

// --------------------
// Public: find similar SUCCESS stories (weaker overlap algorithm)
// GET /api/stories/similar-success?q=...
// --------------------
router.get('/similar-success', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    const { normalize } = require('../utils/normalize');
    const qTokens = normalize(q);

    // fetch only success stories (limit candidates)
    const candidates = await Story.find({ type: 'success' }).limit(200);

    const scored = candidates.map(s => {
      const storyTokens = normalize(s.content || "").concat(normalize((s.tags || []).join(" ")));
      const qSet = new Set(qTokens);
      const overlap = storyTokens.filter(t => qSet.has(t)).length;
      return { s, score: overlap / (qTokens.length || 1) };
    });

    scored.sort((a, b) => b.score - a.score);
    const THRESHOLD = 0.05; // allow weaker matches
    const results = scored.filter(x => x.score >= THRESHOLD).slice(0, 12).map(x => x.s);
    res.json(results);
  } catch (e) {
    console.error('GET /api/stories/similar-success error', e);
    res.status(500).json({ message: 'failed to match success stories' });
  }
});

module.exports = router;
