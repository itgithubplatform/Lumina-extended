import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    if (!token || (!token.sub && !token.email)) {
      return NextResponse.json({ error: "Unauthorized session" }, { status: 401 });
    }

    const body = await req.json();
    const { materialId } = body;

    if (!materialId) {
      return NextResponse.json({ error: "No material ID provided" }, { status: 400 });
    }

    // Fetch saved material from database
    const material = await prisma.material.findUnique({
      where: { id: materialId },
    });

    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    // Generate slides structure using AI based on extracted content
    let slides = [];
    try {
      const { GoogleAi } = await import("@/lib/googleAi").catch(() => ({ GoogleAi: null }));
      if (GoogleAi) {
        const ai = GoogleAi.getInstance();
        const prompt = `Break down the following text into 4 to 6 sequential, bite-sized educational focus steps for an ADHD-friendly learning session. Return valid JSON array format where each object has keys: slideNumber (number), title (string), content (string), and imagePrompt (string key idea).\n\nContent:\n${material.content.substring(0, 4000)}`;
        
        const responseText = await ai.generateText(prompt);
        // Try parsing JSON out of AI response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          slides = JSON.parse(jsonMatch[0]);
        }
      }
    } catch (e) {
      console.warn("AI slide chunking failed, using fallback breakdown.", e);
    }

    // Fallback if AI formatting isn't returned as a raw JSON array
    if (!slides || slides.length === 0) {
      slides = [
        {
          slideNumber: 1,
          title: "Overview & Context",
          content: material.content.substring(0, 300),
          imagePrompt: "Introduction to core concepts",
        },
        {
          slideNumber: 2,
          title: "Key Details",
          content: material.content.substring(300, 600) || material.content,
          imagePrompt: "Core principles and breakdown",
        }
      ];
    }

    return NextResponse.json({
      success: true,
      slides,
    });
  } catch (error: any) {
    console.error("Focus generation error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}