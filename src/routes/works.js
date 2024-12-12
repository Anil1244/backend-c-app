const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../db');
const { authMiddleware, adminOnly } = require('../authMiddleware');

// GET all works with their resources
router.get('/', authMiddleware, async (req, res) => {
  const { data: works, error } = await supabaseAdmin
    .from('works')
    .select('*');

  if (error) return res.status(500).json({ error: error.message });

  // Fetch associated resources
  const { data: workRes, error: wError } = await supabaseAdmin
    .from('work_resources')
    .select('work_id, resource_id, quantity_per_unit_work, resources(*)');

  if (wError) return res.status(500).json({ error: wError.message });

  // Combine
  const worksWithResources = works.map(work => {
    const relatedResources = workRes.filter(wr => wr.work_id === work.id);
    return {
      ...work,
      resources: relatedResources.map(rr => ({
        resource_id: rr.resource_id,
        resource_name: rr.resources.name,
        unit: rr.resources.unit,
        rate: rr.resources.rate,
        quantity_per_unit_work: rr.quantity_per_unit_work
      }))
    };
  });

  res.json(worksWithResources);
});

// CREATE a new work (admin only)
// Expect: { name: "Work Name", resources: [{resource_id, quantity_per_unit_work}, ...] }
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { name, resources } = req.body;

  const { data: newWork, error: workError } = await supabaseAdmin
    .from('works')
    .insert([{ name }])
    .select()
    .single();

  if (workError) return res.status(500).json({ error: workError.message });

  const entries = resources.map(r => ({
    work_id: newWork.id,
    resource_id: r.resource_id,
    quantity_per_unit_work: r.quantity_per_unit_work
  }));

  const { data: wrData, error: wrError } = await supabaseAdmin
    .from('work_resources')
    .insert(entries)
    .select();

  if (wrError) return res.status(500).json({ error: wrError.message });

  res.json({ ...newWork, resources: wrData });
});

// UPDATE work (admin only)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name, resources } = req.body;

  // Update the work name
  const { data: updatedWork, error: uError } = await supabaseAdmin
    .from('works')
    .update({ name })
    .eq('id', req.params.id)
    .select()
    .single();

  if (uError) return res.status(500).json({ error: uError.message });

  // Delete existing work_resources for this work
  await supabaseAdmin
    .from('work_resources')
    .delete()
    .eq('work_id', req.params.id);

  // Insert new resources
  const entries = resources.map(r => ({
    work_id: req.params.id,
    resource_id: r.resource_id,
    quantity_per_unit_work: r.quantity_per_unit_work
  }));

  const { data: wrData, error: wrError } = await supabaseAdmin
    .from('work_resources')
    .insert(entries)
    .select();

  if (wrError) return res.status(500).json({ error: wrError.message });

  res.json({ ...updatedWork, resources: wrData });
});

// DELETE work (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  // Delete work_resources first
  await supabaseAdmin
    .from('work_resources')
    .delete()
    .eq('work_id', req.params.id);

  // Delete the work
  const { error } = await supabaseAdmin
    .from('works')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Work deleted successfully' });
});

module.exports = router;
