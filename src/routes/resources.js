const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../db');
const { authMiddleware, adminOnly } = require('../authMiddleware');

// GET all resources
router.get('/', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('resources')
    .select('*')
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// CREATE resource (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { name, unit, rate } = req.body;
  const { data, error } = await supabaseAdmin
    .from('resources')
    .insert([{ name, unit, rate }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// UPDATE resource (admin only)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name, unit, rate } = req.body;
  const { data, error } = await supabaseAdmin
    .from('resources')
    .update({ name, unit, rate })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE resource (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('resources')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Resource deleted successfully' });
});

module.exports = router;
