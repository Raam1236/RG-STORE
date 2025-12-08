import { GoogleGenAI, Type } from "@google/genai";
import { Product, Sale, Customer } from '../types';

const getGenAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Helper to clean AI output which might contain markdown code blocks
const parseAIResponse = (text: string) => {
    try {
        let cleaned = text.trim();
        // Remove markdown code blocks if present
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '');
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
        }
        return JSON.parse(cleaned);
    } catch (error) {
        console.error("Failed to parse AI JSON response:", text);
        return null;
    }
};

export const fetchMarketNews = async (): Promise<string> => {
  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "Generate a one-sentence fictional news headline about today's grocery market trends. Keep it professional.",
    });
    return response.text || "Market news currently unavailable.";
  } catch (error) {
    console.error("Error fetching market news:", error);
    return "Market news currently unavailable.";
  }
};

export const fetchPriceVariationSuggestion = async (): Promise<string> => {
  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "Generate a short, fictional market news update for retail grocery products. Format: 'News Headline.\nSUGGESTION: Increase/Decrease [Category] prices by X%'",
    });
    return response.text || "Could not fetch suggestion.";
  } catch (error) {
    console.error("Error fetching price variation:", error);
    return "Could not fetch price variation suggestion.";
  }
};

export const askShopAI = async (context: { products: Product[], sales: Sale[], customers: Customer[] }, question: string): Promise<string> => {
    try {
        const ai = getGenAI();
        const prompt = `
          System Instruction: You are "ProBot", a retail AI assistant. 
          Answer based ONLY on the data provided. Be concise.

          Data:
          ${JSON.stringify({
              productsCount: context.products.length,
              salesCount: context.sales.length,
              sampleProducts: context.products.slice(0, 20).map(p => p.name) 
          })}

          Question: ${question}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "I couldn't generate an answer.";
    } catch (error) {
        return "Sorry, I'm having trouble connecting to my brain right now.";
    }
};

export const analyzeImageForBilling = async (base64Image: string, products: Product[]): Promise<{ productId: string; quantity: number }[]> => {
    try {
      const ai = getGenAI();
      // Optimization: Only send necessary fields to save latency
      const productContext = products.map(p => ({ id: p.id, n: p.name, b: p.brand }));

      const prompt = `
        Identify grocery items in image. Match against inventory: ${JSON.stringify(productContext)}.
        Return JSON Array: [{"productId": "id", "quantity": 1}]
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt }
        ],
        config: { responseMimeType: 'application/json' }
      });
      
      const parsed = parseAIResponse(response.text || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Visual Billing Error:", error);
      return [];
    }
  }
  
  // OPTIMIZED VOICE COMMAND: Faster response time
  export const processVoiceCommand = async (transcript: string, products: Product[]): Promise<{ type: string; productId?: string; quantity?: number; discount?: number } | null> => {
      try {
          const ai = getGenAI();
          
          // Optimization: Minify product list (remove prices, dates, history) to reduce input token size significantly
          const productContext = products.map(p => ({ i: p.id, n: p.name }));

          const prompt = `
            Act as a POS Voice Parser. Map input to Intent.
            Input: "${transcript}"
            Inventory: ${JSON.stringify(productContext)}
            
            Intents:
            1. ADD: User wants to add item. Return { "type": "ADD_ITEM", "productId": "id", "quantity": number }. Handle weights (e.g. 500g of 1kg packet = 0.5).
            2. CHECKOUT: User wants to finish/pay. Return { "type": "CHECKOUT" }.
            3. CLEAR: Clear bill. Return { "type": "CLEAR_BILL" }.
            
            Return JSON ONLY.
          `;
  
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
              config: {
                  responseMimeType: 'application/json',
                  // Using 'thinkingBudget: 0' ensures fastest possible response without deep reasoning
                  thinkingConfig: { thinkingBudget: 0 } 
              }
          });
          
          return parseAIResponse(response.text || "{}");
      } catch (error) {
          console.error("Voice Command Error:", error);
          return null;
      }
  };
  
  export const generateSmartInsights = async (sales: Sale[], products: Product[]): Promise<{
      stockPrediction: string;
      staffPerformance: string;
      salesHeatmap: { productName: string; score: number }[];
  }> => {
      try {
          const ai = getGenAI();
          const recentSales = sales.slice(-20); 
          const productSummary = products.map(p => ({ name: p.name, stock: p.stock }));
  
          const prompt = `
            Analyze retail data.
            Sales: ${JSON.stringify(recentSales)}
            Stock: ${JSON.stringify(productSummary)}
            
            Provide JSON:
            {
              "stockPrediction": "Short text on stockout risks",
              "staffPerformance": "Short text on top employee",
              "salesHeatmap": [{"productName": "Name", "score": 85}]
            }
          `;
  
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });
  
          const parsed = parseAIResponse(response.text || "{}");
          return parsed || { stockPrediction: "No data", staffPerformance: "No data", salesHeatmap: [] };
      } catch (error) {
          return {
              stockPrediction: "Unavailable",
              staffPerformance: "Unavailable",
              salesHeatmap: []
          };
      }
  };

  export const analyzeCustomerFace = async (base64Image: string): Promise<string> => {
    try {
      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Describe face: Gender, Age, Features. Max 6 words." }
        ]
      });
      return response.text || "Customer detected";
    } catch (error) {
      return "Analysis unavailable";
    }
  };

  export const identifyCustomerFromImage = async (base64Image: string, customers: Customer[]): Promise<string | null> => {
    try {
        const ai = getGenAI();
        const candidateData = customers.filter(c => c.faceAttributes).map(c => ({ id: c.id, d: c.faceAttributes }));

        if (candidateData.length === 0) return null;

        const prompt = `
            Match face image to text descriptions: ${JSON.stringify(candidateData)}.
            Return JSON: { "matchedId": "id_or_null" }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: prompt }
            ],
            config: { responseMimeType: 'application/json' }
        });

        const parsed = parseAIResponse(response.text || "{}");
        return parsed?.matchedId || null;
    } catch (error) {
        return null;
    }
  };

  export const getSmartUpsellSuggestion = async (cartItemNames: string[]): Promise<string | null> => {
    if (cartItemNames.length === 0) return null;
    try {
        const ai = getGenAI();
        // Super short prompt for speed
        const prompt = `Suggest 1 grocery add-on for: ${cartItemNames.join(',')}. Max 3 words.`;
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text ? response.text.trim() : null;
    } catch (error) {
        return null;
    }
  };