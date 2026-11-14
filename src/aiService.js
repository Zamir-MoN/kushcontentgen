import { config } from './config.js';

export class AiService {
  /**
   * Generates structured text response from AI with multi-model failover
   */
  static async generate(prompt) {
    const startTime = Date.now();
    const apiKey = config.gemini.apiKey;

    if (!apiKey) {
      console.warn('[AiService] No GEMINI_API_KEY set. Generating intelligent simulated content.');
      return this.generateFallback(prompt, startTime);
    }

    // Modern active Gemini models to try with fast timeouts
    const candidateModels = [config.gemini.model, 'gemini-3.5-flash-lite', 'gemini-flash-latest'];
    const uniqueModels = [...new Set(candidateModels)];

    let lastError = null;

    for (const model of uniqueModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
              maxOutputTokens: 8192
            }
          }),
          signal: AbortSignal.timeout(12000)
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const rawText = data.candidates[0].content.parts[0].text;
          return {
            rawText,
            model,
            durationMs: Date.now() - startTime
          };
        } else {
          lastError = new Error(data.error?.message || `HTTP ${response.status} with ${model}`);
        }
      } catch (err) {
        lastError = err;
      }
    }

    // If Gemini fails or times out, utilize fast resilient local generator
    console.warn(`[AiService] Gemini unavailable (${lastError?.message || 'offline'}). Utilizing resilient local generator.`);
    return this.generateFallback(prompt, startTime);
  }

  static generateFallback(prompt, startTime) {
    const topicMatch = prompt.match(/TOPIC:\s*\n([^\n]+)/i);
    const topic = topicMatch ? topicMatch[1].trim() : 'Modern Industry Innovations';

    const fallbackJson = {
      title: `${topic}: The Complete Strategic Playbook`,
      body: `## Introduction\nIn today's fast-moving market, **${topic}** has become an indispensable advantage. Organizations and individuals that embrace modern best practices consistently outperform competitors.\n\n### Core Pillars for Success\n1. **Data-Informed Prioritization**: Focus on high-leverage workflows.\n2. **Consistency & Quality**: Establish repeatable standards across every touchpoint.\n3. **Modern Tooling**: Leverage next-generation automation to reduce manual drag.\n\n### Actionable Step-by-Step Checklist\n- [x] Audit existing baseline operations.\n- [x] Implement structured feedback loops weekly.\n- [x] Measure tangible progress against key indicators.\n\n## Conclusion\nMastering **${topic}** creates lasting momentum. Start by applying one core lesson today and scale your results over time.`,
      excerpt: `Discover practical insights, proven frameworks, and step-by-step strategies for ${topic}.`,
      metaTitle: `${topic} - Essential Guide & Best Practices`,
      metaDescription: `Comprehensive overview of ${topic} with actionable advice, key pillars, and practical checklists.`,
      keywords: [topic, 'strategy', 'best practices', 'guide'],
      faq: [
        {
          question: `Why is ${topic} crucial right now?`,
          answer: `It directly influences efficiency, customer satisfaction, and long-term sustainable growth.`
        },
        {
          question: `How quickly can we see improvements?`,
          answer: `Most teams observe meaningful progress within 2 to 4 weeks of focused implementation.`
        }
      ]
    };

    return {
      rawText: JSON.stringify(fallbackJson),
      model: 'Simulated Local Fallback',
      durationMs: Date.now() - startTime
    };
  }
}
