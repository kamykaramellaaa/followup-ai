const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Analisi nota testuale o vocale
// Supporta: contact_id (collega a contatto esistente), assignee_id, project_id (nota progetto)
router.post('/analyze', requireAuth, async (req, res) => {
  const { note, assignee_name, contact_id, assignee_id, project_id } = req.body;
  if (!note || note.trim().length < 5) {
    return res.status(400).json({ error: 'Nota troppo corta' });
  }

  const assignedTo = assignee_name || req.profile.full_name;

  try {
    const message = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Sei un assistente CRM per un'azienda italiana di distribuzione alimentare B2B (Confluencia).
Analizza questa nota vocale/testuale e restituisci SOLO un oggetto JSON valido, senza testo aggiuntivo.

NOTA: "${note}"
ASSEGNARE I TASK A: "${assignedTo}"

Determina il "destination" in base al contenuto:
- "contact": se parla di un cliente/prospect specifico con cui c'è un'interazione commerciale
- "task": se è un promemoria o azione generica non legata a un contatto specifico
- "project_note": se è un aggiornamento su un progetto interno

JSON richiesto:
{
  "destination": "contact | task | project_note",
  "contact_name": "nome cognome o null",
  "company": "nome azienda o null",
  "intent": "frase breve che descrive l'intento",
  "urgency": "alta | media | bassa",
  "next_action_type": "chiamata | email | meeting | task",
  "key_info": "informazione chiave emersa (max 15 parole)",
  "suggested_stage": "new | warm | hot | won",
  "tasks": [
    {
      "text": "task specifico e azionabile",
      "type": "chiamata | email | meeting | task",
      "when": "oggi | domani | questa settimana | entro 3 giorni | entro venerdì",
      "urgent": true
    }
  ],
  "ai_advice": "consiglio pratico max 2 frasi, tono diretto"
}`
      }]
    });

    const raw = message.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Auto-salva task nel DB
    if (parsed.tasks && parsed.tasks.length > 0) {
      const tasksToInsert = parsed.tasks.map(t => ({
        title: t.text,
        type: t.type,
        due_date: calculateDueDate(t.when),
        urgent: t.urgent || false,
        priority: parsed.urgency === 'alta' ? 'alta' : parsed.urgency === 'media' ? 'media' : 'bassa',
        contact_id: contact_id || null,
        assigned_to: assignee_id || req.profile.id,
        created_by: req.profile.id,
        ai_generated: true
      }));

      const { data: savedTasks, error: dbError } = await supabase
        .from('tasks')
        .insert(tasksToInsert)
        .select();

      if (!dbError) parsed.saved_tasks = savedTasks;
    }

    res.json({ success: true, analysis: parsed });
  } catch (e) {
    console.error('Errore Claude:', e.message);
    res.status(500).json({ error: 'Errore analisi AI: ' + e.message });
  }
});

// Salva il risultato dell'analisi vocale in modo completo:
// Crea/aggiorna contatto, collega task, eventualmente crea nota progetto
router.post('/save-voice', requireAuth, async (req, res) => {
  const { analysis, contact_id, project_id, assignee_id, original_note } = req.body;
  if (!analysis) return res.status(400).json({ error: 'Analisi mancante' });

  const ownerId = assignee_id || req.profile.id;
  const results = { contact: null, tasks: [], project_note: null };

  try {
    // 1. Crea/aggiorna contatto se destination === 'contact'
    let finalContactId = contact_id || null;
    if (analysis.destination === 'contact' && !contact_id && analysis.contact_name) {
      const { data, error } = await supabase.from('contacts').insert({
        name: analysis.contact_name,
        company: analysis.company || null,
        stage: analysis.suggested_stage || 'new',
        owner_id: ownerId,
        created_by: req.profile.id,
        notes: original_note || null
      }).select().single();
      if (!error) { results.contact = data; finalContactId = data.id; }
    } else if (contact_id) {
      // Aggiorna note del contatto esistente con la nota vocale
      if (original_note) {
        await supabase.from('contacts')
          .update({ notes: original_note })
          .eq('id', contact_id);
      }
      results.contact = { id: contact_id };
    }

    // 2. Salva task (collega al contatto se presente)
    if (analysis.tasks && analysis.tasks.length > 0) {
      const tasksToInsert = analysis.tasks.map(t => ({
        title: t.text,
        type: t.type || 'task',
        due_date: calculateDueDate(t.when),
        urgent: t.urgent || false,
        priority: analysis.urgency === 'alta' ? 'alta' : analysis.urgency === 'media' ? 'media' : 'bassa',
        contact_id: finalContactId,
        assigned_to: ownerId,
        created_by: req.profile.id,
        ai_generated: true
      }));
      const { data: savedTasks } = await supabase.from('tasks').insert(tasksToInsert).select();
      results.tasks = savedTasks || [];
    }

    // 3. Crea nota progetto se destination === 'project_note'
    if (analysis.destination === 'project_note' && project_id) {
      const { data: note } = await supabase.from('project_notes').insert({
        project_id,
        author_id: req.profile.id,
        note_type: analysis.next_action_type === 'meeting' ? 'meeting' : 'update',
        content: original_note,
        ai_summary: analysis.key_info || null
      }).select().single();
      results.project_note = note;
    }

    res.json({ success: true, results });
  } catch (e) {
    console.error('Errore save-voice:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Parse rapido di un task in linguaggio naturale
router.post('/parse-task', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length < 2) return res.status(400).json({ error: 'Testo troppo corto' });

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  try {
    const message = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Sei un CRM italiano. Analizza il testo e restituisci SOLO JSON valido, nessun testo extra.
Data oggi: ${todayStr} (${['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'][today.getDay()]})

Testo: "${text}"

JSON richiesto:
{
  "title": "titolo pulito e conciso del task",
  "type": "task | chiamata | email | meeting",
  "priority": "bassa | media | alta",
  "due_date": "YYYY-MM-DD oppure null",
  "urgent": false,
  "assignee_hint": "nome della persona da assegnare se menzionata, altrimenti null"
}

Regole:
- due_date: calcola dalla data oggi se ci sono riferimenti temporali (domani, lunedì, ecc.)
- type: se parla di telefonare/chiamare → chiamata, mandare email/scrivere → email, riunione/incontro → meeting
- priority: urgente/subito/importante → alta, di default → media
- assignee_hint: solo nomi propri di persone, non aziende`
      }]
    });

    const raw = message.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    res.json({ success: true, parsed: JSON.parse(clean) });
  } catch (e) {
    console.error('Errore parse-task:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/suggest-followup', requireAuth, async (req, res) => {
  const { contact_name, company, stage, last_interaction, open_tasks } = req.body;

  try {
    const message = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Sei un assistente CRM. Suggerisci il prossimo follow-up per questo contatto.

Contatto: ${contact_name} di ${company}
Stadio pipeline: ${stage}
Ultima interazione: ${last_interaction || 'non specificata'}
Task aperti: ${open_tasks || 'nessuno'}

Rispondi in JSON:
{
  "action": "descrizione azione consigliata",
  "type": "chiamata | email | meeting",
  "when": "quando farlo",
  "message_draft": "bozza messaggio opzionale (max 3 righe)",
  "reason": "perché questa è la mossa giusta ora"
}`
      }]
    });

    const raw = message.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    res.json({ success: true, suggestion: JSON.parse(clean) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function calculateDueDate(whenText) {
  const today = new Date();
  if (!whenText) return null;
  const text = whenText.toLowerCase();
  if (text === 'oggi') return today.toISOString().split('T')[0];
  if (text === 'domani') {
    const d = new Date(today); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0];
  }
  if (text.includes('questa settimana') || text.includes('venerdì')) {
    const d = new Date(today); d.setDate(d.getDate() + (5 - today.getDay() || 5)); return d.toISOString().split('T')[0];
  }
  if (text.includes('3 giorni')) {
    const d = new Date(today); d.setDate(d.getDate() + 3); return d.toISOString().split('T')[0];
  }
  return null;
}

module.exports = router;
