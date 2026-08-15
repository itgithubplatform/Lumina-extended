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

    // ADDED: Dedicated image generation method using Vertex AI multimodal/image model
    async generateImage(prompt: string): Promise<string> {
        try {
            const imageModel = this.vertex.getGenerativeModel({
                model: "gemini-2.5-flash-image",
                generationConfig: { maxOutputTokens: 1024, temperature: 0.6 },
            });

            const result = await imageModel.generateContent({
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                text: `Generate a clean, high-detail educational vector illustration for this exact slide concept: ${prompt}`,
                            },
                        ],
                    },
                ],
            });

            const candidate = result.response?.candidates?.[0];
            const part = candidate?.content?.parts?.[0];

            if (!part) {
                throw new Error("No content parts returned from Vertex AI Image model");
            }

            const base64Img = part.inlineData?.data || (part as any).fileData?.data;
            if (!base64Img) {
                throw new Error("Base64 image data missing from Vertex AI response.");
            }

            // Save temporary image file locally
            const tempFilePath = `./uploads/${Date.now()}-slide.png`;
            if (!fs.existsSync("./uploads")) {
                fs.mkdirSync("./uploads", { recursive: true });
            }
            await writeFile(tempFilePath, Buffer.from(base64Img, "base64"));

            // Upload to Google Cloud Storage bucket using your existing storage client
            const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
            if (!bucketName) throw new Error("Missing GOOGLE_CLOUD_STORAGE_BUCKET environment variable");

            const bucket = this.storageClient.bucket(bucketName);
            const destination = `slides/${Date.now()}-slide.png`;
            
            await bucket.upload(tempFilePath, {
                destination,
                metadata: { cacheControl: "public, max-age=31536000" },
            });

            fs.unlinkSync(tempFilePath); // Clean up local file

            return `https://storage.googleapis.com/${bucketName}/${destination}`;
        } catch (error) {
            console.error("Vertex AI Image Generation Error:", error);
            throw new Error("Error generating image: " + (error as Error)?.message);
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