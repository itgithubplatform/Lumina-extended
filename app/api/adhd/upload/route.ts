import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db/prisma";
import { HLSConverter } from "@/lib/HLSConvarter";
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

    const uploadDir = path.join(process.cwd(), "uploads", "adhd");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const originalFilename = (file as any).name || "uploaded-file";
    const filename = `${Date.now()}-${originalFilename}`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);

    const ext = path.extname(filename).toLowerCase();
    const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv", ".m4v", ".mpg", ".mpeg", ".3gp", ".ts", ".vob", ".ogv"];
    const docExtensions = [".pdf", ".docx"];
    const isVideo = videoExtensions.includes(ext);
    const isDoc = docExtensions.includes(ext);

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
        const googleAi = GoogleAi.getInstance();

        if (isVideo) {
          const converter = HLSConverter.getInstance();
          const audioFile = await converter.extractAudio(filePath, filename, "mp3");
          const { googleStorageUri: audioInGoogle } = await googleAi.uploadToCloudStorage(audioFile, "audio");
          
          fs.rmSync(audioFile, { force: true, recursive: true });
          fs.rmSync(filePath, { force: true, recursive: true });
          
          const transcript = await googleAi.generateSpeechToText(audioInGoogle, "en");
          extractedText = typeof transcript === 'string' ? transcript : JSON.stringify(transcript);
        } else if (isDoc) {
          if (ext === ".docx") {
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value;
          }
          fs.rmSync(filePath, { force: true, recursive: true });
        }

        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error("No text extracted");
        }

        const prompt = `
          You are an expert educator specializing in ADHD learning. 
          Break down the following text into highly digestible, sequential slides.
          Rules:
          1. Keep text extremely brief (1-2 sentences per slide max).
          2. Focus on exactly one core concept per slide.
          3. Return the data STRICTLY as a JSON array of objects with a single key "textContent". 
          
          TEXT:
          ${extractedText.substring(0, 10000)}
        `;

        const aiResponse = await googleAi.generateText(prompt);
        const cleanedResponse = aiResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        const slidesData = JSON.parse(cleanedResponse);

        for (let i = 0; i < slidesData.length; i++) {
          const slideText = slidesData[i].textContent;
          
          let imageUrl = "";
          try {
            const res = await fetch(`${process.env.NEXTAUTH_URL}/api/visualize-lesson`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: slideText }),
            });
            if (res.ok) {
              const data = await res.json();
              imageUrl = Array.isArray(data) ? data[0] : (data.url || data); 
            }
          } catch (imgErr) {
            console.error("Image generation failed for slide", i, imgErr);
          }

          await prisma.adhdSlide.create({
            data: {
              materialId: material.id,
              textContent: slideText,
              imageUrl: typeof imageUrl === 'string' ? imageUrl : null,
              order: (i + 1) * 1.0,
            }
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
    console.error("Upload failed:", err.message);
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
          orderBy: { order: 'asc' }
        } 
      }
    });

    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      status: material.status, 
      material 
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch" }, { status: 500 });
  }
}