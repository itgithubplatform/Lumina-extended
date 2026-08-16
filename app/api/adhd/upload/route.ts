// app/api/adhd/upload/route.ts
import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/db/prisma";
import { GoogleAi } from "@/lib/googleAi";
import mammoth from "mammoth";
import { VertexAI } from "@google-cloud/vertexai";
import { Storage } from "@google-cloud/storage";

export const runtime = "nodejs";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function uploadBase64Image(base64Data: string, fileName: string): Promise<string> {
  const storage = new Storage({
    projectId: process.env.GOOGLE_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });

  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'lumina-lesson-images';
  const bucket = storage.bucket(bucketName);
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
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob | null;

    if (!file) return NextResponse.json({ error: "File missing" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalFilename = (file as any).name || "uploaded-file";
    const ext = path.extname(originalFilename).toLowerCase();

    // 1. Create initial material state
    const material = await prisma.adhdMaterial.create({
      data: {
        fileName: originalFilename,
        status: "processing",
      },
    });

    const response = NextResponse.json({
      message: "File uploaded successfully! Extracting full content and preparing unique slide-wise AI assets...",
      materialId: material.id,
    }, { status: 201 });

    // 2. Background processing pipeline
    setTimeout(async () => {
      try {
        let extractedText = "";

        if (ext === ".docx") {
          const docxResult = await mammoth.extractRawText({ buffer });
          extractedText = docxResult.value || "";
        } else {
          // PDF Text Extraction / OCR parsing
          const pdfParse = require("pdf-parse");
          try {
            const pdfData = await pdfParse(buffer);
            extractedText = pdfData.text || "";
          } catch (pdfErr) {
            console.warn("Standard PDF parsing failed, falling back to raw buffer text...");
            extractedText = buffer.toString("utf-8");
          }
        }

        // Clean up extracted text formatting
        extractedText = extractedText
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
          .replace(/[\r\n]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (!extractedText || extractedText.length < 30) {
          extractedText = `Detailed study material for document: "${originalFilename}".`;
        }

        const googleAi = GoogleAi.getInstance();

        // 3. Prompt Gemini to split the extracted content into 6 distinct parts with unique image prompts and key ideas
        const learningPlanPrompt = `
You are an expert professor, academic content designer, and ADHD learning specialist. 
Analyze the full extracted document text below ("${originalFilename}").

Break it down sequentially into EXACTLY 6 progressive, unique learning slides (Stop 1 to Stop 6). 
CRITICAL REQUIREMENT: Ensure zero repetition. Each slide must cover a completely different segment, topic, or sub-section of the text.

Return ONLY a valid JSON object matching this exact structure, with no markdown formatting tags:
{
  "stops": [
    {
      "title": "Unique Title with Emoji 🚀",
      "descriptionNormal": "Detailed academic explanation for this specific part derived strictly from the text.",
      "keyIdea": "Punchy key takeaway sentence for this individual slide.",
      "imagePrompt": "A highly specific, completely distinct visual description representing only this slide's concept, vivid colors, educational illustration style."
    }
  ]
}

Extracted Document Content:
---
${extractedText.substring(0, 25000)}
---
`;

        const planResponse = await googleAi.generateText(learningPlanPrompt);
        const cleanedPlan = planResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonStart = cleanedPlan.indexOf("{");
        const jsonEnd = cleanedPlan.lastIndexOf("}") + 1;
        
        const parsedPlan = JSON.parse(cleanedPlan.substring(jsonStart, jsonEnd));
        const stops = parsedPlan.stops || [];

        const vertexAI = new VertexAI({
          project: process.env.GOOGLE_PROJECT_ID, 
          location: process.env.LOCATION || "us-central1",
        });

        const imageModel = vertexAI.getGenerativeModel({ 
          model: "gemini-2.5-flash-image",
          generationConfig: { maxOutputTokens: 1024, temperature: 0.8 },
        });

        // 4. Generate unique individual images for each slide sequentially to avoid duplication or caching
        for (let i = 0; i < stops.length; i++) {
          const stop = stops[i];
          const slideNumber = i + 1;

          console.log(`Generating unique AI image asset for Slide ${slideNumber}/6: "${stop.title}"`);

          if (i > 0) {
            await sleep(2000); // Prevent rate limits
          }

          let finalImageUrl = `https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80&sig=${material.id}-${slideNumber}`;

          try {
            const uniquePrompt = `[SLIDE_${slideNumber}_UNIQUE_ASSET] Generate a distinct visual illustration for this specific concept: ${stop.imagePrompt}. Key Idea: ${stop.keyIdea}`;
            
            const imageRes = await imageModel.generateContent({
              contents: [{ role: "user", parts: [{ text: uniquePrompt }] }],
            });

            const part = imageRes.response?.candidates?.[0]?.content?.parts?.[0];
            const base64Img = (part as any)?.inlineData?.data;

            if (base64Img) {
              const fileName = `adhd-${material.id}-slide-${slideNumber}-${Date.now()}.png`;
              finalImageUrl = await uploadBase64Image(base64Img, fileName);
            }
          } catch (imgErr: any) {
            console.warn(`Vertex AI image generation warning for Slide ${slideNumber}, falling back to unique placeholder:`, imgErr?.message);
          }

          // 5. Save each slide with its content, key idea, and unique image URL into the database
          await prisma.adhdSlide.create({
            data: {
              materialId: material.id,
              textContent: JSON.stringify({
                title: stop.title,
                descriptionNormal: stop.descriptionNormal,
                keyIdea: stop.keyIdea,
              }),
              imageUrl: finalImageUrl,
              order: slideNumber * 1.0,
            },
          });
        }

        // Finalize material status
        await prisma.adhdMaterial.update({
          where: { id: material.id },
          data: { status: "completed" },
        });

      } catch (error: any) {
        console.error("Pipeline Error:", error.message);
        await prisma.adhdMaterial.update({
          where: { id: material.id },
          data: { status: "failed" },
        });
      }
    }, 0);

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const materialId = searchParams.get("materialId");

    if (!materialId) {
      return NextResponse.json({ error: "materialId missing" }, { status: 400 });
    }

    const material = await prisma.adhdMaterial.findUnique({
      where: { id: materialId },
      include: {
        slides: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: material.status,
      material,
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch" }, { status: 500 });
  }
}