require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');
const { startReminderCron, runReminderJob } = require('./services/emailReminder');
const { requireAuth, requireRole } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/ai', require('./routes/ai'));
app.use('/api/transcribe', require('./routes/transcribe'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/projects', require('./routes/projects-new'));
app.use('/api/outlook', require('./routes/outlook'));
app.use('/api/team', require('./routes/team'));
app.use('/api/sync', require('./routes/sync'));
app.use('/api/pipeline', require('./routes/pipeline'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint: triggera manualmente l'invio dei reminder (solo admin)
app.post('/api/reminders/test', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await runReminderJob();
    res.json({ success: true, message: 'Job reminder eseguito — controlla i log e la tua email' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint non trovato' });
});

app.use((err, req, res, next) => {
  console.error('Errore server:', err);
  res.status(500).json({ error: 'Errore interno del server' });
});

app.listen(PORT, () => {
  console.log(`FollowUp AI → http://localhost:${PORT}`);
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓' : '✗');
  console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✓' : '✗');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓' : '✗');
  console.log('SMTP_USER:', process.env.SMTP_USER ? '✓' : '✗ (reminder disabilitati)');
  startReminderCron();
  startEmailProcessingCron();
});

// ── Cron: analisi email Outlook ogni 15 minuti ─────────────────────────────
async function runEmailProcessing() {
  const { sb } = require('./middleware/auth');
  try {
    // Trova tutti gli utenti con Outlook connesso
    const { data: tokens } = await sb
      .from('outlook_tokens')
      .select('user_id');

    if (!tokens?.length) return;

    const { getValidToken } = require('./services/outlookSync');
    const Anthropic = require('@anthropic-ai/sdk');
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    for (const { user_id } of tokens) {
      try {
        const token = await getValidToken(user_id);

        // Leggi ultime 10 email non lette
        const response = await axios.get(
          'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=10&$select=id,subject,from,receivedDateTime,body,bodyPreview&$filter=isRead eq false&$orderby=receivedDateTime desc',
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const emails = response.data.value || [];
        if (!emails.length) continue;

        for (const email of emails) {
          const body = email.body?.content?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800);
          const fromEmail = email.from?.emailAddress?.address;
          const fromName = email.from?.emailAddress?.name;

          const message = await claude.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 600,
            messages: [{
              role: 'user',
              content: `Sei un assistente CRM per un'azienda italiana di distribuzione alimentare B2B.
Analizza questa email e restituisci SOLO JSON valido.

DA: ${fromName} <${fromEmail}>
OGGETTO: ${email.subject}
TESTO: ${body}

{"relevant":true/false,"intent":"cosa vuole il mittente in max 10 parole","urgency":"alta|media|bassa","tasks":[{"text":"azione da fare","type":"email|chiamata|meeting|task","when":"oggi|domani|questa settimana","urgent":true/false}]}`
            }]
          });

          const raw = message.content?.[0]?.text || '';
          let analysis;
          try { analysis = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
          catch { continue; }

          if (!analysis.relevant || !analysis.tasks?.length) continue;

          const tasksToInsert = analysis.tasks.map(t => ({
            title: t.text,
            task_type: t.type || 'task',
            urgent: t.urgent || false,
            priority: analysis.urgency === 'alta' ? 'alta' : 'media',
            assigned_to: user_id,
            created_by: user_id,
            ai_generated: true,
          }));

          await sb.from('tasks').insert(tasksToInsert);
          console.log(`[email-cron] ${tasksToInsert.length} task create per utente ${user_id} da email "${email.subject}"`);
        }
      } catch (e) {
        console.error(`[email-cron] Errore utente ${user_id}:`, e.message);
      }
    }
  } catch (e) {
    console.error('[email-cron] Errore generale:', e.message);
  }
}

function startEmailProcessingCron() {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.MICROSOFT_CLIENT_ID) {
    console.log('[email-cron] Disabilitato (ANTHROPIC_API_KEY o MICROSOFT_CLIENT_ID mancanti)');
    return;
  }
  // Ogni 15 minuti
  cron.schedule('*/15 * * * *', () => {
    console.log('[email-cron] Avvio analisi email...');
    runEmailProcessing();
  });
  console.log('[email-cron] ✓ Avviato (ogni 15 minuti)');
}
