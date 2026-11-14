export class ImagePromptService {
  /**
   * Cleans editorial headline fluff from subject
   */
  static cleanSubject(rawText) {
    return (rawText || '')
      .replace(/["'“”‘’«»()[\]{}:;!?]/g, ' ')
      .replace(/\b(?:\d+|top\s+\d+|best\s+\d+)\s+(?:ways|tips|strategies|steps|rules|secrets|methods|practices)\s+(?:to|for)?\b/gi, '')
      .replace(/\b(?:the\s+definitive\s+guide\s+to|the\s+ultimate\s+guide\s+to|everything\s+you\s+need\s+to\s+know\s+about|step\s+by\s+step\s+guide\s+to|a\s+complete\s+guide\s+to|a\s+guide\s+to|guide\s+to)\b/gi, '')
      .replace(/\b(?:how\s+to\s+(?:cure|fix|treat|overcome|get|build|start|use|master|scale|optimize))\b/gi, '')
      .replace(/\b(?:understanding|exploring|discovering|navigating|mastering|unveiling|demystifying|optimizing|enhancing|transforming|introducing|unlocking|revolutionizing)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Crafts an expert visual image prompt specifically for a blog article
   */
  static generatePromptForBlog({ title, topic, excerpt, style = 'Commercial Photography', industry = '' }) {
    const rawSubject = title || topic || 'Modern Business Innovation';
    let subject = this.cleanSubject(rawSubject);
    if (!subject || subject.length < 3) subject = topic || 'Modern Professional Growth';

    const industryContext = industry ? ` in the context of ${industry}` : '';

    const styleDescriptors = {
      'Commercial Photography': 'professional commercial photography, studio softbox lighting, clean composition, high-end commercial aesthetic, ultra-detailed',
      'Editorial': 'editorial magazine quality, award-winning composition, narrative depth, artistic lighting, sophisticated styling',
      'Minimal': 'minimalist design, clean lines, abundant negative space, elegant composition, muted sophisticated color palette',
      '3D Render': 'octane 3D render, raytraced lighting, subsurface scattering, 8k resolution, photorealistic CGI, volumetric light',
      'Realistic': 'realistic photography, natural lighting, high dynamic range, authentic textures, true-to-life details, 8k uhd'
    };

    const chosenStyle = styleDescriptors[style] || styleDescriptors['Commercial Photography'];

    // Construct the complete visual prompt
    const visualPrompt = `Aesthetic hero banner visual of ${subject}${industryContext}, clean modern composition, natural studio lighting, ${chosenStyle}, cinematic depth of field, 8k uhd, photorealistic, textless, no watermark, no text overlays`;

    return {
      prompt: visualPrompt,
      aspectRatio: '16:9',
      recommendedDimensions: {
        width: 1280,
        height: 720
      },
      style,
      negativePrompt: 'text, typography, words, letters, font, watermark, logo, label, signature, headline, blurry, low quality, distorted, deformed, duplicate objects, bad anatomy, artifact',
      sampleOpenAiPayload: {
        model: 'dall-e-3',
        prompt: visualPrompt,
        size: '1792x1024',
        quality: 'standard',
        n: 1
      }
    };
  }
}
