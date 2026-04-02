const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// GET todos dell'utente
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id, title, type, due_date, urgent, completed,
        priority, contact_id, project_id,
        contact:contacts(name, company),
        project:projects(name),
        assigned_to:profiles(full_name, id)
      `)
      .or(`assigned_to.eq.${req.profile.id},created_by.eq.${req.profile.id}`)
      .order('due_date', { ascending: true });
    
    if (error) throw error;
    res.json({ success: true, tasks: data || [] });
  } catch (e) {
    console.error('Errore GET tasks:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET task singolo
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    res.json({ success: true, task: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST nuovo task (da UI manuale o da AI)
router.post('/', requireAuth, async (req, res) => {
  const { title, type, due_date, urgent, priority, contact_id, project_id, assigned_to_id } = req.body;

  if (!title || !type) {
    return res.status(400).json({ error: 'Titolo e tipo richiesti' });
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        type,
        due_date: due_date || null,
        urgent: urgent || false,
        priority: priority || 'media',
        contact_id: contact_id || null,
        project_id: project_id || null,
        assigned_to: assigned_to_id || req.profile.id,
        created_by: req.profile.id,
        ai_generated: false
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, task: data });
  } catch (e) {
    console.error('Errore POST task:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST salva task da AI analysis (chiamato da /api/ai/analyze)
router.post('/from-analysis', requireAuth, async (req, res) => {
  const { analysis, contact_id } = req.body;

  if (!analysis || !analysis.tasks || analysis.tasks.length === 0) {
    return res.status(400).json({ error: 'Nessun task da salvare' });
  }

  try {
    const tasksToInsert = analysis.tasks.map((t) => ({
      title: t.text,
      type: t.type,
      due_date: t.when ? calculateDueDate(t.when) : null,
      urgent: t.urgent || false,
      priority: analysis.urgency === 'alta' ? 'alta' : analysis.urgency === 'media' ? 'media' : 'bassa',
      contact_id: contact_id || null,
      assigned_to: null, // sarà assegnato manualmente o da manager
      created_by: req.profile.id,
      ai_generated: true
    }));

    const { data, error } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select();

    if (error) throw error;
    res.json({ success: true, created: data.length, tasks: data });
  } catch (e) {
    console.error('Errore POST tasks from analysis:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH aggiorna task
router.patch('/:id', requireAuth, async (req, res) => {
  const { title, type, due_date, urgent, completed, priority, assigned_to_id } = req.body;

  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        ...(title && { title }),
        ...(type && { type }),
        ...(due_date !== undefined && { due_date }),
        ...(urgent !== undefined && { urgent }),
        ...(priority && { priority }),
        ...(completed !== undefined && { completed, completed_at: completed ? new Date().toISOString() : null }),
        ...(assigned_to_id && { assigned_to: assigned_to_id })
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, task: data });
  } catch (e) {
    console.error('Errore PATCH task:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE task
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Utility: calcola due_date da testo like "oggi", "domani", "questa settimana"
function calculateDueDate(whenText) {
  const today = new Date();
  
  if (whenText === 'oggi') return today.toISOString().split('T')[0];
  if (whenText === 'domani') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  if (whenText === 'questa settimana') {
    const friday = new Date(today);
    friday.setDate(friday.getDate() + (5 - today.getDay() || -2)); // prossimo venerdì
    return friday.toISOString().split('T')[0];
  }
  if (whenText === 'entro 3 giorni') {
    const in3days = new Date(today);
    in3days.setDate(in3days.getDate() + 3);
    return in3days.toISOString().split('T')[0];
  }
  if (whenText === 'entro venerdì') {
    const friday = new Date(today);
    friday.setDate(friday.getDate() + (5 - today.getDay() || -2));
    return friday.toISOString().split('T')[0];
  }
  return null;
}

module.exports = router;
