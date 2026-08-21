// import { NextResponse } from "next/server";
// import fs from "fs";
// import path from "path";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";
// import { prisma } from "@/lib/db/prisma";
// import { HLSConverter } from "@/lib/HLSConvarter";
// import { GoogleAi } from "@/lib/googleAi";
// import mammoth from "mammoth";
// import { EventEmitter } from "stream";

// export const runtime = "nodejs";

// // PDF text extraction function using pdf2json
// async function extractTextFromPDF(filePath: string): Promise<string> {
//   return new Promise((resolve, reject) => {
//     const PDFParser = require("pdf2json");
//     const pdfParser = new PDFParser();

//     pdfParser.on("pdfParser_dataError", (errData: any) => {
//       console.error("PDF parsing error:", errData.parserError);
//       reject(new Error(errData.parserError));
//     });
//     pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
//       try {
//         console.log("PDF parsed successfully", pdfData.Pages[0].Texts);
//         const text = pdfParser.get;
//         console.log(`Extracted text length: ${text?.length || 0} characters`);
//         resolve(text || "");
//       } catch (error: any) {
//         console.error("Error getting text content:", error.message);
//         reject(error);
//       }
//     });

//     // Parse the buffer
//     pdfParser.loadPDF(filePath);
//   });
// }

// export async function POST(req: Request) {
//   try {
//     const formData = await req.formData();
//     const session = await getServerSession(authOptions);

//     if (!session || session.user.role !== "teacher") {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const classroomId = formData.get("classroomId") as string | null;
//     if (!classroomId) return NextResponse.json({ error: "ClassroomId missing" }, { status: 400 });

//     const existedClass = await prisma.classroom.findFirst({
//       where: { id: classroomId, teacherId: session.user.id },
//     });
//     if (!existedClass) return NextResponse.json({ error: "Classroom not found" }, { status: 404 });

//     const file = formData.get("file") as Blob | null;
//     if (!file) return NextResponse.json({ error: "File missing" }, { status: 400 });


//     const arrayBuffer = await file.arrayBuffer();
//     const buffer = Buffer.from(arrayBuffer);

//     const uploadDir = path.join(process.cwd(), "uploads");
//     if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

//     const originalFilename = (file as any).name || "uploaded-file";
//     const filename = `${Date.now()}-${originalFilename}`;
//     const filePath = path.join(uploadDir, filename);
//     fs.writeFileSync(filePath, buffer);

//     const ext = path.extname(filename).toLowerCase();
//     const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv", ".m4v", ".mpg", ".mpeg", ".3gp", ".ts", ".vob", ".ogv"];
//     const docExtensions = [".pdf", ".docx"];
//     const isVideo = videoExtensions.includes(ext);
//     const isDoc = docExtensions.includes(ext);

//     const fileData = await prisma.files.create({
//       data: {
//         name: originalFilename,
//         link: `/uploads/${filename}`,
//         class: { connect: { id: classroomId } },
//         status: "processing"
//       }
//     });

//     const response = NextResponse.json({
//       message: "File uploaded successfully! Background processing started.",
//       file: fileData,
//     }, { status: 201 });

//     // Background processing
//     setTimeout(async () => {
//       try {
//         let extractedText: string | null = null;

//         if (isVideo) {
//           console.log("Processing video file...");
//           const converter = HLSConverter.getInstance();
//           const audioFile = await converter.extractAudio(filePath, filename, "mp3");
//           const googleAi = GoogleAi.getInstance();
//           const { publicUrl: hlsPublicLink } = await googleAi.uploadToCloudStorage(filePath, "audio");
//           const { googleStorageUri: audioInGoogle, publicUrl: audioPublicLink } = await googleAi.uploadToCloudStorage(audioFile, "audio");
//           fs.rmSync(audioFile, { force: true, recursive: true });
//           fs.rmSync(filePath, { force: true, recursive: true });
//           const transcript = await googleAi.generateSpeechToText(audioInGoogle, "en")
//           console.log(transcript);
//           const blindSummary = await googleAi.generateText(`
//             INSTRUCTION PROMPT:
// You are an expert narrator and accessibility writer.
// Your job is to rewrite messy or unstructured transcriptions into clear, well-structured spoken text that can be converted into audio for blind or visually impaired listeners.

