const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
async function run() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro', generationConfig: { responseMimeType: 'application/json' } });
    const systemPrompt = `You are an AI architect generating a flowchart based on the user's codebase.
    
    The user asked: "Explain authentication"
    
    Project Files:
    --- src/auth.ts ---
    export function login() {}
    
    You must output a JSON object with exactly two arrays: "shapes" and "arrows".
    
    "shapes" is an array of objects:
    {
       "id": string (unique node ID),
       "label": string (short description, e.g., "React App" or "Auth Service"),
       "type": "rect" or "circle"
    }
    
    "arrows" is an array of objects representing directed edges between shapes:
    {
       "id": string (unique arrow ID),
       "fromId": string (matches a shape id),
       "toId": string (matches a shape id)
    }
    
    Keep the flowchart concise and focused directly on what the user asked. Only output valid JSON conforming to this schema.`;
    const result = await model.generateContent(systemPrompt);
    let responseText = result.response.text();
    console.log('Raw response:', responseText);
    
    // Test the cleanup regex
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log('Cleaned response:', responseText);
    
    const parsedData = JSON.parse(responseText);
    console.log('Parsed successfully:', parsedData);
  } catch (e) {
    console.error('Error:', e);
  }
}
run();
