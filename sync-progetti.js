/**
 * sync-progetti.js — Agente Claude che sincronizza elenco_progetti_2026.xlsx con il DB.
 *
 * Uso:
 *   node sync-progetti.js
 *
 * Variabili d'ambiente richieste:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY
 *
 * Il file Excel viene cercato in:
 *   1. EXCEL_PATH (variabile d'ambiente opzionale)
 *   2. C:\Users\Camilla\Downloads\elenco_progetti_2026.xlsx
 *   3. C:\Users\Camilla\OneDrive - Confluencia\Documenti\elenco_progetti_2026.xlsx
 */

require('dotenv').config({ path: '.env.import' });

const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');
const os = require('os');

// ── Config ──────────────────────────────────────────────────────────────────
const EXCEL_CANDIDATES = [
  process.env.EXCEL_PATH,
  path.join(os.homedir(), 'Downloads', 'elenco_progetti_2026.xlsx'),
  path.join(os.homedir(), 'OneDrive - Confluencia', 'Documenti', 'elenco_progetti_2026.xlsx'),
].filter(Boolean);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ANTHROPIC_API_KEY) {
  console.error('❌  Variabili mancanti: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ── Dedup automatico (prima di tutto) ────────────────────────────────────────
async function removeDuplicates() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, created_at')
    .order('created_at', { ascending: true });

  if (error || !data) return;

  const seen = new Map(); // name.lower → id del primo (più vecchio)
  const toDelete = [];

  for (const p of data) {
    const key = p.name.trim().toLowerCase();
    if (seen.has(key)) {
      toDelete.push(p.id); // tieni il più vecchio, elimina i successivi
    } else {
      seen.set(key, p.id);
    }
  }

  if (toDelete.length === 0) {
    console.log('✅  Nessun duplicato trovato.');
    return;
  }

  const { error: delError } = await supabase
    .from('projects')
    .delete()
    .in('id', toDelete);

  if (delError) {
    console.log(`❌  Errore rimozione duplicati: ${delError.message}`);
  } else {
    console.log(`🧹  Rimossi ${toDelete.length} duplicati.`);
  }
}

// ── Tool: leggi Excel ────────────────────────────────────────────────────────
function toolReadExcel() {
  for (const filePath of EXCEL_CANDIDATES) {
    try {
      const wb = XLSX.readFile(filePath);
      const ws = wb.Sheets['Progetti'];
      if (!ws) return { error: `Sheet "Progetti" non trovato in ${filePath}` };
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
      const projects = rows
        .filter(r => r['Nome Progetto']?.toString().trim())
        .map(r => ({
          name: r['Nome Progetto']?.toString().trim(),
          market: r['Mercato'] || null,
          weight_format: r['Peso'] || null,
          stage: mapStage(r['Stato Avanzamento']),
          priority: mapPriority(r['Priorità']),
          client: r['Cliente'] || null,
          notes: r['Note'] || null,
        }));
      console.log(`📂  Excel letto: ${filePath} (${projects.length} progetti)`);
      return { projects, source: filePath };
    } catch (_) { /* prova il prossimo */ }
  }
  return { error: 'File Excel non trovato in nessun percorso.' };
}

// ── Tool: leggi progetti dal DB ──────────────────────────────────────────────
async function toolGetProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, market, stage, priority, client, notes, weight_format');
  if (error) return { error: error.message };
  return { projects: data || [] };
}

// ── Tool: upsert progetto ────────────────────────────────────────────────────
async function toolUpsertProject({ id, name, market, stage, priority, client, notes, weight_format }) {
  const { data: admin } = await supabase
    .from('profiles').select('id').eq('role', 'admin').single();
  const ownerId = admin?.id;

  if (id) {
    const { error } = await supabase
      .from('projects')
      .update({ name, market, stage, priority, client, notes, weight_format })
      .eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true, action: 'updated', id };
  } else {
    const { data, error } = await supabase
      .from('projects')
      .insert({ name, market, stage, priority, client, notes, weight_format,
                 owner_id: ownerId, created_by: ownerId })
      .select('id').single();
    if (error) return { success: false, error: error.message };
    return { success: true, action: 'inserted', id: data.id };
  }
}