// Follow these rules strictly:
// 1. Remove filler words like “um,” “uh,” “like,” “you know,” and repetitions.
// 2. Fix grammar, punctuation, and sentence flow.
// 3. Break long sentences into short, natural sentences suitable for text-to-speech.
// 4. Use a clear, friendly, instructional tone with natural human expressions.
// 5. Add step-by-step explanations if the content describes a process.
// 6. If the original mentions visual elements (e.g., “as you can see”), rewrite them with clear verbal descriptions.
// 7. Avoid jargon or abbreviations unless expanded.
// 8. Ensure the output can be read smoothly by a TTS engine.
// 9. Do not include any emojis or formatting other than plain text.
// 10. Always return the final result as a plain string.

// USER PROMPT:
// Rewrite the following transcription according to the instructions above:
// ${JSON.stringify(transcript)}

// IMPORTANT:
// - Return only the rewritten text as a plain string.
// - No explanations, no notes, no special characters other than punctuation.

//             `)
//             console.log(blindSummary);
            
//           const blindAudioLink = await googleAi.generateTextToSpeech(blindSummary)
//           const res = await fetch(`${process.env.NEXTAUTH_URL}/api/visualize-lesson`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ text: blindSummary }),
//           });
//           if (!res.ok) {
//             throw new Error("Failed to generate images for blind friendly content");
//           }
//           const data = await res.json();
//           await prisma.files.update({
//             where: { id: fileData.id },
//             data: {
//               link: hlsPublicLink,
//               audioLink: audioPublicLink,
//               blindFriendlyLink: blindAudioLink,
//               transcript: transcript,
//               extractedText: blindSummary,
//               dislexiaFriendly: data,
//               status: "completed"
//             }
//           });
//           console.log("Video processing completed");
//         }
//         else if (isDoc) {
//           // if (ext === ".pdf") {
//           //   try {
//           //     console.log("📄 Processing PDF file with pdf2json...");

//           //     extractedText = await extractTextFromPDF(filePath);

//           //     console.log(`✅ PDF text extraction completed`);

//           //     if (extractedText?.trim().length === 0) {
//           //       console.log("⚠️ Extracted text is empty - PDF might be scanned or image-based");
//           //     } else {
//           //       console.log(`📝 First 200 chars: ${extractedText?.substring(0, 200)}...`);
//           //     }

//           //   } catch (pdfError: any) {
//           //     console.error("❌ PDF processing error:", pdfError.message);
//           //     extractedText = null;
//           //   }
//           // }
//           // else
//           if (ext === ".docx") {
//             try {
//               const result = await mammoth.extractRawText({ buffer });
//               extractedText = result.value;
//             } catch (docxError: any) {
//               fs.rmSync(filePath, { force: true, recursive: true });
//               await prisma.files.update({
//                 where: { id: fileData.id },
//                 data: { status: "failed" }
//               });
//               console.error("DOCX processing error:", docxError.message);
//             }
//           }

//           if (extractedText && extractedText.trim().length > 0) {
//             const googleAi = GoogleAi.getInstance();
//             const blindSummary = await googleAi.generateText(`
//             INSTRUCTION PROMPT:
// You are an expert narrator and accessibility writer.
// Your job is to rewrite messy or unstructured transcriptions into clear, well-structured spoken text that can be converted into audio for blind or visually impaired listeners.

// Follow these rules strictly:
// 1. Remove filler words like “um,” “uh,” “like,” “you know,” and repetitions.
// 2. Fix grammar, punctuation, and sentence flow.
// 3. Break long sentences into short, natural sentences suitable for text-to-speech.
// 4. Use a clear, friendly, instructional tone with natural human expressions.
// 5. Add step-by-step explanations if the content describes a process.
// 6. If the original mentions visual elements (e.g., “as you can see”), rewrite them with clear verbal descriptions.
// 7. Avoid jargon or abbreviations unless expanded.
// 8. Ensure the output can be read smoothly by a TTS engine.
// 9. Do not include any emojis or formatting other than plain text.
// 10. Always return the final result as a plain string.

// USER PROMPT:
// Rewrite the following transcription according to the instructions above:
// ${extractedText.trim()}

// IMPORTANT:
// - Return only the rewritten text as a plain string.
// - No explanations, no notes, no special characters other than punctuation.

