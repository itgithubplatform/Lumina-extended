import mammoth from "mammoth";
import PDFParser from "pdf2json";

export async function extractTextFromBuffer(
  buffer: Buffer,
  ext: string,
  filename: string
): Promise<string> {
  const extension = ext.toLowerCase();

  // 1. PDF Parsing
  if (extension === ".pdf") {
    return new Promise((resolve) => {
      try {
        const pdfParser = new PDFParser(null, 1);

        pdfParser.on("pdfParser_dataError", (errData: any) => {
          console.error("PDF parsing error:", errData?.parserError);
          resolve("");
        });

        pdfParser.on("pdfParser_dataReady", () => {
          try {
            const rawText = pdfParser.getRawTextContent() || "";
            const decodedText = decodeURIComponent(rawText);
            resolve(decodedText.trim());
          } catch (error) {
            resolve("");
          }
        });

        pdfParser.parseBuffer(buffer);
      } catch (err) {
        console.error("PDF module error:", err);
        resolve("");
      }
    });
  }

  // 2. DOCX Parsing
  if (extension === ".docx") {
    try {
      const docxResult = await mammoth.extractRawText({ buffer });
      return docxResult.value.trim();
    } catch (err) {
      console.error("DOCX extraction error:", err);
      return "";
    }
  }

  // 3. Plain Text Parsing
  if (extension === ".txt") {
    return buffer.toString("utf-8").trim();
  }

  // 4. Video & Media Handling
  if ([".mp4", ".webm", ".mov", ".avi", ".mkv"].includes(extension)) {
    return `[Media File Context]: ${filename}. Visual and audio sequence ready for processing.`;
  }

  return "";
}