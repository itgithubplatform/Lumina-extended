import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { VertexAI } from "@google-cloud/vertexai";

export const runtime = "nodejs";
export const maxDuration = 120;

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

if (!PROJECT_ID) {
  throw new Error("GOOGLE_CLOUD_PROJECT_ID is missing");
}

const vertexAI = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION,
});

const gemini = vertexAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export async function POST(req: Request) {
  try {
    console.log("======================================");
    console.log("ADHD FOCUS SLIDE GENERATION STARTED");
    console.log("======================================");

    // 1. Authenticate user session
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized session. Please sign in again." },
        { status: 401 }
      );
    }

    const userId = token.sub || token.email;
    if (!userId) {
      return NextResponse.json(
        { error: "Unable to identify authenticated user." },
        { status: 401 }
      );
    }

    // 2. Parse request body for materialId
    const body = await req.json();
    const { materialId } = body;

    if (!materialId) {
      return NextResponse.json(
        { error: "No material ID provided" },
        { status: 400 }
      );
    }

    // 3. Fetch saved material from database
    const material = await prisma.adhdMaterial.findUnique({
      where: { id: materialId },
    });

    if (!material) {
      return NextResponse.json(
        { error: "Material not found in database" },
        { status: 404 }
      );
    }

    console.log("Generating focus slides via Vertex AI for material:", material.id);

    // 4. Construct prompt for Vertex AI to break content into interactive chunks
    const prompt = `
You are an expert educational designer specializing in cognitive structuring for individuals with ADHD.

Take the educational content below and break it down into 4 to 8 sequential, bite-sized, highly engaging focus steps. 

Requirements:
- Keep explanations clear, concise, and structured.
- Avoid cognitive overload.
- Return ONLY a valid JSON array of objects. Do not include markdown code ticks like \`\`\`json or any introductory text outside the array.
- Each object in the array must have the following exact keys:
  - "slideNumber" (number): sequential index starting from 1
  - "title" (string): short, punchy title for the focus step
  - "content" (string): concise educational breakdown for this specific step
  - "imagePrompt" (string): a vivid conceptual description or keyword idea for visual representation

EDUCATIONAL CONTENT:
${material.content.substring(0, 30000)}
`;

    const result = await gemini.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    const responseText =
      result.response.candidates?.[0]?.content?.parts
        ?.map((part: any) => part.text || "")
        .join("")
        .trim() || "";

    // 5. Parse JSON response securely
    let slides = [];
    try {
      const jsonStringMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonStringMatch) {
        slides = JSON.parse(jsonStringMatch[0]);
      } else {
        throw new Error("No valid JSON array format found in model output.");
      }
    } catch (parseError) {
      console.warn("Failed to parse AI slides JSON directly, attempting fallback cleanup.", parseError);
      slides = [
        {
          slideNumber: 1,
          title: "Core Overview",
          content: material.content.substring(0, 400),
          imagePrompt: "Overview concept visualization",
        },
        {
          slideNumber: 2,
          title: "Detailed Breakdown",
          content: material.content.substring(400, 900) || material.content,
          imagePrompt: "Detailed principles breakdown",
        },
      ];
    }

    console.log(`Successfully generated ${slides.length} focus slides.`);

    // 6. Return slides to frontend UI
    return NextResponse.json(
      {
        success: true,
        materialId: material.id,
        title: material.fileName,
        slides,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("======================================");
    console.error("ADHD FOCUS GENERATION ERROR");
    console.error(error);
    console.error("======================================");

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to generate focus slides.",
      },
      { status: 500 }
    );
  }
}