//             `)
//             const blindAudioLink = await googleAi.generateTextToSpeech(blindSummary)
//             const res = await fetch(`${process.env.NEXTAUTH_URL}/api/visualize-lesson`, {
//               method: "POST",
//               headers: { "Content-Type": "application/json" },
//               body: JSON.stringify({ text: blindSummary }),
//             });
//             if (!res.ok) {
//               throw new Error("Failed to generate images for blind friendly content");
//             }
//             const data = await res.json();
//             const { publicUrl } = await googleAi.uploadToCloudStorage(filePath, "audio");
//             fs.rmSync(filePath, { force: true, recursive: true });
//             await prisma.files.update({
//               where: { id: fileData.id },
//               data: {
//                 extractedText: blindSummary,
//                 link: publicUrl,
//                 blindFriendlyLink: blindAudioLink,
//                 dislexiaFriendly: data,
//                 status: "completed"
//               }
//             });
//             console.log("Text saved to database successfully");
//           } else {
//             console.log("No text extracted - file might be scanned or empty");
//             fs.rmSync(filePath, { force: true, recursive: true });
//             await prisma.files.update({
//               where: { id: fileData.id },
//               data: {
//                 extractedText: null,
//                 status: "completed"
//               }
//             });
//           }
//         } else {
//           // For other file types, just mark as completed
//           fs.rmSync(filePath, { force: true, recursive: true });
//           console.log("Non-document file processed");
//         }

//       } catch (err: any) {
//         console.error("Background processing error:", err.message);
//         fs.rmSync(filePath, { force: true, recursive: true });
//         await prisma.files.update({
//           where: { id: fileData.id },
//           data: { status: "failed" }
//         });
//       }
//     }, 0);

//     return response;

//   } catch (err: any) {

//     console.error("Upload failed:", err.message);
//     return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
//   }
// }
// export async function GET(req: Request) {
//   const session = await getServerSession(authOptions);
//   const fileId = await req.url.split("fileId=")[1];
//   if (!fileId) {
//     return NextResponse.json({ error: "fileId missing" }, { status: 400 });
//   }

//   if (!fileId) return NextResponse.json({ error: "fileId missing" }, { status: 400 });
//   if (!session) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }
//   if (session.user.role !== "teacher") {
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   }
//   const file = await prisma.files.findFirst({
//     where: { id: fileId },
//     include: { class: true }
//   });
//   if (!file) {
//     return NextResponse.json({ error: "File not found" }, { status: 404 });
//   }
//   if (file.status === "completed" || file.status === "failed") {
//     return NextResponse.json({ message: file.status === "failed" ? "File processing failed" : "File is still processing", status: file.status === "failed" ? "failed" : "completed" }, { status: 200 });
//   }
//   return NextResponse.json({ message: "File is still processing", status: "processing" }, { status: 200 });
// }


import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "fs/promises";
import path from "path";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";

import {
  extractMaterialContext,
} from "@/lib/adhd/extractContext";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE =
  50 * 1024 * 1024;

const ALLOWED_EXTENSIONS =
  new Set([
    "pdf",
    "docx",
    "txt",
    "md",
    "csv",
    "json",
  ]);

