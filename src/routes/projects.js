const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../db');
const { authMiddleware } = require('../authMiddleware');

// GET all projects for the logged in user
router.get('/', authMiddleware, async (req, res) => {
  const { data: projects, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('user_id', req.user.user_id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(projects);
});

// CREATE project
// Expect: { project_name, project_address, works: [{work_id, quantity}, ...] }
router.post('/', authMiddleware, async (req, res) => {
  const { project_name, project_address, works } = req.body;

  const { data: newProject, error: pError } = await supabaseAdmin
    .from('projects')
    .insert([{ 
      user_id: req.user.user_id,
      project_name, 
      project_address 
    }])
    .select()
    .single();

  if (pError) return res.status(500).json({ error: pError.message });

  const pwEntries = works.map(w => ({
    project_id: newProject.id,
    work_id: w.work_id,
    quantity: w.quantity
  }));

  const { error: pwError } = await supabaseAdmin
    .from('project_works')
    .insert(pwEntries);

  if (pwError) return res.status(500).json({ error: pwError.message });

  res.json({ message: 'Project created', project: newProject });
});

// GET project details
router.get('/:id', authMiddleware, async (req, res) => {
  const projectId = req.params.id;
  
  const { data: project, error: pError } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (pError) return res.status(500).json({ error: pError.message });
  if (!project || project.user_id !== req.user.user_id) {
    return res.status(404).json({ error: 'Project not found or not yours.' });
  }

  const { data: pWorks, error: pwError } = await supabaseAdmin
    .from('project_works')
    .select('*, works(*)')
    .eq('project_id', projectId);

  if (pwError) return res.status(500).json({ error: pwError.message });

  // Return the project with its works
  res.json({ ...project, works: pWorks });
});

// UPDATE project works
// Expect: { works: [{work_id, quantity}, ...] }
router.put('/:id', authMiddleware, async (req, res) => {
  const projectId = req.params.id;
  const { works } = req.body;

  // First check ownership
  const { data: project, error: pError } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (pError) return res.status(500).json({ error: pError.message });
  if (!project || project.user_id !== req.user.user_id) {
    return res.status(404).json({ error: 'Project not found or not yours.' });
  }

  // Delete existing project_works
  await supabaseAdmin
    .from('project_works')
    .delete()
    .eq('project_id', projectId);

  // Insert new
  const pwEntries = works.map(w => ({
    project_id: projectId,
    work_id: w.work_id,
    quantity: w.quantity
  }));

  const { error: pwError } = await supabaseAdmin
    .from('project_works')
    .insert(pwEntries);

  if (pwError) return res.status(500).json({ error: pwError.message });
  res.json({ message: 'Project updated successfully' });
});

// CLONE project
router.post('/:id/clone', authMiddleware, async (req, res) => {
  const projectId = req.params.id;
  const { new_project_name, new_project_address } = req.body;

  const { data: project, error: pError } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (pError) return res.status(500).json({ error: pError.message });
  if (!project || project.user_id !== req.user.user_id) {
    return res.status(404).json({ error: 'Project not found or not yours.' });
  }

  // Fetch existing works
  const { data: pWorks, error: pwError } = await supabaseAdmin
    .from('project_works')
    .select('*')
    .eq('project_id', projectId);

  if (pwError) return res.status(500).json({ error: pwError.message });

  // Create new project
  const { data: newProject, error: npError } = await supabaseAdmin
    .from('projects')
    .insert([{
      user_id: req.user.user_id,
      project_name: new_project_name || (project.project_name + " (Clone)"),
      project_address: new_project_address || project.project_address
    }])
    .select()
    .single();

  if (npError) return res.status(500).json({ error: npError.message });

  const newPwEntries = pWorks.map(w => ({
    project_id: newProject.id,
    work_id: w.work_id,
    quantity: w.quantity
  }));

  const { error: npwError } = await supabaseAdmin
    .from('project_works')
    .insert(newPwEntries);

  if (npwError) return res.status(500).json({ error: npwError.message });

  res.json({ message: 'Project cloned successfully', project: newProject });
});

// CALCULATION endpoint
router.get('/:id/calculate', authMiddleware, async (req, res) => {
  const projectId = req.params.id;

  const { data: project, error: pError } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (pError) return res.status(500).json({ error: pError.message });
  if (!project || project.user_id !== req.user.user_id) {
    return res.status(404).json({ error: 'Project not found or not yours.' });
  }

  const { data: pWorks, error: pwError } = await supabaseAdmin
    .from('project_works')
    .select('project_id, quantity, works(id, name, work_resources(quantity_per_unit_work, resources(id, name, unit, rate)))')
    .eq('project_id', projectId);

  if (pwError) return res.status(500).json({ error: pwError.message });

  // Aggregate resources
  const resourceMap = {}; // key: resource_id, value: total quantity

  pWorks.forEach(pw => {
    pw.works.work_resources.forEach(wr => {
      const r = wr.resources;
      const totalRequired = wr.quantity_per_unit_work * pw.quantity;
      if (!resourceMap[r.id]) {
        resourceMap[r.id] = { 
          name: r.name, 
          unit: r.unit, 
          rate: r.rate, 
          totalQuantity: 0 
        };
      }
      resourceMap[r.id].totalQuantity += totalRequired;
    });
  });

  // Convert to array and calculate cost
  const results = [];
  let grandTotal = 0;
  for (const rId in resourceMap) {
    const item = resourceMap[rId];
    const amount = item.totalQuantity * item.rate;
    grandTotal += amount;
    results.push({
      resource_name: item.name,
      unit: item.unit,
      quantity: item.totalQuantity,
      rate: item.rate,
      amount
    });
  }

  res.json({ resources: results, total_cost: grandTotal });
});

module.exports = router;
