const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { requireAuth, requireRole, sb } = require('../middleware/auth');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await sb
      .from('projects')
      .select(`
        *,
        owner:profiles!owner_id(id, full_name),
        milestones(id, title, completed, due_date),
        project_members(user_id, role, member:profiles!user_id(full_name)),
        project_tasks(id, status, priority, assigned_to)
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ projects: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/admin/overview', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const [projectsRes, tasksRes] = await Promise.all([
      sb.from('projects').select('id, name, status, priority, due_date, owner_id, owner:profiles!projects_owner_id_fkey(full_name)'),
      sb.from('project_tasks').select('project_id, status, priority, assigned_to, due_date')
    ]);

    const projects = projectsRes.data || [];
    const tasks = tasksRes.data || [];
    const today = new Date().toISOString().split('T')[0];

    const overview = projects.map(p => {
      const pt = tasks.filter(t => t.project_id === p.id);
      return {
        ...p,
        tasks_total: pt.length,
        tasks_done: pt.filter(t => t.status === 'done').length,
        tasks_blocked: pt.filter(t => t.status === 'blocked').length,
        tasks_overdue: pt.filter(t => t.status !== 'done' && t.due_date && t.due_date < today).length,
        progress: pt.length ? Math.round(pt.filter(t => t.status === 'done').length / pt.length * 100) : 0
      };
    });

    res.json({
      summary: {
        total: projects.length,
        active: projects.filter(p => p.status === 'active').length,
        completed: projects.filter(p => p.status === 'completed').length,
        urgent: projects.filter(p => p.priority === 'urgent').length,
      },
      projects: overview
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await sb
      .from('projects')
      .select(`
        *,
        owner:profiles!owner_id(id, full_name, role),
        milestones(*, created_by_profile:profiles!milestones_created_by_fkey(full_name)),
        project_members(user_id, role, member:profiles!project_members_user_id_fkey(id, full_name, role)),
        project_contacts(contact_id, role, contact:contacts!project_contacts_contact_id_fkey(id, name, company, stage)),
        project_notes(*, author:profiles!project_notes_created_by_fkey(full_name)),
        project_tasks(*, assignee:profiles!project_tasks_assigned_to_fkey(full_name))
      `)
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json({ project: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { name, description, status, priority, due_date, budget, notes, member_ids } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome progetto obbligatorio' });

  try {
    const { data: project, error } = await sb.from('projects').insert({
      name, description, status: status || 'active',
      priority: priority || 'medium',
      due_date, budget, notes,
      owner_id: req.profile.id,
      created_by: req.profile.id
    }).select().single();
    if (error) throw error;

    const members = [{ project_id: project.id, user_id: req.profile.id, role: 'owner' }];
    if (member_ids?.length) {
      member_ids.filter(id => id !== req.profile.id).forEach(uid => {
        members.push({ project_id: project.id, user_id: uid, role: 'member' });
      });
    }
    await sb.from('project_members').insert(members);

    await sb.from('activity_log').insert({
      user_id: req.profile.id,
      action: 'project_created',
      payload: { project_id: pr
