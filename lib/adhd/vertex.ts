import { VertexAI } from "@google-cloud/vertexai";

const project = process.env.GOOGLE_PROJECT_ID;
const location = process.env.LOCATION || "us-central1";

if (!project) {
  throw new Error("GOOGLE_PROJECT_ID is missing");
}

const vertexAI = new VertexAI({
  project,
  location,
});

export const textModel = vertexAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export const imageModel = vertexAI.getGenerativeModel({
  model: "gemini-2.5-flash-image",
});

export async function generateText(prompt: string): Promise<string> {
  const result = await textModel.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 7000,
    },
  });

  return (
    result.response?.candidates?.[0]?.content?.parts
      ?.filter((part: any) => part.text)
      ?.map((part: any) => part.text)
      ?.join("\n")
      ?.trim() || ""
  );
}

export async function generateFromGcs(
  gcsUri: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const result = await textModel.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            fileData: {
              fileUri: gcsUri,
              mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 12000,
    },
  });

  return (
    result.response?.candidates?.[0]?.content?.parts
      ?.filter((part: any) => part.text)
      ?.map((part: any) => part.text)
      ?.join("\n")
      ?.trim() || ""
  );
}