function jsonError(
  message: string,
  status = 500
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

export async function POST(
  request: Request
) {
  console.log(
    "======================================"
  );

  console.log(
    "ADHD UPLOAD PIPELINE STARTED"
  );

  console.log(
    "======================================"
  );

  try {
    // ========================================================
    // 1. AUTHENTICATION
    // ========================================================

    const session =
      await getServerSession(
        authOptions
      );

    if (!session?.user) {
      console.error(
        "ADHD upload: Unauthorized"
      );

      return jsonError(
        "Unauthorized session. Please sign in again.",
        401
      );
    }

    console.log(
      "Authenticated user:",
      session.user.email
    );

    // ========================================================
    // 2. READ FORM DATA
    // ========================================================

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    const titleValue =
      formData.get("title");

    if (!(file instanceof File)) {
      return jsonError(
        "No file was uploaded.",
        400
      );
    }

    const originalFileName =
      file.name;

    const extension =
      path
        .extname(originalFileName)
        .toLowerCase()
        .replace(".", "");

    console.log(
      "File:",
      originalFileName
    );

    console.log(
      "Extension:",
      extension
    );

    // ========================================================
    // 3. VALIDATE FILE
    // ========================================================

    if (
      !ALLOWED_EXTENSIONS.has(
        extension
      )
    ) {
      return jsonError(
        `Unsupported file format: .${extension}`,
        400
      );
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return jsonError(
        "File is too large. Maximum size is 50MB.",
        400
      );
    }

    // ========================================================
    // 4. CONVERT FILE TO BUFFER
    // ========================================================

    const arrayBuffer =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(arrayBuffer);

    console.log(
      "File buffer created:",
      buffer.length,
      "bytes"
    );

    // ========================================================
    // 5. CREATE LOCAL STORAGE DIRECTORIES
    // ========================================================

    const uploadDirectory =
      path.join(
        process.cwd(),
        "uploads",
        "adhd"
      );

    const contextDirectory =
      path.join(
        process.cwd(),
        "uploads",
        "adhd",
        "context"
      );

    await fs.mkdir(
      uploadDirectory,
      {
        recursive: true,
      }
    );

    await fs.mkdir(
      contextDirectory,
      {
        recursive: true,
      }
    );

    // ========================================================
    // 6. CREATE SAFE FILE NAME
    // ========================================================

    const timestamp =
      Date.now();

    const safeBaseName =
      path
        .basename(
          originalFileName,
          path.extname(
            originalFileName
          )
        )
        .replace(
          /[^a-zA-Z0-9-_]/g,
          "-"
        )
        .replace(
          /-+/g,
          "-"
        )
        .slice(0, 80);

    const storedFileName =
      `${timestamp}-${safeBaseName}.${extension}`;

    const storedFilePath =
      path.join(
        uploadDirectory,
        storedFileName
      );

    // ========================================================
    // 7. SAVE ORIGINAL MATERIAL LOCALLY
    // ========================================================

    await fs.writeFile(
      storedFilePath,
      buffer
    );

    console.log(
      "Original material saved:",
      storedFilePath
    );

    // ========================================================
    // 8. EXTRACT CONTEXT
    // ========================================================

    console.log(
      "Extracting material context..."
    );

    const extracted =
      await extractMaterialContext(
        buffer,
        originalFileName
      );

    const extractedText =
      extracted.text.trim();

    if (!extractedText) {
      return jsonError(
        "No readable text could be extracted from this material.",
        422
      );
    }

    console.log(
      "Context extracted:",
      extractedText.length,
      "characters"
    );

    // ========================================================
    // 9. SAVE EXTRACTED CONTEXT LOCALLY
    // ========================================================

    const contextFileName =
      `${timestamp}-${safeBaseName}.txt`;

    const contextFilePath =
      path.join(
        contextDirectory,
        contextFileName
      );

    await fs.writeFile(
      contextFilePath,
      extractedText,
      "utf8"
    );

    console.log(
      "Extracted context saved:",
      contextFilePath
    );

    // ========================================================
    // 10. USER ID
    // ========================================================

    /*
     * Adapt this section if your NextAuth user/session
     * uses a different user identifier.
     */

    const userId =
      (session.user as any).id;

    if (!userId) {
      return jsonError(
        "Authenticated user ID is missing from the session.",
        401
      );
    }

    // ========================================================
    // 11. CREATE DATABASE RECORD
    // ========================================================

    const title =
      typeof titleValue === "string" &&
      titleValue.trim()
        ? titleValue.trim()
        : path.basename(
            originalFileName,
            path.extname(
              originalFileName
            )
          );

    console.log(
      "Saving material to database..."
    );

    /*
     * IMPORTANT:
     *
     * These field names must match your Prisma schema.
     *
     * The expected ADHDMaterial fields are:
     *
     * userId
     * fileName
     * fileType
     * filePath
     * contextPath
     * educationalContext
     * status
     * errorMessage
     */

    const material =
      await prisma.adhdMaterial.create(
        {
          data: {
            userId,

            fileName:
              originalFileName,

            fileType:
              extension,

            filePath:
              storedFilePath,

            contextPath:
              contextFilePath,

            educationalContext:
              extractedText,

            status:
              "COMPLETED",

            errorMessage:
              null,
          },
        }
      );

    console.log(
      "Material saved:",
      material.id
    );

    // ========================================================
    // 12. RETURN JSON
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Material uploaded and context extracted successfully.",

        material: {
          id: material.id,

          fileName:
            material.fileName,

          fileType:
            material.fileType,

          title,

          status:
            material.status,

          educationalContext:
            material.educationalContext,

          contextLength:
            extractedText.length,

          createdAt:
            material.createdAt,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "======================================"
    );

    console.error(
      "ADHD UPLOAD ERROR"
    );

    console.error(
      error
    );

    console.error(
      "======================================"
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Failed to process ADHD learning material.",
      500
    );
  }
}