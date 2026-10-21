const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "GEMINI_API_KEY is not configured on Netlify." }),
      };
    }

    const body = JSON.parse(event.body);
    const genAI = new GoogleGenerativeAI(apiKey);

    // List of models to try in order if high demand occurs
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"];
    
    let lastError = null;
    let responseText = "";

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        
        let result;
        if (body.image) {
          // Multimodal (Image + Prompt) request
          const imageParts = [
            {
              inlineData: {
                data: body.image.split(",")[1] || body.image,
                mimeType: body.mimeType || "image/jpeg",
              },
            },
          ];
          result = await model.generateContent([body.prompt || "Diagnose this crop leaf image.", ...imageParts]);
        } else {
          // Text-only request
          result = await model.generateContent(body.prompt);
        }

        responseText = result.response.text();
        if (responseText) break; // Successfully got a response!
      } catch (err) {
        console.warn(`Model ${modelName} failed or busy, trying next...`, err.message);
        lastError = err;
      }
    }

    if (!responseText) {
      throw lastError || new Error("All fallback models are currently busy.");
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: responseText }),
    };
  } catch (error) {
    console.error("Gemini API Function Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: "Google AI servers are experiencing extreme traffic across all models. Please retry in 1 minute." 
      }),
    };
  }
};