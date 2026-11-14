import { Router } from 'express';
import { ImagePromptService } from '../imagePromptService.js';
import { db } from '../db.js';

const router = Router();

/**
 * POST /api/image-prompt
 * Single standalone API to craft & share the visual prompt for a blog article
 */
router.post('/', (req, res) => {
  try {
    const { blogId, title, topic, excerpt, style, industry } = req.body || {};

    let effectiveTitle = title;
    let effectiveTopic = topic;
    let effectiveExcerpt = excerpt;
    let effectiveIndustry = industry;
    let existingPrompt = null;

    if (blogId) {
      const blog = db.getBlogById(blogId);
      if (blog) {
        effectiveTitle = blog.title;
        effectiveTopic = blog.topic;
        effectiveExcerpt = blog.excerpt;
        existingPrompt = blog.image_prompt;
      }
    }

    if (!effectiveTitle && !effectiveTopic) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either blogId or title/topic to craft an image prompt.'
      });
    }

    const promptData = ImagePromptService.generatePromptForBlog({
      title: effectiveTitle,
      topic: effectiveTopic,
      excerpt: effectiveExcerpt,
      style: style || 'Commercial Photography',
      industry: effectiveIndustry || ''
    });

    // If an existing prompt was saved on the blog and matches, share that
    if (existingPrompt && existingPrompt.trim().length > 10) {
      promptData.prompt = existingPrompt;
      promptData.sampleOpenAiPayload.prompt = existingPrompt;
    }

    res.status(200).json({
      success: true,
      imagePrompt: promptData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to craft image prompt'
    });
  }
});

export default router;
