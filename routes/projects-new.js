const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// GET tutti i progetti
router.get('/', requireAuth, async (req, res) => {
  try {
    const { stage, priority, market } = req.query;

    let query = supabase
      .from('projects')
      .select(`
        id, name, description, market, stage, priority,
        supplier, weight_format, cost_per_unit, photo_url,
        country_code, country, client,
        owner:profiles!owner_id(full_name, id),
        created_at, updated_at
      `);

    if (stage) query = query.eq('stage', stage);
    if (priority) query = query.eq('priority', priority);
    if (market) query = query.eq('market', market);

    const { data, error } = await query.order('priority', { ascending: false }).order('updated_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, projects: data || [] });
  } catch (e) {
    console.error('Errore GET projects:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET progetto singolo
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json({ success: true, project: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST nuovo progetto
router.post('/', requireAuth, async (req, res) => {
  const { name, description, market, stage, priority, supplier, weight_format, cost_per_unit, photo_url, notes, country_code, country, client } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nome progetto richiesto' });
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        description: description || '',
        market: market || 'Retail',
        stage: stage || 'idea',
        priority: priority || 'media',
        supplier: supplier || null,
        weight_format: weight_format || null,
        cost_per_unit: cost_per_unit || null,
        photo_url: photo_url || null,
        notes: notes || null,
        country_code: country_code || null,
        country: country || null,
        client: client || null,
        owner_id: req.profile.id,
        created_by: req.profile.id
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, project: data });
  } catch (e) {
    console.error('Errore POST project:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH aggiorna progetto
router.patch('/:id', requireAuth, async (req, res) => {
  const { name, description, market, stage, priority, supplier, weight_format, cost_per_unit, photo_url, notes, country_code, country, client } = req.body;

  try {
    const { data, error } = await supabase
      .from('projects')
      .update({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(market && { market }),
        ...(stage && { stage }),
        ...(priority && { priority }),
        ...(supplier !== undefined && { supplier }),
        ...(weight_format !== undefined && { weight_format }),
        ...(cost_per_unit !== undefined && { cost_per_unit }),
        ...(photo_url !== undefined && { photo_url }),
        ...(notes !== undefined && { notes }),
        ...(country_code !== undefined && { country_code }),
        ...(country !== undefined && { country }),
        ...(client !== undefined && { client })
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, project: data });
  } catch (e) {
    console.error('Errore PATCH project:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE progetto
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET dashboard stats (come Excel)
router.get('/stats/overview', requireAuth, async (req, res) => {
  try {
    const { data: total } = await supabase
      .from('projects')
      .select('id', { count: 'exact' });

    const { data: ready } = await supabase
      .from('projects')
      .select('id', { count: 'exact' })
      .eq('stage', 'pronto');

    const { data: highPriority } = await supabase
      .from('projects')
      .select('id', { count: 'exact' })
      .eq('priority', 'alta');

    const { data: development } = await supabase
      .from('projects')
      .select('id', { count: 'exact' })
      .eq('stage', 'sviluppo');

    res.json({
      success: true,
      stats: {
        total: total?.length || 0,
        ready: ready?.length || 0,
        highPriority: highPriority?.length || 0,
        inDevelopment: development?.length || 0
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
