import { db } from './db.js';
import { AiService } from './aiService.js';
import { ImagePromptService } from './imagePromptService.js';

let workerInterval = null;
let isExecuting = false;

export class SchedulerService {
  /**
   * Calculate next run time based on frequency
   */
  static calculateNextRun(frequency, preferredTime = '09:00', fromDate = new Date()) {
    const base = new Date(fromDate);
    let hours = 9;
    let minutes = 0;

    if (preferredTime) {
      const match = String(preferredTime).match(/(\d{1,2}):(\d{2})(?:\s*([AP]M))?/i);
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        const ampm = match[3]?.toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    }

    const target = new Date(base);
    target.setHours(hours, minutes, 0, 0);

    if (target.getTime() <= base.getTime()) {
      if (frequency === 'daily') {
        target.setDate(target.getDate() + 1);
      } else if (frequency === 'weekly') {
        target.setDate(target.getDate() + 7);
      } else if (frequency === 'monthly') {
        target.setMonth(target.getMonth() + 1);
      }
    }

    return target.toISOString();
  }

  /**
   * Pick a brand new, trending topic that has NOT been used in past blogs
   */
  static async discoverUniqueTrendingTopic(schedule = {}) {
    // 1. Fetch previously covered topics
    const pastBlogs = db.query('SELECT topic, title FROM blogs ORDER BY published_at DESC LIMIT 50');
    const existingTopics = new Set();
    for (const b of pastBlogs) {
      if (b.topic) existingTopics.add(b.topic.trim().toLowerCase());
      if (b.title) existingTopics.add(b.title.trim().toLowerCase());
    }

    const business = schedule.business_name || 'Modern Growth Enterprise';
    const industry = schedule.business_industry || 'Professional Services & Technology';
    const description = schedule.business_description || 'High-performance products, services, and solutions';

    const prompt = `You are a chief content strategist for ${business} in the ${industry} space.
Business description: ${description}.

ALREADY PUBLISHED TOPICS (CRITICAL RULE: DO NOT REPEAT OR DUPLICATE ANY OF THESE UNDER ANY CIRCUMSTANCES):
${Array.from(existingTopics).length > 0 ? Array.from(existingTopics).map(t => `- "${t}"`).join('\n') : 'No previous topics.'}

Select ONE high-converting, trending, timely article topic for their official website blog.
Respond ONLY with a valid JSON object:
{
  "topic": "The selected new blog topic title (5 to 10 words, engaging and punchy)"
}`;

    try {
      const res = await AiService.generate(prompt);
      const match = res.rawText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.topic && !existingTopics.has(parsed.topic.trim().toLowerCase())) {
          return parsed.topic.trim();
        }
      }
    } catch (err) {
      console.warn('[SchedulerService] AI topic discovery fallback:', err.message);
    }

    // Dynamic emergency fallback
    const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const candidates = [
      `Essential Innovations Shaping ${industry} in ${monthYear}`,
      `How Modern Clients Choose the Best ${industry} This Year`,
      `Common Myths in ${industry} and What Experts Recommend`,
      `The Complete Blueprint to Maximizing Efficiency and Value in ${business}`
    ];

    for (const cand of candidates) {
      if (!existingTopics.has(cand.toLowerCase())) return cand;
    }

    return `Strategic Trends and Solutions for ${business} (${monthYear})`;
  }

  /**
   * Generates a complete blog post and crafts its matching image prompt (NO pixel generation)
   */
  static async generateAndPublishBlog({
    topic,
    scheduleId = null,
    businessName = '',
    businessIndustry = '',
    tone = 'Professional',
    language = 'English',
    length = 'Medium (800-1200w)'
  }) {
    const startTime = Date.now();
    console.log(`[SchedulerService] Generating blog for topic: "${topic}"...`);

    const prompt = `ROLE:
You are an elite SEO content writer and industry copywriter.

OBJECTIVE:
Write a comprehensive, publication-ready SEO blog article.

TOPIC:
${topic}

BUSINESS PROFILE:
Business: ${businessName || 'Modern Growth Enterprise'}
Industry: ${businessIndustry || 'Professional Services'}

SPECIFICATIONS:
- Language: ${language}
- Tone: ${tone}
- Target Length: ${length}
- Target Channel: Website / Blog

FORMATTING GUIDELINES:
- Structure with clear Markdown headings (# Title, ## Section, ### Subsections).
- Include an attention-grabbing introduction and a forward-looking conclusion.
- Provide actionable takeaways with bullet points or checklists.
- Include a structured FAQ section with 2-3 common client questions.

OUTPUT FORMAT:
Respond ONLY with a valid JSON object conforming exactly to this schema:
{
  "title": "Engaging Article Title",
  "body": "Full Markdown article text with #, ##, ### headings, bullet points, and conclusion",
  "excerpt": "Compelling 2-sentence summary of the article",
  "metaTitle": "SEO optimized title (under 60 characters)",
  "metaDescription": "SEO meta description (under 160 characters)",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "faq": [
    { "question": "...", "answer": "..." }
  ]
}`;

    const aiRes = await AiService.generate(prompt);
    let parsed = {};
    try {
      const match = aiRes.rawText.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    } catch {
      parsed = {};
    }

    const title = parsed.title || topic;
    const body = parsed.body || `## Introduction\nWelcome to our guide on **${topic}**.\n\n### Key Strategies\n- Master the fundamentals.\n- Stay consistent with execution.\n\n## Conclusion\nContinuous improvement is the key to sustainable success.`;
    const excerpt = parsed.excerpt || `Explore essential strategies and practical insights on ${topic}.`;
    const metaTitle = parsed.metaTitle || title;
    const metaDescription = parsed.metaDescription || excerpt;
    const keywords = JSON.stringify(parsed.keywords || [topic, 'guide', 'best practices']);
    const faq = JSON.stringify(parsed.faq || []);

    // Craft matching visual prompt for this blog article
    const imageBlueprint = ImagePromptService.generatePromptForBlog({
      title,
      topic,
      excerpt,
      industry: businessIndustry
    });

    // Create unique slug
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    const wordCount = body.split(/\s+/).length;
    const readingTimeMinutes = Math.max(2, Math.ceil(wordCount / 200));

    const blogId = `blg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    // Insert into blogs table
    db.execute(`
      INSERT INTO blogs (
        id, schedule_id, title, topic, slug, body, excerpt,
        meta_title, meta_description, keywords, faq,
        image_prompt, reading_time_minutes, view_count, published_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `, [
      blogId,
      scheduleId || null,
      title,
      topic,
      slug,
      body,
      excerpt,
      metaTitle,
      metaDescription,
      keywords,
      faq,
      imageBlueprint.prompt,
      readingTimeMinutes,
      now,
      now
    ]);

    // If attached to a schedule, update schedule status and log run
    if (scheduleId) {
      const schedule = db.queryOne('SELECT * FROM schedules WHERE id = ?', [scheduleId]);
      if (schedule) {
        const nextRun = this.calculateNextRun(schedule.frequency, schedule.preferred_time, new Date());
        db.execute(`
          UPDATE schedules 
          SET last_run_at = ?, next_run_at = ?, total_posts = total_posts + 1, updated_at = ?
          WHERE id = ?
        `, [now, nextRun, now, scheduleId]);

        const logId = `slog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        db.execute(`
          INSERT INTO schedule_logs (id, schedule_id, topic, status, blog_id, duration_ms, created_at)
          VALUES (?, ?, ?, 'success', ?, ?, ?)
        `, [logId, scheduleId, topic, blogId, Date.now() - startTime, now]);
      }
    }

    const created = db.queryOne('SELECT * FROM blogs WHERE id = ?', [blogId]);
    return {
      ...created,
      image_prompt: imageBlueprint.prompt,
      image_prompt_details: imageBlueprint
    };
  }

  /**
   * Run an existing schedule on-demand
   */
  static async runScheduleNow(scheduleId) {
    const schedule = db.queryOne('SELECT * FROM schedules WHERE id = ?', [scheduleId]);
    if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

    const topic = await this.discoverUniqueTrendingTopic(schedule);

    const blog = await this.generateAndPublishBlog({
      topic,
      scheduleId: schedule.id,
      businessName: schedule.business_name,
      businessIndustry: schedule.business_industry,
      tone: schedule.tone,
      language: schedule.language
    });

    return blog;
  }

  /**
   * Check and execute due schedules
   */
  static async processDueSchedules() {
    if (isExecuting) return;
    isExecuting = true;

    try {
      const nowIso = new Date().toISOString();
      const due = db.query(`
        SELECT * FROM schedules 
        WHERE status = 'active' AND next_run_at <= ?
        ORDER BY next_run_at ASC
        LIMIT 5
      `, [nowIso]);

      if (due.length > 0) {
        console.log(`[SchedulerWorker] Found ${due.length} due schedule(s) to run...`);
        for (const item of due) {
          try {
            console.log(`[SchedulerWorker] Auto-posting for "${item.name}"...`);
            await this.runScheduleNow(item.id);
          } catch (err) {
            console.error(`[SchedulerWorker] Schedule ${item.id} error:`, err.message);
            // Push next_run_at by 1 hour on error
            const retry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
            db.execute('UPDATE schedules SET next_run_at = ? WHERE id = ?', [retry, item.id]);
          }
        }
      }
    } catch (err) {
      console.error('[SchedulerWorker] Polling error:', err.message);
    } finally {
      isExecuting = false;
    }
  }

  /**
   * Start recurring background worker
   */
  static startSchedulerWorker(intervalMs = 60000) {
    if (workerInterval) return;
    console.log(`[SchedulerWorker] 🕒 Auto-post scheduler active (polling every ${intervalMs / 1000}s)`);

    // Run first check after 4 seconds
    setTimeout(() => {
      this.processDueSchedules().catch(() => {});
    }, 4000);

    workerInterval = setInterval(() => {
      this.processDueSchedules().catch(() => {});
    }, intervalMs);
  }

  static stopSchedulerWorker() {
    if (workerInterval) {
      clearInterval(workerInterval);
      workerInterval = null;
    }
  }
}
