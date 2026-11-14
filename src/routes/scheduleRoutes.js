import { Router } from 'express';
import { db } from '../db.js';
import { SchedulerService } from '../schedulerService.js';

const router = Router();

/**
 * GET /api/schedules
 * List all schedules
 */
router.get('/', (req, res) => {
  try {
    const schedules = db.query('SELECT * FROM schedules ORDER BY created_at DESC');
    res.json({ success: true, schedules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/schedules
 * Create a new recurring blog auto-post schedule
 */
router.post('/', (req, res) => {
  try {
    const {
      name,
      business_name,
      businessName,
      business_industry,
      businessIndustry,
      industry,
      business_description,
      businessDescription,
      frequency = 'daily',
      preferred_time,
      preferredTime,
      post_time,
      postTime = '09:00',
      tone = 'Professional',
      language = 'English',
      target_audience = '',
      status = 'active'
    } = req.body;

    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ success: false, error: 'Frequency must be daily, weekly, or monthly' });
    }

    const effectiveBizName = (business_name || businessName || '').trim();
    const effectiveIndustry = (business_industry || businessIndustry || industry || '').trim();
    const effectiveTime = (preferred_time || preferredTime || post_time || postTime || '09:00').trim();
    const effectiveDesc = (business_description || businessDescription || '').trim();
    const effectiveStatus = (status || 'active').toLowerCase() === 'paused' ? 'paused' : 'active';

    const id = `sch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const nextRun = SchedulerService.calculateNextRun(frequency, effectiveTime, new Date());
    const schedName = name?.trim() || `${effectiveBizName || 'Blog'} ${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Auto-Poster`;

    db.execute(`
      INSERT INTO schedules (
        id, name, business_name, business_industry, business_description,
        frequency, preferred_time, tone, language, target_audience,
        status, next_run_at, total_posts, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `, [
      id,
      schedName,
      effectiveBizName,
      effectiveIndustry,
      effectiveDesc,
      frequency,
      effectiveTime,
      tone,
      language,
      target_audience,
      effectiveStatus,
      nextRun,
      now,
      now
    ]);

    const created = db.queryOne('SELECT * FROM schedules WHERE id = ?', [id]);
    res.status(201).json({
      success: true,
      message: `Schedule created successfully! Next run at ${nextRun}`,
      schedule: created
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/schedules/logs
 * Audit history of scheduled auto-posts
 */
router.get('/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 30;
    const logs = db.query(`
      SELECT 
        l.*,
        s.name as schedule_name,
        s.frequency,
        b.title as blog_title,
        b.slug as blog_slug
      FROM schedule_logs l
      JOIN schedules s ON l.schedule_id = s.id
      LEFT JOIN blogs b ON l.blog_id = b.id
      ORDER BY l.created_at DESC
      LIMIT ?
    `, [limit]);

    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/schedules/:id
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const schedule = db.queryOne('SELECT * FROM schedules WHERE id = ?', [id]);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }
    const recentLogs = db.query('SELECT * FROM schedule_logs WHERE schedule_id = ? ORDER BY created_at DESC LIMIT 10', [id]);
    res.json({ success: true, schedule, recentLogs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/schedules/:id
 * Pause, resume, or update parameters
 */
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const schedule = db.queryOne('SELECT * FROM schedules WHERE id = ?', [id]);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    const {
      status,
      isActive,
      name,
      frequency,
      preferred_time,
      preferredTime,
      postTime,
      tone,
      language,
      business_name,
      businessName,
      business_industry,
      businessIndustry,
      industry
    } = req.body;
    const now = new Date().toISOString();

    const fields = ['updated_at = ?'];
    const params = [now];

    let effectiveStatus = status;
    if (isActive !== undefined) {
      effectiveStatus = (isActive === true || isActive === 1 || isActive === '1') ? 'active' : 'paused';
    }

    if (effectiveStatus && ['active', 'paused'].includes(effectiveStatus)) {
      fields.push('status = ?');
      params.push(effectiveStatus);
    }
    if (name) {
      fields.push('name = ?');
      params.push(name.trim());
    }
    const effectiveTime = preferred_time || preferredTime || postTime;
    if (frequency && ['daily', 'weekly', 'monthly'].includes(frequency)) {
      fields.push('frequency = ?');
      params.push(frequency);
      const nextRun = SchedulerService.calculateNextRun(frequency, effectiveTime || schedule.preferred_time);
      fields.push('next_run_at = ?');
      params.push(nextRun);
    }
    if (effectiveTime) {
      fields.push('preferred_time = ?');
      params.push(effectiveTime);
    }
    if (tone) {
      fields.push('tone = ?');
      params.push(tone);
    }
    if (language) {
      fields.push('language = ?');
      params.push(language);
    }
    const effectiveBiz = business_name !== undefined ? business_name : businessName;
    if (effectiveBiz !== undefined) {
      fields.push('business_name = ?');
      params.push(effectiveBiz);
    }
    const effectiveInd = business_industry !== undefined ? business_industry : (businessIndustry !== undefined ? businessIndustry : industry);
    if (effectiveInd !== undefined) {
      fields.push('business_industry = ?');
      params.push(effectiveInd);
    }

    params.push(id);
    db.execute(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`, params);

    const updated = db.queryOne('SELECT * FROM schedules WHERE id = ?', [id]);
    res.json({ success: true, message: 'Schedule updated successfully', schedule: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/schedules/:id
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.execute('DELETE FROM schedules WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }
    res.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/schedules/:id/run-now
 * Instantly triggers deduplicated trending topic discovery, blog generation, and publishing
 */
router.post('/:id/run-now', async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = db.queryOne('SELECT * FROM schedules WHERE id = ?', [id]);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    const blog = await SchedulerService.runScheduleNow(id);
    res.json({
      success: true,
      message: `Successfully generated and auto-posted: "${blog.title}"!`,
      blog,
      blogPost: blog
    });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
