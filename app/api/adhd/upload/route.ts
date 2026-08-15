// app/api/adhd/upload/route.ts
import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/db/prisma";
import { GoogleAi } from "@/lib/googleAi";
import mammoth from "mammoth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob | null;

    if (!file) return NextResponse.json({ error: "File missing" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalFilename = (file as any).name || "uploaded-file";
    const ext = path.extname(originalFilename).toLowerCase();

    // 1. Create initial material state in database
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
        // Step A: Extract ALL useful text/content from PDF or DOCX
        let extractedText = "";
        if (ext === ".docx") {
          const docxResult = await mammoth.extractRawText({ buffer });
          extractedText = docxResult.value || "";
        } else {
          const pdfParse = require("pdf-parse");
          try {
            const pdfData = await pdfParse(buffer);
            extractedText = pdfData.text || "";
          } catch (pdfErr) {
            extractedText = buffer.toString("utf-8");
          }
        }

        // Step B: Clean + structure the extracted content
        extractedText = extractedText
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
          .replace(/[\r\n]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (!extractedText || extractedText.length < 30) {
          extractedText = `Detailed academic study material for the topic: "${originalFilename}".`;
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

        // Steps D & E: Generate Slide 1 -> Slide 2 -> ... -> Slide 6 sequentially based on the shared context
        for (let i = 0; i < stops.length; i++) {
          const stop = stops[i];
          const slideNumber = i + 1;

          console.log(`Generating Slide ${slideNumber} of 6 based on shared chapter context...`);

          // Generate unique visual image for each slide using Vertex AI
          let imageUrl = "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1000&q=80";
          try {
            imageUrl = await googleAi.generateImage(
              `Slide ${slideNumber} Key Idea: ${stop.keyIdea}. Visual concept: ${stop.imagePrompt}`
            );
          } catch (imgErr) {
            console.error(`Image generation fallback used for Slide ${slideNumber}:`, imgErr);
          }

          // Save each slide ensuring every slide features its specific key idea prominently in the text payload
          await prisma.adhdSlide.create({
            data: {
              materialId: material.id,
              textContent: JSON.stringify({
                title: stop.title,
                descriptionNormal: stop.descriptionNormal,
                keyIdea: stop.keyIdea, // Key idea explicitly attached per slide
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