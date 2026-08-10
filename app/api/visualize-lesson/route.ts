// app/api/visualize_lesson/route.ts
import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { Storage } from "@google-cloud/storage";

// Initialize Google Cloud Storage

// Helper function to upload base64 image to Google Cloud Storage
async function uploadBase64Image(base64Data: string, fileName: string): Promise<string> {
  const storage = new Storage({
    projectId: process.env.GOOGLE_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
  
  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'lumina-lesson-images';
  const bucket = storage.bucket(bucketName);
  try {
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    
    const file = bucket.file(fileName);
    
    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000',
      }
    });

    return `https://storage.googleapis.com/${bucketName}/${fileName}`;
  } catch (error) {
    console.error('Error uploading to GCS:', error);
    throw new Error('Failed to upload image to storage');
  }
}

// Helper function to generate unique file name
function generateFileName(sceneIndex: number): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `scene-${sceneIndex}-${timestamp}-${random}.png`;
}

async function generateImageWithRetry(
  imageModel: any, 
  prompt: string, 
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Generating image attempt ${attempt} for prompt: ${prompt.substring(0, 50)}...`);
      
      const image = await imageModel.generateContent({
        contents: [{ role: "user", parts: [{ text: `Generate an image for this prompt. Return ONLY the image, no conversational text Prompt:${prompt}` }] }],
      });

      // Safely extract the part
      const part = image.response?.candidates?.[0]?.content?.parts?.[0];
      
      if (!part) {
        throw new Error("No content parts returned from API");
      }

      // Check where the base64 data actually lives in the new Gemini Image response
      // It might be under inlineData, or it might be returned as a specialized image object
      let base64Img = part.inlineData?.data;
      
      // Fallback check: if the SDK wraps it differently (e.g., part.fileData or a raw buffer)
      if (!base64Img && (part as any).executableCode) {
         throw new Error("Model returned code instead of an image.");
      }

      if (!base64Img) {
        console.error("Full response part structure:", JSON.stringify(part, null, 2));
        throw new Error("Image generated, but base64 data could not be found in the expected 'inlineData' field.");
      }

      return `data:image/png;base64,${base64Img}`;
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`Image generation attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`Waiting ${backoffTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }
  
  throw lastError!;
}

// Process scenes sequentially with delays to avoid rate limiting
async function processScenesSequentially(
  scenes: any[], 
  imageModel: any
): Promise<any[]> {
  const results = [];
  
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    console.log(`Processing scene ${i + 1}/${scenes.length}`);
    
    try {
      // Generate image with retry logic
      const dataUrl = await generateImageWithRetry(imageModel, scene.imagePrompt);
      
      // Upload to GCS
      const fileName = generateFileName(i);
      const publicUrl = await uploadBase64Image(dataUrl, fileName);
      
      results.push({
        ...scene,
        image: publicUrl,
        fileName: fileName
      });
      
      // Add delay between scene processing to avoid rate limits
      if (i < scenes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
      
    } catch (error) {
      console.error(`Failed to process scene ${i + 1}:`, error);
      results.push({
        ...scene,
        image: null,
        imageUrl: null,
        fileName: null,
        error: `Failed to generate image: ${(error as Error).message}`
      });
    }
  }
  
  return results;
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // 1. Initialize Vertex AI
    const vertexAI = new VertexAI({
      project: process.env.GOOGLE_PROJECT_ID, 
      location: process.env.LOCATION || "us-central1",
    });

    const geminiModel = vertexAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    });

    const imageModel = vertexAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-image",
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.4,
      },
    });

    // 2. Define the Prompt for Gemini 2.5 Flash
    const prompt = `
You are a special educator AI for Lumina that helps visually, intellectually, and cognitively challenged learners understand lessons easily.

Your goals:
1. Simplify complex topics into child-friendly, easy-to-understand explanations.
2. Use **short sentences**, **everyday examples**, and **clear metaphors**.
3. Break the concept into **3–4 comic-style scenes** (MAX 4 SCENES), each with:
   - Title (short, engaging)
   - Description (max 2 sentences, simplified)
   - Key Idea (1 short sentence summary)
   - Image_prompt (a descriptive scene that visually explains the idea)
4. Format your entire response in clear **Markdown** for accessibility.

**CRITICAL: Generate exactly 3-4 scenes maximum. Do not exceed 4 scenes.**

Example output format:
1. **Title:** The Brain of the Computer 🤖  
**Description:** Think of a neural network as a brain made of many small helpers (neurons). Each helper passes information to the next to make decisions.  
**Key Idea:** Many small parts work together to solve big problems.  
**Image_prompt:** A colorful comic of small robots passing glowing balls of light (information).

2. **Title:** Learning Together 📚  
**Description:** Just like friends learning a new game, these helpers practice and get better over time. They remember what works!  
**Key Idea:** Practice makes perfect for computer brains too.  
**Image_prompt:** Cartoon robots high-fiving each other as they successfully pass information.

Now simplify and visualize the lesson below (3-4 scenes maximum):
Lesson: ${text}
`;

    // 3. Call Gemini to create the story structure
    console.log("Generating lesson structure...");
    const result = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const story = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    if (!story) {
      throw new Error("No response from Gemini API");
    }

    console.log("Generated story structure:", story.substring(0, 200) + "...");

    // 4. Parse the story into structured scenes with better parsing
    const sceneBlocks = story.split(/\d+\./).filter(block => 
      block.trim().length > 0 && 
      block.includes('**Title:**') && 
      block.includes('**Image_prompt:**')
    );

    const scenes = sceneBlocks.slice(0, 4).map((block, index) => {
      try {
        const titleMatch = block.match(/\*\*Title:\*\*(.*?)(?=\*\*Description:)/is);
        const descriptionMatch = block.match(/\*\*Description:\*\*(.*?)(?=\*\*Key Idea:)/is);
        const keyIdeaMatch = block.match(/\*\*Key Idea:\*\*(.*?)(?=\*\*Image_prompt:)/is);
        const imagePromptMatch = block.match(/\*\*Image_prompt:\*\*(.*?)$/is);

        const title = titleMatch?.[1]?.trim() || `Scene ${index + 1}`;
        const description = descriptionMatch?.[1]?.trim() || '';
        const keyIdea = keyIdeaMatch?.[1]?.trim() || '';
        const imagePrompt = imagePromptMatch?.[1]?.trim() || "comic panel explaining the concept";

        return {
          title,
          description,
          keyIdea,
          imagePrompt: `${imagePrompt}, vivid colors, 512x512, highly detailed comic book style, educational illustration`,
          sceneNumber: index + 1
        };
      } catch (parseError) {
        console.error(`Error parsing scene ${index + 1}:`, parseError);
        return {
          title: `Scene ${index + 1}`,
          description: 'Unable to parse scene description',
          keyIdea: 'Key idea not available',
          imagePrompt: "comic panel explaining the concept, vivid colors, 512x512, highly detailed comic book style",
          sceneNumber: index + 1
        };
      }
    });

    console.log(`Parsed ${scenes.length} scenes for image generation`);

    // 5. Generate images SEQUENTIALLY with delays and retry logic
    const imageResults = await processScenesSequentially(scenes, imageModel);

    // Calculate success rate
    const successfulScenes = imageResults.filter(scene => scene.imageUrl).length;
    console.log(`Image generation completed: ${successfulScenes}/${scenes.length} successful`);

    return NextResponse.json({ 
      scenes: imageResults,
      message: `Lesson visualization generated with ${successfulScenes}/${scenes.length} scenes`,
      totalScenes: scenes.length,
      successfulScenes: successfulScenes,
      fullStory: story // Include the original story for debugging
    });
    
  } catch (err) {
    console.error("Error generating visualization:", err);
    return NextResponse.json({ 
      error: "Failed to generate lesson visualization",
      details: (err as Error).message 
    }, { status: 500 });
  }
}