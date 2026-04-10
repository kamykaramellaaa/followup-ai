const express = require('express');
const router = express.Router();
const { requireAuth, sb } = require('../middleware/auth');

const SELECT_FIELDS = `
  id, stage, notes, value_estimate, contact_name, created_at, updated_at,
  project:projects(id, name, market, weight_format),
  contact:contacts(id, name, company),
  owner:profiles!owner_id(id, full_name),
  assigned:profiles!assigned_to(id, full_name)
`;

// GET — tutte le opportunità
router.get('/', requireAuth, async (req, res) => {
  try {
    const { project_id } = req.query;
    const role = req.profile.role;

    let query = sb
      .from('project_pipeline')
      .select(SELECT_FIELDS)
      .order('updated_at', { ascending: false });

    if (project_id) query = query.eq('project_id', project_id);

    // Gli agenti vedono solo le opportunità assegnate a loro
    if (role === 'agent') {
      query = query.eq('assigned_to', req.profile.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, pipeline: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST — nuova opportunità (solo admin e manager)
router.post('/', requireAuth, async (req, res) => {
  const role = req.profile.role;
  if (!['admin', 'manager'].includes(role)) {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const { project_id, contact_id, contact_name, stage, notes, value_estimate, assigned_to } = req.body;
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
        assigned_to: assigned_to || null,
        owner_id: req.profile.id,
        created_by: req.profile.id,
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;
    res.json({ success: true, opportunity: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH — aggiorna opportunità
router.patch('/:id', requireAuth, async (req, res) => {
  const role = req.profile.role;
  const { stage, notes, value_estimate, contact_id, contact_name, assigned_to } = req.body;

  try {
    // Agente può aggiornare solo stage e notes (non riassegnare, non cambiare cliente/valore)
    let updateData = {};
    if (role === 'agent') {
      if (stage) updateData.stage = stage;
      if (notes !== undefined) updateData.notes = notes;
    } else {
      // admin e manager aggiornano tutto
      if (stage) updateData.stage = stage;
      if (notes !== undefined) updateData.notes = notes;
      if (value_estimate !== undefined) updateData.value_estimate = value_estimate;
      if (contact_id !== undefined) updateData.contact_id = contact_id;
      if (contact_name !== undefined) updateData.contact_name = contact_name;
      if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
    }

    const { data, error } = await sb
      .from('project_pipeline')
      .update(updateData)
      .eq('id', req.params.id)
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;
    res.json({ success: true, opportunity: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE — solo admin
router.delete('/:id', requireAuth, async (req, res) => {
  if (req.profile.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin può eliminare' });
  }
  try {
    const { error } = await sb.from('project_pipeline').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
