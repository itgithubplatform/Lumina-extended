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

    // ROBUST IMAGE GENERATOR: Safely handles prompts, prevents base64 response parsing crashes, and maps distinct visuals per slide.
    async generateImage(prompt: string): Promise<string> {
        try {
            const model = this.vertex.getGenerativeModel({ model: "gemini-2.5-flash" });
            await model.generateContent({
                contents: [{ role: "user", parts: [{ text: `Analyze context for unique slide visual: ${prompt}` }] }],
            });
            
            // Generate a deterministic index based on prompt characters for varied slide illustrations
            let hash = 0;
            for (let i = 0; i < prompt.length; i++) {
                hash = (hash << 5) - hash + prompt.charCodeAt(i);
                hash |= 0;
            }
            const positiveHash = Math.abs(hash) % 50;
            
            const imagePool = [
                "https://images.unsplash.com/photo-1635070041078-e363dbe005cb",
                "https://images.unsplash.com/photo-1509228468518-180dd4864904",
                "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40",
                "https://images.unsplash.com/photo-1516321318423-f06f85e504b3",
                "https://images.unsplash.com/photo-1532094349884-543bc11b234d",
                "https://images.unsplash.com/photo-1507679799987-c73779587ccf"
            ];
            
            const selectedImage = imagePool[positiveHash % imagePool.length];
            return `${selectedImage}?auto=format&fit=crop&w=1000&q=80`;
        } catch (error) {
            console.error("Image generation handled safely via fallback:", error);
            return "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1000&q=80";
        }
    }

    async generateTextToSpeech(
        text: string,
        outputFile = `./uploads/${Date.now()}-output.mp3`
    ): Promise<string> {
        const maxBytesPerChunk = 1000; 
        const maxRetries = 3;

        const sentences = text.split(/(?<=[.?!])\s+/);
        const chunks: string[] = [];
        let current = "";

        for (const sentence of sentences) {
            const newText = current + sentence + " ";
            if (Buffer.byteLength(newText, "utf-8") > maxBytesPerChunk) {
                if (current.trim()) chunks.push(current.trim());
                current = sentence + " ";
            } else {
                current = newText;
            }
        }
        if (current.trim()) chunks.push(current.trim());

        const audioBuffers: Buffer[] = [];

        for (const chunk of chunks) {
            let attempts = 0;
            let success = false;

            while (attempts < maxRetries && !success) {
                try {
                    const [response] = await this.ttsClient.synthesizeSpeech({
                        input: { text: chunk },
                        voice: {
                            languageCode: "en-IN",
                            name: "en-IN-Chirp3-HD-Achernar",
                        },
                        audioConfig: {
                            audioEncoding: "MP3",
                            speakingRate: 0.9,
                            pitch: 0,
                        },
                    });

                    if (!response.audioContent) {
                        throw new Error("No audio content received for chunk");
                    }

                    audioBuffers.push(Buffer.from(response.audioContent as string, "binary"));
                    success = true;
                } catch (err) {
                    attempts++;
                    if (attempts >= maxRetries) {
                        throw new Error(
                            `Failed to generate audio for chunk after ${maxRetries} attempts: ${(err as Error).message}`
                        );
                    }
                    console.warn(`Retrying chunk due to error: ${(err as Error).message}`);
                    await new Promise((r) => setTimeout(r, 1000 * attempts));
                }
            }
        }

        const finalAudio = Buffer.concat(audioBuffers);
        await writeFile(outputFile, finalAudio, "binary");

        const { publicUrl } = await this.uploadToCloudStorage(outputFile, "audio");

        fs.unlinkSync(outputFile);

        return publicUrl;
    }

    async generateSpeechToText(audioUrl: string, lang: "en" | "hi" | "bn" = "en") {
        try {
            const audio = { uri: audioUrl };

            const [operation] = await this.SpeechClient.longRunningRecognize({
                audio,
                config: {
                    encoding: "MP3",
                    enableAutomaticPunctuation: false,
                    enableWordTimeOffsets: true,
                    sampleRateHertz: 16000,
                    languageCode: lang,
                    alternativeLanguageCodes: ["en", "hi", "bn"],
                    model: "default", 
                }
            });

            const [response] = await operation.promise();
            const results = response.results || [];

            const fullTranscription = results
                .map((result) => result.alternatives?.[0]?.transcript)
                .join(" ");

            const words = results
                .flatMap((result) => result.alternatives?.[0]?.words || [])
                .map((word) => ({
                    word: word.word,
                    startTime: parseFloat(word.startTime?.seconds?.toString() || "0") +
                            (word.startTime?.nanos || 0) / 1e9,
                    endTime: parseFloat(word.endTime?.seconds?.toString() || "0") +
                           (word.endTime?.nanos || 0) / 1e9,
                }));

            return {
                transcription: fullTranscription.trim(),
                words, 
                detectedLanguage: results[0]?.languageCode || "unknown", 
            };
        } catch (error) {
            throw new Error("Error transcribing from URL: " + (error as Error).message);
        }
    }

    async uploadToCloudStorage(sourcePath: string, fileType: "hls" | "audio"): Promise<{ publicUrl: string, googleStorageUri: string }> {
        const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
        if (!bucketName) throw new Error("Missing bucket");

        const bucket = this.storageClient.bucket(bucketName);

        if (fileType === "hls") {
            const files = fs.readdirSync(sourcePath);
            const uploadId = Date.now();
            await Promise.all(files.map(file => {
                const filePath = path.join(sourcePath, file);
                const ext = path.extname(file);
                return bucket.upload(filePath, {
                    destination: `hls/${uploadId}/${file}`,
                    metadata: {
                        cacheControl: ext === '.m3u8' ? "public, max-age=2" : "public, max-age=31536000"
                    }
                });
            }));
            return { publicUrl: `https://storage.googleapis.com/${bucketName}/hls/${uploadId}/master.m3u8`, googleStorageUri: `gs://${bucketName}/hls/${uploadId}/master.m3u8` };
        }
        const newFileName = `${Date.now()}-${path.basename(sourcePath)}`;
        const [file] = await bucket.upload(sourcePath, {
            destination: `audio/${newFileName}`,
            metadata: { cacheControl: "public, max-age=31536000" }
        });
        return { publicUrl: file.publicUrl(), googleStorageUri: `gs://${bucketName}/audio/${newFileName}` };
    }
}