import { VertexAI } from "@google-cloud/vertexai";
import textToSpeech from "@google-cloud/text-to-speech";
import { writeFile } from "fs/promises";
import { Storage } from "@google-cloud/storage";
import path from "path";
import fs from "fs";
import Speech from "@google-cloud/speech";

export class GoogleAi {
    private static instance: GoogleAi;
    private vertex;
    private ttsClient;
    private storageClient;
    private SpeechClient;

    private constructor() {
        const projectID = process.env.GOOGLE_PROJECT_ID;
        if (!projectID) {
            throw new Error("Missing GOOGLE_PROJECT_ID environment variable");
        }
        this.vertex = new VertexAI({
            project: projectID,
            googleAuthOptions: {
                keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            },
            location: process.env.LOCATION || "us-central1",
        });
        this.ttsClient = new textToSpeech.TextToSpeechClient();
        this.storageClient = new Storage();
        this.SpeechClient = new Speech.SpeechClient();
    }

    public static getInstance(): GoogleAi {
        if (!GoogleAi.instance) {
            GoogleAi.instance = new GoogleAi();
        }
        return GoogleAi.instance;
    }

    async generateText(prompt: string) {
        try {
            const model = this.vertex.getGenerativeModel({ model: "gemini-2.5-flash" });
            const response = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            });
            return response.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        } catch (error) {
            throw new Error("Error generating text: " + (error as Error)?.message);
        }
    }

    async generateImage(prompt: string): Promise<string> {
        try {
            const model = this.vertex.getGenerativeModel({ model: "gemini-2.5-flash" });
            
            // Ask Gemini to extract a precise 1-2 word visual subject specifically for this slide's prompt
            const keywordPrompt = `Analyze this slide prompt and extract exactly 1 or 2 high-impact English visual search keywords for an educational illustration or photograph (e.g., "cybersecurity network", "medical laboratory", "business analytics", "quantum physics", "historical library", "software architecture"). Return ONLY the keywords, no markdown:\n\n${prompt}`;
            
            const keywordRes = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: keywordPrompt }] }],
            });
            
            const keyword = keywordRes.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "modern technology education";
            const encodedQuery = encodeURIComponent(keyword);

            // Generate a unique image URL using Unsplash Source with a cache-busting signature based on the prompt content hash
            let hash = 0;
            for (let i = 0; i < prompt.length; i++) {
                hash = (hash << 5) - hash + prompt.charCodeAt(i);
                hash |= 0;
            }
            const uniqueSig = Math.abs(hash);

            return `https://images.unsplash.com/featured/1200x800/?${encodedQuery}&sig=${uniqueSig}`;
        } catch (error) {
            return `https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80&sig=${Date.now()}`;
        }
    }

    async generateTextToSpeech(text: string, outputFile = `./uploads/${Date.now()}-output.mp3`): Promise<string> {
        const [response] = await this.ttsClient.synthesizeSpeech({
            input: { text },
            voice: { languageCode: "en-IN", name: "en-IN-Chirp3-HD-Achernar" },
            audioConfig: { audioEncoding: "MP3" },
        });
        if (!response.audioContent) throw new Error("No audio content");
        await writeFile(outputFile, Buffer.from(response.audioContent as string, "binary"), "binary");
        const { publicUrl } = await this.uploadToCloudStorage(outputFile, "audio");
        fs.unlinkSync(outputFile);
        return publicUrl;
    }

    async generateSpeechToText(audioUrl: string) {
        return { transcription: "", words: [], detectedLanguage: "en" };
    }

    async uploadToCloudStorage(sourcePath: string, fileType: "hls" | "audio"): Promise<{ publicUrl: string, googleStorageUri: string }> {
        const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
        if (!bucketName) throw new Error("Missing bucket");
        const bucket = this.storageClient.bucket(bucketName);
        const newFileName = `${Date.now()}-${path.basename(sourcePath)}`;
        const [file] = await bucket.upload(sourcePath, { destination: `audio/${newFileName}` });
        return { publicUrl: file.publicUrl(), googleStorageUri: `gs://${bucketName}/audio/${newFileName}` };
    }
}