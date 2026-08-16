import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { Storage } from "@google-cloud/storage";

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

// Helper function to generate unique file name with high randomness to prevent caching
function generateFileName(sceneIndex: number): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36.substring(2, 10));
  return `scene-${sceneIndex}-${timestamp}-${random}.png`;
}

async function generateImageWithRetry(
  imageModel: any, 
  prompt: string, 
  sceneNumber: number,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Generating image attempt ${attempt} for slide ${sceneNumber} with prompt: ${prompt.substring(0, 60)}...`);

      // Enforce strict context uniqueness in prompt wrapper to prevent model from returning duplicate cached assets
      const uniquePromptPayload = `[SLIDE_ID: ${sceneNumber}-${Date.now()}] Generate a unique, distinct visual illustration for this specific concept. Style: vivid colors, highly detailed comic book/educational vector style. Prompt: ${prompt}`;

      const image = await imageModel.generateContent({
        contents: [{ role: "user", parts: [{ text: uniquePromptPayload }] }],
      });

      const part = image.response?.candidates?.[0]?.content?.parts?.[0];

      if (!part) {
        throw new Error("No content parts returned from API");
      }

      let base64Img = part.inlineData?.data;

      if (!base64Img && (part as any).executableCode) {
         throw new Error("Model returned code instead of an image.");
      }

      if (!base64Img) {
        throw new Error("Image generated, but base64 data could not be found in the expected 'inlineData' field.");
      }

      return `data:image/png;base64,${base64Img}`;

    } catch (error) {
      lastError = error as Error;
      console.warn(`Image generation attempt ${attempt} for slide ${sceneNumber} failed:`, error);

      if (attempt < maxRetries) {
        const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }

  throw lastError!;
}

// Process scenes sequentially with unique prompts and distinct payloads
async function processScenesSequentially(
  scenes: any[], 
  imageModel: any
): Promise<any[]> {
  const results = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const slideNum = i + 1;
    console.log(`Processing slide ${slideNum}/${scenes.length} with unique key idea: "${scene.keyIdea}"`);

    try {
      // Force unique image generation tailored explicitly to this slide's distinct imagePrompt and keyIdea
      const combinedVisualPrompt = `Topic: ${scene.title}. Key Takeaway: ${scene.keyIdea}. Visual Scene Description: ${scene.imagePrompt}`;
      const dataUrl = await generateImageWithRetry(imageModel, combinedVisualPrompt, slideNum);

      // Upload unique file to GCS
      const fileName = generateFileName(slideNum);
      const publicUrl = await uploadBase64Image(dataUrl, fileName);

      results.push({
        ...scene,
        imageUrl: publicUrl,
        image: publicUrl,
        fileName: fileName
      });

      // Delay between generations to respect API rate limits
      if (i < scenes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`Failed to process slide ${slideNum}:`, error);
      results.push({
        ...scene,
        imageUrl: null,
        image: null,
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

    const vertexAI = new VertexAI({
      project: process.env.GOOGLE_PROJECT_ID, 
      location: process.env.LOCATION || "us-central1",
    });

    const geminiModel = vertexAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.8, // Increased slightly to ensure diverse text/prompt generation per slide
      },
    });

    const imageModel = vertexAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-image",
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7, // Higher temperature to force diverse pixel/asset generation
      },
    });

    const prompt = `
You are a special educator AI for Lumina that helps learners understand materials easily.

Your goals:
1. Analyze the provided lesson text thoroughly.
2. Break the content into **EXACTLY 4 unique, progressive comic-style scenes** (Scene 1 to Scene 4), ensuring that **each scene covers completely different sub-topics, examples, or stages of the text with zero repetition**.
3. For each scene, provide:
   - Title: Short, unique title for this specific slide.
   - Description: Simplified explanation for this specific part.
   - Key Idea: A unique 1-sentence core takeaway for this slide.
   - Image_prompt: A highly specific, distinct visual description for this slide's custom illustration.

CRITICAL: Return exactly 4 distinct scenes in clean Markdown format using numeric prefixes (1., 2., 3., 4.).

Lesson Text to breakdown:
${text}
`;

    console.log("Generating unique lesson structure...");
    const result = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const story = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!story) {
      throw new Error("No response from Gemini API");
    }

    const sceneBlocks = story.split(/\n(?=\d+\.\s+\*\*Title)/).filter(block => 
      block.trim().length > 0 && 
      block.includes('**Title:**') && 
      block.includes('**Image_prompt:**')
    );

    const targetBlocks = sceneBlocks.length >= 3 ? sceneBlocks.slice(0, 4) : story.split(/\d+\./).filter(b => b.trim().length > 10).slice(0, 4);

    const scenes = targetBlocks.map((block, index) => {
      try {
        const titleMatch = block.match(/\*\*Title:\*\*(.*?)(?=\*\*Description:|$)/is);
        const descriptionMatch = block.match(/\*\*Description:\*\*(.*?)(?=\*\*Key Idea:|$)/is);
        const keyIdeaMatch = block.match(/\*\*Key Idea:\*\*(.*?)(?=\*\*Image_prompt:|$)/is);
        const imagePromptMatch = block.match(/\*\*Image_prompt:\*\*(.*?)$/is);

        const title = titleMatch?.[1]?.trim() || `Slide ${index + 1}`;
        const description = descriptionMatch?.[1]?.trim() || 'Detailed overview of current section.';
        const keyIdea = keyIdeaMatch?.[1]?.trim() || title;
        const imagePrompt = imagePromptMatch?.[1]?.trim() || `Educational comic illustration representing ${title}`;

        return {
          title,
          description,
          keyIdea,
          imagePrompt,
          sceneNumber: index + 1
        };
      } catch (parseError) {
        return {
          title: `Slide ${index + 1}`,
          description: 'Custom educational slide content.',
          keyIdea: 'Core concept breakdown.',
          imagePrompt: 'Detailed educational illustration with vibrant colors.',
          sceneNumber: index + 1
        };
      }
    });

    console.log(`Parsed ${scenes.length} distinct scenes. Starting unique asset generation pipeline...`);

    const imageResults = await processScenesSequentially(scenes, imageModel);

    const successfulScenes = imageResults.filter(scene => scene.imageUrl).length;

    return NextResponse.json({ 
      scenes: imageResults,
      message: `Lesson visualization generated with ${successfulScenes}/${scenes.length} unique slides`,
      totalScenes: scenes.length,
      successfulScenes: successfulScenes,
      fullStory: story 
    });

  } catch (err) {
    console.error("Error generating visualization:", err);
    return NextResponse.json({ 
      error: "Failed to generate lesson visualization",
      details: (err as Error).message 
    }, { status: 500 });
  }
}