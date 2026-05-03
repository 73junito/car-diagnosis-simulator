require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || null;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || null;
const SUPABASE_KEY = process.env.SUPABASE_KEY || null;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('Supabase client initialized (ANON)');
  app.set('supabaseConfigured', true);
} else if (SUPABASE_URL && SUPABASE_KEY) {
  // Fallback: initialize with service role key if anon not available
  // Note: service role key cannot verify client JWTs via supabase.auth.getUser(token)
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.warn('Supabase client initialized with SERVICE key; auth verification may fail');
  app.set('supabaseConfigured', true);
} else {
  console.warn('Supabase not configured — set SUPABASE_URL and SUPABASE_ANON_KEY');
  app.set('supabaseConfigured', false);
}

// auth middleware factory (verifies Supabase JWT when configured)
const createAuth = require('./middleware/auth');
const requireRole = require('./middleware/requireRole');
const authMiddleware = createAuth(supabase);

// Optional: attach auth middleware to routes to populate `req.user`
app.use((req,res,next)=> authMiddleware(req,res,next));

// Basic health
app.get('/', (req, res) => {
  res.send('TorqueMind API running');
});

// Save a replay
app.post('/api/replay', async (req, res) => {
  const { userId, scenarioId, actions, result, confidence } = req.body;
  // if Supabase configured, require authenticated user
  if (app.get('supabaseConfigured')){
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    // prefer authenticated user id when available
    const uid = req.user.id || userId;
    if (!uid || typeof scenarioId === 'undefined') return res.status(400).json({ error: 'userId and scenarioId required' });
    try {
      const payload = { user_id: uid, scenario_id: scenarioId, actions: actions || [], result: result || null, confidence: confidence || null };
      const { data, error } = await supabase.from('replays').insert([payload]);
      if (error) throw error;
      return res.json({ success: true, replay: data && data[0] });
    } catch (e){ console.error('Failed to save replay', e); return res.status(500).json({ error: e.message || String(e) }); }
  }
  // fallback: supabase not configured — accept and return success for local flow
  return res.json({ success: true, replay: { userId, scenarioId, actions, result, confidence } });
});

// Teacher: aggregated data for dashboard
app.get('/api/teacher/data', authMiddleware, requireRole('teacher'), async (req, res) => {
  if (!supabase) return res.status(501).json({ error: 'Supabase not configured' });
  const classId = req.query.classId || null;
  try {
    if (!classId) {
      // return full data as before
      const [{ data: users }, { data: replays }, { data: assignments }, { data: completions }, { data: classes }, { data: enrollments }] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('replays').select('*'),
        supabase.from('assignments').select('*'),
        supabase.from('completions').select('*'),
        supabase.from('classes').select('*'),
        supabase.from('enrollments').select('*')
      ]);
      return res.json({ users, replays, assignments, completions, classes, enrollments });
    }

    // class-scoped: find enrollments for the class to identify students
    const { data: enrolls, error: eErr } = await supabase.from('enrollments').select('*').eq('class_id', classId);
    if (eErr) throw eErr;
    const userIds = (enrolls || []).map(r => r.user_id).filter(Boolean);

    // fetch users, replays, completions, assignments for that class
    const promises = [];
    promises.push(supabase.from('users').select('*').in('id', userIds));
    promises.push(supabase.from('replays').select('*').in('user_id', userIds));
    promises.push(supabase.from('completions').select('*').in('user_id', userIds));
    promises.push(supabase.from('assignments').select('*').eq('class_id', classId));
    const [{ data: users }, { data: replays }, { data: completions }, { data: assignments }] = await Promise.all(promises);

    // include class metadata
    const { data: classes } = await supabase.from('classes').select('*').eq('id', classId).maybeSingle();

    return res.json({ users: users || [], replays: replays || [], assignments: assignments || [], completions: completions || [], classes: classes ? [classes] : [], enrollments: enrolls || [] });
  } catch (e) {
    console.error('Failed to load teacher data', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
});

