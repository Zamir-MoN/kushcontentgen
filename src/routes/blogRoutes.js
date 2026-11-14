import { Router } from 'express';
import { db } from '../db.js';
import { SchedulerService } from '../schedulerService.js';

const router = Router();

/**
 * POST /api/blogs/generate
 * On-demand blog generation (returns full markdown content + crafted image prompt)
 */
router.post('/generate', async (req, res) => {
  try {
    const { topic, businessName, businessIndustry, tone, language, length } = req.body;
    if (!topic || !topic.trim()) {
      return res.status(400).json({ success: false, error: 'Topic is required' });
    }

    const blog = await SchedulerService.generateAndPublishBlog({
      topic: topic.trim(),
      businessName: businessName || '',
      businessIndustry: businessIndustry || '',
      tone: tone || 'Professional',
      language: language || 'English',
      length: length || 'Medium (800-1200w)'
    });

    res.status(201).json({
      success: true,
      message: 'Blog generated and published successfully!',
      blog
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/blogs
 * Public website blog feed (supports pagination and search)
 */
router.get('/', (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    let countSql = 'SELECT COUNT(*) as count FROM blogs';
    let querySql = 'SELECT * FROM blogs';
    const params = [];

    if (search) {
      countSql += ' WHERE title LIKE ? OR topic LIKE ? OR body LIKE ?';
      querySql += ' WHERE title LIKE ? OR topic LIKE ? OR body LIKE ?';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    querySql += ' ORDER BY published_at DESC LIMIT ? OFFSET ?';

    const countRow = db.queryOne(countSql, params);
    const total = countRow?.count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const blogs = db.query(querySql, [...params, limit, offset]).map(b => {
      try {
        b.image_prompt = JSON.parse(b.image_prompt);
      } catch { }
      return b;
    });

    res.json({
      success: true,
      data: blogs,
      pagination: {
        total,
        page,
        totalPages,
        limit
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/blogs/:slugOrId
 * Retrieve single blog post by slug or ID with view count tracking
 */
router.get('/:slugOrId', (req, res) => {
  try {
    const { slugOrId } = req.params;
    const blog = db.queryOne('SELECT * FROM blogs WHERE slug = ? OR id = ? LIMIT 1', [slugOrId, slugOrId]);

    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    // Increment view count
    db.execute('UPDATE blogs SET view_count = view_count + 1 WHERE id = ?', [blog.id]);

    try {
      blog.image_prompt = JSON.parse(blog.image_prompt);
      blog.keywords = JSON.parse(blog.keywords);
      blog.faq = JSON.parse(blog.faq);
    } catch { }

    res.json({
      success: true,
      blog
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/blogs/:id
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.execute('DELETE FROM blogs WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }
    res.json({ success: true, message: 'Blog deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

