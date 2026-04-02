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

router.post('/analyze', requireAuth, async (req, res) => {
  const { note, assignee_name } = req.body;
  if (!note || note.trim().length < 5) {
    return res.status(400).json({ error: 'Nota troppo corta' });
  }

  const assignedTo = assignee_name || req.profile.full_name;

  try {
    const message = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Sei un assistente CRM per imprenditori italiani nel settore food/distribuzione B2B.
Analizza questa nota e restituisci SOLO un oggetto JSON valido, senza testo aggiuntivo.

NOTA: "${note}"
ASSEGNARE I TASK A: "${assignedTo}"

JSON richiesto:
{
  "contact_name": "nome cognome o null",
  "company": "nome azienda o null",
  "intent": "frase breve che descrive l'intento del contatto",
  "urgency": "alta | media | bassa",
  "next_action_type": "chiamata | email | meeting | task",
  "key_info": "informazione chiave emersa (max 15 parole)",
  "suggested_stage": "new | warm | hot | won",
  "tasks": [
    {
      "text": "task specifico e azionabile",
      "type": "chiamata | email | meeting | task",
      "when": "oggi | domani | questa settimana | entro 3 giorni | entro venerdì",
      "urgent": true/false,
      "assigned_to_name": "${assignedTo}"
    }
  ],
  "ai_advice": "consiglio pratico max 2 frasi, tono diretto"
}`
      }]
    });

    const raw = message.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Salva i task nel database se esistono
    if (parsed.tasks && parsed.tasks.length > 0) {
      const tasksToInsert = parsed.tasks.map((t) => ({
        title: t.text,
        type: t.type,
        due_date: t.when ? calculateDueDate(t.when) : null,
        urgent: t.urgent || false,
        priority: parsed.urgency === 'alta' ? 'alta' : parsed.urgency === 'media' ? 'media' : 'bassa',
        contact_id: null, // sarà collegato manualmente se necessario
        assigned_to: null, // sarà assegnato manualmente
        created_by: req.profile.id,
        ai_generated: true
      }));

      const { data: savedTasks, error: dbError } = await supabase
        .from('tasks')
        .insert(tasksToInsert)
        .select();

      if (dbError) {
        console.error('Errore salvataggio task:', dbError.message);
      } else {
        parsed.saved_tasks = savedTasks;
      }
    }

    res.json({ success: true, analysis: parsed });
  } catch (e) {
    console.error('Errore Claude:', e.message);
    res.status(500).json({ error: 'Errore analisi AI: ' + e.message });
  }
});

router.post('/suggest-followup', requireAuth, async (req, res) => {
  const { contact_name, company, stage, last_interaction, open_tasks } = req.body;

  try {
    const message = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
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

// Utility: calcola due_date da testo come "oggi", "domani", etc.
function calculateDueDate(whenText) {
  const today = new Date();
  
  if (!whenText) return null;
  
  const text = whenText.toLowerCase();
  
  if (text === 'oggi') return today.toISOString().split('T')[0];
  if (text === 'domani') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  if (text.includes('questa settimana')) {
    const friday = new Date(today);
    friday.setDate(friday.getDate() + (5 - today.getDay() || -2));
    return friday.toISOString().split('T')[0];
  }
  if (text.includes('3 giorni')) {
    const in3days = new Date(today);
    in3days.setDate(in3days.getDate() + 3);
    return in3days.toISOString().split('T')[0];
  }
  if (text.includes('venerdì')) {
    const friday = new Date(today);
    friday.setDate(friday.getDate() + (5 - today.getDay() || -2));
    return friday.toISOString().split('T')[0];
  }
  return null;
}

module.exports = router;
