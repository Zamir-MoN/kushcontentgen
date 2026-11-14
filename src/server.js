import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import blogRoutes from './routes/blogRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import imagePromptRoutes from './routes/imagePromptRoutes.js';
import { SchedulerService } from './schedulerService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve standalone dashboard UI
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health probe
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'blog-autoposter',
    port: config.port,
    configuredModel: config.gemini.model,
    hasApiKey: Boolean(config.gemini.apiKey),
    timestamp: new Date().toISOString()
  });
});

// Mount specialized routes
app.use('/api/blogs', blogRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/image-prompt', imagePromptRoutes);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error('[BlogAutoPoster Error]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error in blog autoposter'
  });
});

// Start server and background auto-poster worker
const server = app.listen(config.port, () => {
  console.log('====================================================');
  console.log(`🚀 Blog Auto-Poster service running on http://localhost:${config.port}`);
  console.log(`📰 Blog Engine: Content Generation + Auto-Post Scheduler`);
  console.log(`🖼️ Single Image Prompt API: POST /api/image-prompt`);
  console.log(`🌐 Dashboard UI: http://localhost:${config.port}`);
  console.log('====================================================');

  // Start background auto-post worker (polls every 60 seconds)
  SchedulerService.startSchedulerWorker(60000);
});

export default app;