// Create an assignment
app.post('/api/assign', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { system, scenarioIds, studentIds, classId } = req.body;
  if (!system || !Array.isArray(scenarioIds)) return res.status(400).json({ error: 'system and scenarioIds required' });
  if (!supabase) return res.status(501).json({ error: 'Supabase not configured' });

  try {
    const payload = { system, scenario_ids: scenarioIds, assigned_to: studentIds || null, class_id: classId || null };
    const { data, error } = await supabase.from('assignments').insert([payload]);
    if (error) throw error;
    return res.json({ success: true, assignment: data && data[0] });
  } catch (e) {
    console.error('Failed to create assignment', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
});

// Mark completion
app.post('/api/complete', async (req, res) => {
  const { userId, scenarioId } = req.body;
  if (app.get('supabaseConfigured')){
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const uid = req.user.id || userId;
    if (!uid || typeof scenarioId === 'undefined') return res.status(400).json({ error: 'userId and scenarioId required' });
    try {
      const payload = { user_id: uid, scenario_id: scenarioId };
      const { data, error } = await supabase.from('completions').insert([payload]);
      if (error) throw error;
      return res.json({ success: true, completion: data && data[0] });
    } catch (e) { console.error('Failed to record completion', e); return res.status(500).json({ error: e.message || String(e) }); }
  }
  // fallback
  return res.json({ success: true, completion: { userId, scenarioId } });
});

// Helpers
function makeClassCode(){
  const s = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i=0;i<6;i++) out += s[Math.floor(Math.random()*s.length)];
  return out;
}

// Create a class (teacher)
app.post('/api/classes', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!supabase) {
    // fallback: return a local class object with generated id/code
    return res.json({ success: true, class: { id: `local-${Date.now()}`, name, class_code: makeClassCode(), owner_id: req.user && req.user.id } });
  }

  try {
    const payload = { name, owner_id: req.user.id, class_code: makeClassCode() };
    const { data, error } = await supabase.from('classes').insert([payload]);
    if (error) throw error;
    return res.json({ success: true, class: data && data[0] });
  } catch (e){ console.error('Failed to create class', e); return res.status(500).json({ error: e.message || String(e) }); }
});

// Get classes for teacher
app.get('/api/classes', authMiddleware, requireRole('teacher'), async (req, res) => {
  if (!supabase) return res.json({ classes: [] });
  try {
    const { data, error } = await supabase.from('classes').select('*').eq('owner_id', req.user.id);
    if (error) throw error;
    return res.json({ classes: data || [] });
  } catch (e){ console.error('Failed to load classes', e); return res.status(500).json({ error: e.message || String(e) }); }
});

// Find class by code (public lookup)
app.get('/api/classes/by-code/:code', async (req, res) => {
  const { code } = req.params;
  if (!supabase) return res.json({});
  try {
    const { data, error } = await supabase.from('classes').select('*').eq('class_code', code).maybeSingle();
    if (error) throw error;
    return res.json({ class: data || null });
  } catch (e){ console.error('Failed to lookup class by code', e); return res.status(500).json({ error: e.message || String(e) }); }
});

// Enroll in class (student joins by code) or teacher enrolls a student
app.post('/api/classes/:classId/enroll', async (req, res) => {
  const { classId } = req.params;
  const { code, userId } = req.body;
  if (!supabase) return res.json({ success: true, enrollment: { classId, userId: userId || (req.user && req.user.id) } });

  try {
    const { data: cls, error: cErr } = await supabase.from('classes').select('*').eq('id', classId).maybeSingle();
    if (cErr) throw cErr;
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    // Teacher may enroll arbitrary userId
    if (req.user && req.user.role === 'teacher' && userId){
      const { data, error } = await supabase.from('enrollments').insert([{ class_id: classId, user_id: userId }]);
      if (error) throw error;
      return res.json({ success: true, enrollment: data && data[0] });
    }

    // Student join-by-code
    if (!code) return res.status(400).json({ error: 'class code required to join' });
    if (code !== cls.class_code) return res.status(403).json({ error: 'Invalid class code' });
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const uid = req.user.id;
    const { data, error } = await supabase.from('enrollments').insert([{ class_id: classId, user_id: uid }]);
    if (error) throw error;
    return res.json({ success: true, enrollment: data && data[0] });
  } catch (e){ console.error('Failed to enroll', e); return res.status(500).json({ error: e.message || String(e) }); }
});

// Get students in a class (teacher)
app.get('/api/classes/:classId/students', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { classId } = req.params;
  if (!supabase) return res.json({ students: [] });
  try {
    const { data: enrolls, error: eErr } = await supabase.from('enrollments').select('user_id').eq('class_id', classId);
    if (eErr) throw eErr;
    const userIds = (enrolls || []).map(r=>r.user_id).filter(Boolean);
    if (userIds.length === 0) return res.json({ students: [] });
    const { data: students, error: uErr } = await supabase.from('users').select('*').in('id', userIds);
    if (uErr) throw uErr;
    return res.json({ students: students || [] });
  } catch (e){ console.error('Failed to list students', e); return res.status(500).json({ error: e.message || String(e) }); }
});

app.listen(PORT, () => {
  console.log(`TorqueMind API listening on port ${PORT}`);
});
