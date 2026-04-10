require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
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
});
