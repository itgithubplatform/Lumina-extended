import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { materialId } = body;

    if (!materialId) {
      return NextResponse.json({ success: false, error: "Material ID is required" }, { status: 400 });
    }

    // 1. Fetch material content from DB
    const material = await prisma.adhdMaterial.findUnique({
      where: { id: materialId },
    });

    if (!material || !material.content) {
      return NextResponse.json({ success: false, error: "Material content not found" }, { status: 404 });
    }

    // 2. Check if slides already exist
    const existingSlides = await prisma.adhdSlide.findMany({
      where: { materialId: materialId },
    });

    if (existingSlides.length > 0) {
      return NextResponse.json({ success: true, materialId, totalSlides: existingSlides.length });
    }

    // 3. Initialize Vertex AI
    const vertexAI = new VertexAI({
      project: process.env.GOOGLE_PROJECT_ID || "concise-wharf-504317-e2",
      location: process.env.LOCATION || "us-central1",
    });

    const geminiModel = vertexAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
    });

    const prompt = `
You are an expert ADHD learning assistant AI for Lumina.
Analyze the following learning material and break it down into EXACTLY 6 sequential steps/slides tailored for cognitive accessibility.

Material Content:
"""
${material.content}
"""

Return ONLY a valid JSON array (no markdown backticks, no extra text). Format:
[
  {
    "slideNumber": "1",
    "title": "🎯 Short title with an emoji",
    "textContent": "Clear 2-sentence explanation based on content.",
    "keyIdea": "1 core takeaway sentence from the material."
  }
]
`;

    let rawScenes = [];

    try {
      const result = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const story = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const cleanedJson = story.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedData = JSON.parse(cleanedJson);

      if (Array.isArray(parsedData) && parsedData.length > 0) {
        rawScenes = parsedData.map((item, index) => {
          // Using your GCS bucket image path format
          const defaultImg = `https://storage.googleapis.com/concepto-2/adhdImages/${(index % 4) + 1}.png`;

          return {
            materialId: materialId,
            slideNumber: String(index + 1),
            title: item.title || `Step ${index + 1}`,
            textContent: item.textContent || "Lesson detail.",
            keyIdea: item.keyIdea || "Key takeaway.",
            imageUrl: defaultImg,
            isClarification: false,
          };
        });
      }
    } catch (aiError) {
      console.warn("AI generation or parsing failed, using fallback slides:", aiError);
    }

    // Fallback if AI fails
    if (rawScenes.length === 0) {
      rawScenes = Array.from({ length: 6 }, (_, index) => ({
        materialId: materialId,
        slideNumber: String(index + 1),
        title: `📌 Step ${index + 1}: Concept Overview`,
        textContent: `Detailed focus breakdown for part ${index + 1} of your study material.`,
        keyIdea: `Core takeaway for step ${index + 1}.`,
        imageUrl: `https://storage.googleapis.com/concepto-2/adhdImages/${(index % 4) + 1}.png`,
        isClarification: false,
      }));
    }

    // 4. Save generated slides to PostgreSQL
    await prisma.adhdSlide.createMany({
      data: rawScenes,
    });

    return NextResponse.json({ success: true, materialId, totalSlides: rawScenes.length });
  } catch (err: any) {
    console.error("Error generating slides:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}