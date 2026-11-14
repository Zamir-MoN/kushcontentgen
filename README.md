# 📝 Blog Content Generator & Auto-Poster

A dedicated, standalone microservice built strictly and exclusively for **Blog Content Generation, Scheduling, and Auto-Posting**.

---

## 🌟 Core Capabilities

1. **Pure Content Generation**:
   - Generates publication-ready SEO blog articles in full markdown format.
   - Generates structured metadata, reading times, summaries, and FAQ schema.
   - Zero image generation clutter or rendering overhead.

2. **Autonomous Auto-Posting & Scheduling**:
   - Set recurring posting cadences (Daily, Weekly, Monthly) with custom post times.
   - Automatically discovers trending topics tailored to your business name and industry niche.
   - Deduplicates topics against past published posts so content is always fresh.

3. **Publication Feed & Content API**:
   - Live website blog feed of all published articles.
   - Direct REST endpoint `POST /api/blogs/generate` for on-demand article generation from external CMS systems, agents, or webhooks.

---

## 🚀 Quick Start

### 1. Install & Configure
```bash
cd blog-autoposter
npm install
```

Configure `.env`:
```env
PORT=4000
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash
```

### 2. Start the Server
```bash
npm start
```

Access the interactive content dashboard at: **`http://localhost:4000`**

---

## 📡 REST API Reference

### 1. Generate & Publish Blog Article (`POST /api/blogs/generate`)
```http
POST http://localhost:4000/api/blogs/generate
Content-Type: application/json

{
  "topic": "Essential Daily Dental Hygiene Routines",
  "tone": "Educational",
  "length": "Standard (~1,000 words)",
  "businessName": "Apex Dental",
  "businessIndustry": "Dentistry"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Blog generated and published successfully!",
  "blog": {
    "id": "blg_1794692980097_dn8yzx",
    "title": "Essential Daily Dental Hygiene Routines",
    "slug": "essential-daily-dental-hygiene-routines",
    "excerpt": "A comprehensive guide to daily oral hygiene...",
    "body": "# Essential Daily Dental Hygiene Routines\n\nMaintaining oral health...",
    "reading_time_minutes": 5,
    "faq": "[{\"question\":\"How often should I brush?\",\"answer\":\"Twice daily...\"}]",
    "created_at": "2026-11-15T03:19:40.097Z"
  }
}
```

---

### 2. Auto-Post Schedules (`POST /api/schedules`)
Create a recurring automated publishing schedule:
```http
POST http://localhost:4000/api/schedules
Content-Type: application/json

{
  "business_name": "Apex Dental",
  "business_industry": "Dentistry & Oral Health",
  "frequency": "daily",
  "preferred_time": "09:00",
  "tone": "Educational",
  "status": "active"
}
```

---

### 3. List Published Articles (`GET /api/blogs`)
```http
GET http://localhost:4000/api/blogs
```
Returns all published blog articles with pagination and search.

---

### 4. Health Probe (`GET /api/health`)
```http
GET http://localhost:4000/api/health
```
