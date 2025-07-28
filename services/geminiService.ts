import { CONFIG } from '../utils/config';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  description?: string;
  color: string;
}

interface ReminderSuggestion {
  id: string;
  title: string;
  category: string;
  isOutdoor: boolean;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  suggestedDate?: string;
  relatedEvent?: string;
}

class GeminiService {
  private apiKey: string;
  // Updated to use Gemini 2.0 Flash model
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

  constructor() {
    this.apiKey = CONFIG.GEMINI_API_KEY;
    
    if (!this.apiKey || this.apiKey === 'your_actual_api_key_here') {
      console.error('❌ Gemini API key not configured properly');
    }
  }

  async generateReminderSuggestions(events: CalendarEvent[]): Promise<ReminderSuggestion[]> {
    try {
      console.log('🚀 Using Gemini 2.0 Flash (Free)...');
      
      if (!this.apiKey || this.apiKey === 'your_actual_api_key_here') {
        console.error('❌ Invalid API key');
        return this.getFallbackSuggestions(events);
      }
      
      const prompt = this.createOptimizedPrompt(events);
      
      // Optimized settings for Gemini 2.0 Flash
      const requestBody = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 0.9,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      console.log('🌐 Making Gemini 2.0 Flash API request...');
      console.log('🔑 Using API key (first 10 chars):', this.apiKey.substring(0, 10) + '...');
      
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📡 Gemini 2.0 Flash Response status:', response.status);

      if (response.status === 403) {
        const errorText = await response.text();
        console.error('❌ 403 Error details:', errorText);
        
        if (errorText.includes('API_KEY_INVALID')) {
          console.error('🔑 API Key Issues:');
          console.error('   1. Get a free key from: https://aistudio.google.com/app/apikey');
          console.error('   2. Make sure to enable Gemini API');
          console.error('   3. Check your quota limits');
        }
        
        return this.getFallbackSuggestions(events);
      }

      if (response.status === 429) {
        console.error('⏰ Rate limit exceeded (Free tier limit reached)');
        return this.getFallbackSuggestions(events);
      }

      if (response.status === 400) {
        const errorText = await response.text();
        console.error('❌ 400 Bad Request:', errorText);
        
        if (errorText.includes('model not found')) {
          console.error('🤖 Model not available, trying fallback model...');
          return this.tryFallbackModel(events);
        }
        
        return this.getFallbackSuggestions(events);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error ${response.status}:`, errorText);
        return this.getFallbackSuggestions(events);
      }

      const data = await response.json();
      console.log('✅ Gemini 2.0 Flash Response received');
      
      if (!data.candidates || data.candidates.length === 0) {
        console.error('❌ No candidates in response');
        return this.getFallbackSuggestions(events);
      }

      const generatedText = data.candidates[0]?.content?.parts[0]?.text;
      
      if (!generatedText) {
        console.error('❌ No generated text');
        return this.getFallbackSuggestions(events);
      }

      console.log('📄 AI Generated suggestions:', generatedText.substring(0, 200) + '...');
      
      return this.parseReminderSuggestions(generatedText, events);
    } catch (error) {
      console.error('❌ Network/Other Error:', error);
      return this.getFallbackSuggestions(events);
    }
  }

  // Fallback to stable model if 2.0 Flash experimental isn't available
  private async tryFallbackModel(events: CalendarEvent[]): Promise<ReminderSuggestion[]> {
    try {
      console.log('🔄 Trying Gemini 1.5 Flash as fallback...');
      
      const fallbackUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
      const prompt = this.createOptimizedPrompt(events);
      
      const response = await fetch(`${fallbackUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024,
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const generatedText = data.candidates[0]?.content?.parts[0]?.text;
        if (generatedText) {
          console.log('✅ Fallback model worked');
          return this.parseReminderSuggestions(generatedText, events);
        }
      }
      
      return this.getFallbackSuggestions(events);
    } catch (error) {
      console.error('❌ Fallback model also failed:', error);
      return this.getFallbackSuggestions(events);
    }
  }

  private createOptimizedPrompt(events: CalendarEvent[]): string {
    if (events.length === 0) {
      return `Generate 2 helpful reminder suggestions in this exact JSON format:
[
  {"title": "Review daily schedule", "category": "Personal", "isOutdoor": false, "reason": "Stay organized and prepared", "priority": "medium"},
  {"title": "Prepare for tomorrow", "category": "Personal", "isOutdoor": false, "reason": "Set yourself up for success", "priority": "high"}
]

Only return the JSON array, nothing else.`;
    }

    const eventsText = events.slice(0, 5).map(event => 
      `"${event.title}" on ${event.date} at ${event.time}`
    ).join(', ');

    return `Based on these calendar events: ${eventsText}

Generate 3 practical reminder suggestions in this exact JSON format:
[
  {"title": "Example reminder", "category": "Work", "isOutdoor": false, "reason": "Helpful explanation", "priority": "high"}
]

Rules:
- Categories MUST be: "Personal", "Work", or "Travel"
- Priority MUST be: "high", "medium", or "low"
- isOutdoor MUST be: true or false
- Focus on preparation, follow-up tasks, or practical needs
- Keep titles short and actionable
- Return ONLY the JSON array, no other text

Examples of good reminders:
- "Buy presentation materials" (for meetings)
- "Check weather forecast" (for outdoor events)
- "Pack documents" (for travel)
- "Send follow-up emails" (after meetings)`;
  }

  private parseReminderSuggestions(generatedText: string, events: CalendarEvent[]): ReminderSuggestion[] {
    try {
      let cleanText = generatedText.trim();
      
      // Remove any markdown formatting
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      cleanText = cleanText.replace(/```\n?/g, '');
      
      // Find JSON array - be more flexible with matching
      let jsonMatch = cleanText.match(/\[[\s\S]*?\]/);
      
      if (!jsonMatch) {
        // Try to find JSON object and wrap it in array
        const objMatch = cleanText.match(/\{[\s\S]*?\}/);
        if (objMatch) {
          cleanText = `[${objMatch[0]}]`;
          jsonMatch = [cleanText];
        }
      }
      
      if (!jsonMatch) {
        console.error('❌ No JSON found in response:', cleanText.substring(0, 200));
        return this.getFallbackSuggestions(events);
      }

      const suggestions = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(suggestions)) {
        console.error('❌ Parsed result is not an array');
        return this.getFallbackSuggestions(events);
      }

      console.log(`✅ Successfully parsed ${suggestions.length} AI suggestions`);

      return suggestions.map((suggestion, index) => ({
        id: `gemini2_${Date.now()}_${index}`,
        title: suggestion.title || 'AI Reminder',
        category: this.validateCategory(suggestion.category),
        isOutdoor: Boolean(suggestion.isOutdoor),
        reason: suggestion.reason || 'AI generated suggestion',
        priority: this.validatePriority(suggestion.priority),
        relatedEvent: this.findRelatedEvent(suggestion.title, events) || events[0]?.title || 'Calendar event'
      }));
    } catch (error) {
      console.error('❌ JSON parsing error:', error);
      console.error('Raw text:', generatedText.substring(0, 300));
      return this.getFallbackSuggestions(events);
    }
  }

  private findRelatedEvent(suggestionTitle: string, events: CalendarEvent[]): string | undefined {
    const title = suggestionTitle.toLowerCase();
    return events.find(event => 
      title.includes(event.title.toLowerCase()) || 
      event.title.toLowerCase().includes(title.split(' ')[0])
    )?.title;
  }

  private getFallbackSuggestions(events: CalendarEvent[]): ReminderSuggestion[] {
    console.log('🔄 Using high-quality fallback suggestions');
    
    const baseSuggestions: ReminderSuggestion[] = [
      {
        id: `fallback_${Date.now()}_1`,
        title: "Review tomorrow's schedule",
        category: "Personal",
        isOutdoor: false,
        reason: "Stay prepared and organized for upcoming events",
        priority: "medium" as const,
        relatedEvent: "Daily planning"
      },
      {
        id: `fallback_${Date.now()}_2`,
        title: "Prepare meeting materials",
        category: "Work",
        isOutdoor: false,
        reason: "Ensure you have everything needed for success",
        priority: "high" as const,
        relatedEvent: events.find(e => e.title.toLowerCase().includes('meeting'))?.title || "Work events"
      },
      {
        id: `fallback_${Date.now()}_3`,
        title: "Check weather forecast",
        category: "Personal",
        isOutdoor: true,
        reason: "Plan accordingly for outdoor activities",
        priority: "low" as const,
        relatedEvent: events.find(e => 
          e.description?.toLowerCase().includes('outdoor') ||
          e.title.toLowerCase().includes('outdoor')
        )?.title || "Outdoor planning"
      }
    ];

    // Return relevant suggestions based on events
    return baseSuggestions.slice(0, Math.min(3, events.length + 1));
  }

  private validateCategory(category: string): string {
    const valid = ['Personal', 'Work', 'Travel'];
    return valid.includes(category) ? category : 'Personal';
  }

  private validatePriority(priority: string): 'high' | 'medium' | 'low' {
    const valid = ['high', 'medium', 'low'];
    return valid.includes(priority) ? priority as 'high' | 'medium' | 'low' : 'medium';
  }

  // Test API connection with Gemini 2.0 Flash
  async testConnection(): Promise<{ success: boolean; model: string; error?: string }> {
    try {
      console.log('🧪 Testing Gemini 2.0 Flash connection...');
      
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hello! Just testing the connection." }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      });

      if (response.ok) {
        return { success: true, model: 'Gemini 2.0 Flash' };
      } else if (response.status === 403) {
        return { success: false, model: 'Unknown', error: 'Invalid API key or permissions' };
      } else if (response.status === 400) {
        // Try fallback model
        console.log('🔄 Testing Gemini 1.5 Flash fallback...');
        const fallbackResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "Hello!" }] }]
            })
          }
        );
        
        if (fallbackResponse.ok) {
          return { success: true, model: 'Gemini 1.5 Flash (fallback)' };
        }
      }
      
      return { success: false, model: 'Unknown', error: `HTTP ${response.status}` };
    } catch (error) {
      return { success: false, model: 'Unknown', error: `Network error: ${error}` };
    }
  }
}

export default GeminiService;
export type { ReminderSuggestion };