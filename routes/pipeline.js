const express = require('express');
const router = express.Router();
const { requireAuth, sb } = require('../middleware/auth');

// GET — tutte le opportunità (opzionale: ?project_id=xxx)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { project_id } = req.query;
    let query = sb
      .from('project_pipeline')
      .select(`
        id, stage, notes, value_estimate, contact_name, created_at, updated_at,
        project:projects(id, name, market, weight_format),
        contact:contacts(id, name, company),
        owner:profiles!owner_id(id, full_name)
      `)
      .order('updated_at', { ascending: false });

    if (project_id) query = query.eq('project_id', project_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, pipeline: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST — nuova opportunità
router.post('/', requireAuth, async (req, res) => {
  const { project_id, contact_id, contact_name, stage, notes, value_estimate } = req.body;
  if (!project_id) return res.status(400).json({ error: 'project_id richiesto' });

  try {
    const { data, error } = await sb
      .from('project_pipeline')
      .insert({
        project_id,
        contact_id: contact_id || null,
        contact_name: contact_name || null,
        stage: stage || 'proposto',
        notes: notes || null,
        value_estimate: value_estimate || null,
        owner_id: req.profile.id,
        created_by: req.profile.id,
      })
      .select(`
        id, stage, notes, value_estimate, contact_name, created_at,
        project:projects(id, name, market, weight_format),
        contact:contacts(id, name, company),
        owner:profiles!owner_id(id, full_name)
      `)
      .single();

    if (error) throw error;
    res.json({ success: true, opportunity: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH — aggiorna opportunità
router.patch('/:id', requireAuth, async (req, res) => {
  const { stage, notes, value_estimate, contact_id, contact_name } = req.body;
  try {
    const { data, error } = await sb
      .from('project_pipeline')
      .update({
        ...(stage && { stage }),
        ...(notes !== undefined && { notes }),
        ...(value_estimate !== undefined && { value_estimate }),
        ...(contact_id !== undefined && { contact_id }),
        ...(contact_name !== undefined && { contact_name }),
      })
      .eq('id', req.params.id)
      .select(`
        id, stage, notes, value_estimate, contact_name, updated_at,
        project:projects(id, name, market, weight_format),
        contact:contacts(id, name, company),
        owner:profiles!owner_id(id, full_name)
      `)
      .single();

    if (error) throw error;
    res.json({ success: true, opportunity: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await sb.from('project_pipeline').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
