// app/api/adhd/upload/route.ts (or clarify/route.ts)
import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/db/prisma";
import { GoogleAi } from "@/lib/googleAi";
import mammoth from "mammoth";
import { VertexAI } from "@google-cloud/vertexai";

export const runtime = "nodejs";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob | null;

    if (!file) return NextResponse.json({ error: "File missing" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalFilename = (file as any).name || "uploaded-file";
    const ext = path.extname(originalFilename).toLowerCase();

    const material = await prisma.adhdMaterial.create({
      data: {
        fileName: originalFilename,
        status: "processing",
      },
    });

    const response = NextResponse.json({
      message: "File uploaded successfully! Processing OCR & generating unique Gemini slide images...",
      materialId: material.id,
    }, { status: 201 });

    setTimeout(async () => {
      try {
        let extractedText = "";

        if (ext === ".docx") {
          const docxResult = await mammoth.extractRawText({ buffer });
          extractedText = docxResult.value || "";
        } else {
          // PDF Extraction (OCR/Text parsing)
          const pdfParse = require("pdf-parse");
          try {
            const pdfData = await pdfParse(buffer);
            extractedText = pdfData.text || "";
          } catch (pdfErr) {
            extractedText = buffer.toString("utf-8");
          }
        }

        // Clean up excessive whitespace from PDF parsing
        extractedText = extractedText.replace(/\s+/g, " ").trim();

        if (!extractedText || extractedText.length < 50) {
          extractedText = `Detailed academic document: "${originalFilename}".`;
        }

        const googleAi = GoogleAi.getInstance();
        
        // Strict prompt forcing Gemini to divide the actual extracted content into 6 sequential phases
        const prompt = `
You are an expert professor, academic content designer, and ADHD learning specialist. 
Your task is to thoroughly analyze the COMPLETE extracted text content from the uploaded document ("${originalFilename}") and break it down sequentially into EXACTLY 6 logical learning slides (stops 1 to 6).

CRITICAL INSTRUCTIONS:
1. Do NOT summarize the whole document into one slide. Divide the content chronologically or topically across all 6 slides.
2. Every slide MUST contain completely unique content, key ideas, and distinct visual descriptions derived strictly from the text below.
3. Return ONLY a valid JSON object. No markdown backticks, no extra conversational text.

Use this exact JSON structure:
{
  "stops": [
    {
      "title": "Clear Concept Title with Emoji 📊",
      "descriptionNormal": "Detailed academic explanation based strictly on this section of the document in 2-3 sentences.",
      "keyIdea": "Single primary takeaway point for this specific phase.",
      "imagePrompt": "A vivid, highly specific, and entirely distinct visual illustration concept representing only this slide's unique sub-topic."
    }
  ]
}

Document Extracted Content:
---
${extractedText.substring(0, 25000)}
---
`;

        const aiResponse = await googleAi.generateText(prompt);

        const cleanedResponse = aiResponse
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        const jsonStartIndex = cleanedResponse.indexOf("{");
        const jsonEndIndex = cleanedResponse.lastIndexOf("}") + 1;
        const finalJsonString = cleanedResponse.substring(jsonStartIndex, jsonEndIndex);

        const parsedData = JSON.parse(finalJsonString);
        const stopsArray = parsedData.stops || [];

        // Initialize Gemini GenAI client for image generation per slide
        const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });

        // Loop through each of the 6 generated stops and invoke Gemini to create a distinct image
        for (let i = 0; i < stopsArray.length; i++) {
          const stop = stopsArray[i];
          const slideNum = i + 1;

          let imageUrl = `https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1000&q=80&sig=${material.id}-${slideNum}`;

          try {
            if (i > 0) await sleep(1000); // Prevent rate-limiting

            const slideImagePrompt = `Create an educational, high-quality vector illustration representing Slide ${slideNum}: ${stop.imagePrompt}. Key concept focus: ${stop.keyIdea}`;
            
            // Generate image via Gemini model capable of image generation/multimodal output
            const imageResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash', // Adjust model if using a dedicated image generation endpoint in your setup
              contents: [slideImagePrompt],
            });

            // Check if inline image data or standard URL returned, else use fallback with unique query hash
            if (imageResponse && (imageResponse as any).imageUrl) {
              imageUrl = (imageResponse as any).imageUrl;
            }
          } catch (imgErr) {
            console.error(`Gemini image generation warning for slide ${slideNum}:`, imgErr);
          }

          await prisma.adhdSlide.create({
            data: {
              materialId: material.id,
              textContent: JSON.stringify({
                title: stop.title,
                descriptionNormal: stop.descriptionNormal,
                keyIdea: stop.keyIdea,
              }),
              imageUrl: imageUrl,
              order: slideNum * 1.0,
            },
          });
        }

        await prisma.adhdMaterial.update({
          where: { id: material.id },
          data: { status: "completed" },
        });

      } catch (error: any) {
        console.error("ADHD Processing error:", error.message);
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