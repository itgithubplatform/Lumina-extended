// app/api/adhd/clarify/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { GoogleAi } from "@/lib/googleAi";

export async function POST(req: Request) {
  try {
    const { materialId, currentOrder, slideText, question } = await req.json();

    if (!materialId || currentOrder === undefined || !slideText || !question) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const googleAi = GoogleAi.getInstance();
    const prompt = `
      You are an educator for people with ADHD.
      The user is confused by this slide text: "${slideText}"
      Their specific problem/question is: "${question}"
      Explain it even simpler, directly addressing their problem. 
      Use EXACTLY one short, easy-to-understand sentence. Keep it punchy and engaging. No jargon.
    `;
    
    const simpleText = await googleAi.generateText(prompt);
    
    let imageUrl = null;
    try {
      const res = await fetch(`${process.env.NEXTAUTH_URL}/api/visualize-lesson`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: simpleText }),
      });
      if (res.ok) {
        const data = await res.json();
        imageUrl = Array.isArray(data) ? data[0] : (data.url || data);
      }
    } catch (imgErr) {
      console.error("Clarification image generation failed", imgErr);
    }

    // Insert as a sub-slide by adding a decimal to the current order
    // e.g., if current is 2.0, this becomes 2.1
    const newSlide = await prisma.adhdSlide.create({
      data: {
        materialId,
        textContent: simpleText.replace(/["']/g, "").trim(),
        imageUrl: typeof imageUrl === 'string' ? imageUrl : null,
        order: currentOrder + 0.1, 
        isClarification: true
      }
    });

    return NextResponse.json({ success: true, newSlide }, { status: 201 });
  } catch (err: any) {
    console.error("Clarify failed:", err.message);
    return NextResponse.json({ error: err.message || "Failed to clarify" }, { status: 500 });
  }
}