// ── Mapping valori Excel → DB ────────────────────────────────────────────────
function mapStage(s) {
  if (!s) return 'idea';
  const v = String(s).toLowerCase().trim();
  if (v.includes('pronto') || v.includes('ready')) return 'pronto';
  if (v.includes('sviluppo') || v.includes('development')) return 'sviluppo';
  if (v.includes('test')) return 'test';
  return 'idea';
}

function mapPriority(p) {
  if (!p) return 'media';
  const v = String(p).toUpperCase().trim();
  if (v === 'ALTA' || v === 'HIGH') return 'alta';
  if (v === 'BASSA' || v === 'LOW') return 'bassa';
  return 'media';
}

// ── Definizioni tool per Claude ──────────────────────────────────────────────
const TOOLS = [
  {
    name: 'read_excel',
    description: 'Legge il file Excel elenco_progetti_2026.xlsx e restituisce la lista dei progetti.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_db_projects',
    description: 'Recupera tutti i progetti esistenti nel database CRM.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'upsert_project',
    description: 'Inserisce un nuovo progetto o aggiorna uno esistente nel database.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID del progetto esistente (omettere per nuovo)' },
        name: { type: 'string', description: 'Nome del progetto' },
        market: { type: 'string', description: 'Mercato target' },
        stage: { type: 'string', enum: ['idea', 'sviluppo', 'test', 'pronto'] },
        priority: { type: 'string', enum: ['alta', 'media', 'bassa'] },
        client: { type: 'string', description: 'Cliente' },
        notes: { type: 'string', description: 'Note' },
        weight_format: { type: 'string', description: 'Peso/formato' },
      },
      required: ['name'],
    },
  },
];

// ── Esecutore tool ────────────────────────────────────────────────────────────
async function executeTool(name, input) {
  switch (name) {
    case 'read_excel':      return toolReadExcel();
    case 'get_db_projects': return toolGetProjects();
    case 'upsert_project':  return toolUpsertProject(input);
    default: return { error: `Tool sconosciuto: ${name}` };
  }
}

// ── Loop agente ───────────────────────────────────────────────────────────────
async function runAgent() {
  console.log('🤖  Avvio agente sincronizzazione progetti...\n');

  // Prima rimuovi eventuali duplicati
  await removeDuplicates();

  const messages = [{
    role: 'user',
    content: `Sei un assistente CRM. Il tuo compito è sincronizzare i progetti dal file Excel con il database.

Segui questi passi:
1. Leggi i progetti dal file Excel con read_excel
2. Recupera i progetti esistenti nel DB con get_db_projects
3. Confronta i due elenchi per nome (case-insensitive):
   - Se un progetto Excel NON esiste nel DB → inseriscilo con upsert_project (senza id)
   - Se esiste nel DB con dati diversi → aggiornalo con upsert_project (con id)
   - Se è uguale → skip
4. Alla fine fornisci un riepilogo: N inseriti, N aggiornati, N già aggiornati.`,
  }];

  while (true) {
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: TOOLS,
      messages,
    });

    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        console.log(block.text);
      }
    }

    if (response.stop_reason === 'end_turn') break;

    const toolCalls = response.content.filter(b => b.type === 'tool_use');
    if (!toolCalls.length) break;

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const call of toolCalls) {
      console.log(`🔧  [${call.name}]`, Object.keys(call.input).length ? JSON.stringify(call.input) : '');
      const result = await executeTool(call.name, call.input);
      if (result.action) console.log(`   ✅  ${result.action}: ${result.id}`);
      if (result.error) console.log(`   ❌  errore: ${result.error}`);
      toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(result) });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  console.log('\n✅  Sincronizzazione completata.');
}

runAgent().catch(e => {
  console.error('Errore fatale:', e.message);
  process.exit(1);
});
