// app/api/adhd/upload/route.ts
import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/db/prisma";
import { GoogleAi } from "@/lib/googleAi";
import mammoth from "mammoth";

export const runtime = "nodejs";

// Helper function to throttle requests and avoid 429 Rate Limits
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

    // 1. Create initial material state in database with "processing" status
    const material = await prisma.adhdMaterial.create({
      data: {
        fileName: originalFilename,
        status: "processing",
      },
    });

    const response = NextResponse.json({
      message: "File uploaded! Creating chapter learning plan & processing slides sequentially...",
      materialId: material.id,
    }, { status: 201 });

    // 2. Background processing following your exact sequential pipeline
    setTimeout(async () => {
      try {
        // Step A: Extract text based on file format (.docx vs .pdf)
        let extractedText = "";
        
        if (ext === ".docx") {
          const docxResult = await mammoth.extractRawText({ buffer });
          extractedText = docxResult.value || "";
        } else {
          // PDF Processing block
          const pdfParse = require("pdf-parse");
          try {
            const pdfData = await pdfParse(buffer);
            extractedText = pdfData.text || "";
          } catch (pdfErr) {
            console.warn("Standard PDF parsing failed, trying text-decoder fallback...");
            extractedText = buffer.toString("utf-8");
          }
        }

        // Step B: Clean + structure the extracted content to remove garbage/unwanted spaces
        extractedText = extractedText
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
          .replace(/[\r\n]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        // Fallback if scanned/empty PDF lacks native text streams (OCR placeholder integration check)
        if (!extractedText || extractedText.length < 30) {
          console.warn("Extracted text is minimal or empty (possibly a scanned image PDF). Applying structural fallback context.");
          extractedText = `Detailed academic study material document for: "${originalFilename}".`;
        }

        const googleAi = GoogleAi.getInstance();

        // Step C: Send the full context to AI to create a cohesive chapter learning plan (6 sequential stops)
        const learningPlanPrompt = `
You are an expert AI professor and academic curriculum designer. 
Analyze the complete chapter content extracted below from the student's uploaded document ("${originalFilename}").

Your task is to understand the chapter thoroughly and build a cohesive learning plan breaking it down sequentially into EXACTLY 6 logical, progressive stops (slides).

CRITICAL REQUIREMENTS:
1. Every slide must focus on a distinct, progressive part of the chapter content without repeating information.
2. For each slide, write a detailed breakdown description ('descriptionNormal'), a punchy, high-impact ADHD-friendly takeaway sentence focused entirely on the core key idea ('keyIdea'), and an explicit visual description ('imagePrompt') for AI image generation.
3. Return ONLY a valid JSON object matching the exact structure below. Do not include any markdown backticks or extra text.

{
  "stops": [
    {
      "title": "Clear Concept Title with Emoji 🚀",
      "descriptionNormal": "Detailed academic explanation derived directly from this segment of the chapter context.",
      "keyIdea": "Punchy key idea summary statement for this specific slide.",
      "imagePrompt": "Vivid educational illustration description for this specific slide's concept."
    }
  ]
}

Chapter Context:
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

        // Steps D & E: Generate Slide 1 -> Slide 2 -> ... -> Slide 6 sequentially with rate-limit protection
        for (let i = 0; i < stops.length; i++) {
          const stop = stops[i];
          const slideNumber = i + 1;

          console.log(`Generating Slide ${slideNumber} of 6 based on shared chapter context...`);

          // Pause 3 seconds between slide image calls to completely avoid Vertex AI 429 Quota limits
          if (i > 0) {
            await sleep(3000);
          }

          let imageUrl = "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1000&q=80";
          let attempts = 0;
          let success = false;

          // Retry loop specifically for handling rate-limit hiccups
          while (attempts < 3 && !success) {
            try {
              imageUrl = await googleAi.generateImage(
                `Slide ${slideNumber} Key Idea: ${stop.keyIdea}. Visual concept: ${stop.imagePrompt}`
              );
              success = true;
            } catch (imgErr: any) {
              attempts++;
              console.warn(`Attempt ${attempts} failed for Slide ${slideNumber} image generation:`, imgErr?.message);
              if (attempts < 3) {
                // Exponential backoff wait before retrying
                await sleep(4000 * attempts);
              } else {
                console.error(`Image generation fallback used permanently for Slide ${slideNumber}`);
              }
            }
          }

          // Save each slide ensuring every slide features its specific key idea prominently into the database storage layer
          await prisma.adhdSlide.create({
            data: {
              materialId: material.id,
              textContent: JSON.stringify({
                title: stop.title,
                descriptionNormal: stop.descriptionNormal,
                keyIdea: stop.keyIdea,
              }),
              imageUrl: typeof imageUrl === 'string' && imageUrl.startsWith('http') ? imageUrl : null,
              order: slideNumber * 1.0,
            },
          });
        }

        // Finalize material status to completed
        await prisma.adhdMaterial.update({
          where: { id: material.id },
          data: { status: "completed" },
        });

      } catch (error: any) {
        console.error("Sequential Pipeline Error:", error.message);
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