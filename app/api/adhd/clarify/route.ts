// app/api/adhd/upload/route.ts (or clarify/route.ts)
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

    const material = await prisma.adhdMaterial.create({
      data: {
        fileName: originalFilename,
        status: "processing",
      },
    });

    const response = NextResponse.json({
      message: "File uploaded successfully! Processing started.",
      materialId: material.id,
    }, { status: 201 });

    setTimeout(async () => {
      try {
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

        // Clean up excessive whitespace from PDF parsing
        extractedText = extractedText.replace(/\s+/g, " ").trim();

        if (!extractedText || extractedText.length < 50) {
          extractedText = `Detailed academic document: "${originalFilename}".`;
        }

        const googleAi = GoogleAi.getInstance();
        
        // Strict prompt forcing Gemini to divide the actual extracted content into 6 sequential phases
        const prompt = `
You are an expert professor, academic content designer, and ADHD learning specialist. 
Your task is to thoroughly analyze the COMPLETE provided text content from the uploaded document ("${originalFilename}") and break it down sequentially into EXACTLY 6 logical learning slides (stops).

CRITICAL INSTRUCTIONS:
1. Do NOT summarize the whole document into one slide. Divide the content chronologically or topically across all 6 slides (Slide 1 covers the beginning/introduction, Slides 2-5 cover core concepts/body, Slide 6 covers conclusion/applications).
2. Every slide MUST contain unique content derived strictly from the text below.
3. Return ONLY a valid JSON object. No markdown backticks, no extra conversational text.

Use this exact JSON structure:
{
  "stops": [
    {
      "title": "Clear Concept Title with Emoji 📊",
      "descriptionNormal": "Detailed academic explanation based strictly on this section of the document in 2-3 sentences.",
      "keyIdea": "Single primary takeaway point for this specific phase.",
      "imagePrompt": "A vivid, highly specific visual description representing this exact slide's sub-topic for AI image generation."
    }
  ]
}

Document Full Content:
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

        // Loop through each of the 6 generated stops and create unique images
        for (let i = 0; i < stopsArray.length; i++) {
          const stop = stopsArray[i];

          let imageUrl = "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1000&q=80";
          try {
            const res = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/visualize-lesson`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                text: `${originalFilename} - ${stop.title}: ${stop.keyIdea}`,
                imagePrompt: stop.imagePrompt || `${originalFilename} - ${stop.title}`
              }),
            });

            if (res.ok) {
              const data = await res.json();
              imageUrl = data.imageUrl || data.url || imageUrl;
            }
          } catch (imgErr) {
            console.error("Image generation fallback used", imgErr);
          }

          await prisma.adhdSlide.create({
            data: {
              materialId: material.id,
              textContent: JSON.stringify({
                title: stop.title,
                descriptionNormal: stop.descriptionNormal,
                keyIdea: stop.keyIdea,
              }),
              imageUrl: typeof imageUrl === 'string' && imageUrl.startsWith('http') ? imageUrl : null,
              order: (i + 1) * 1.0,
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