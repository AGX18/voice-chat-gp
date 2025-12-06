import 'dotenv/config';

async function listModels() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not found in environment variables");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log("Available Flash Models:");
    console.log("-".repeat(50));
    
    const flashModels = data.models?.filter(m => 
      m.name?.includes("flash")
    ) || [];
    
    if (flashModels.length === 0) {
      console.log("No flash models found");
      return;
    }
    
    for (const m of flashModels) {
      console.log(`Name: ${m.name}`);
      if (m.displayName) console.log(`  Display Name: ${m.displayName}`);
      if (m.description) console.log(`  Description: ${m.description}`);
      if (m.supportedGenerationMethods) {
        console.log(`  Methods: ${m.supportedGenerationMethods.join(', ')}`);
      }
      console.log();
    }
    
  } catch (error) {
    console.error("Error fetching models:", error.message);
  }
}

listModels();