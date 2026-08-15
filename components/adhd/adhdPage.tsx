"use client";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  Lock,
  Flame,
  Send,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  ChevronDown,
} from "lucide-react";

// ==========================================
// 1. TYPES
// ==========================================

interface Stop {
  id: number;
  title: string;
  descriptionNormal: string;
  descriptionSimple: string;
  keyIdea: string;
  imageNormal: string;
  imageSimple: string;
  order?: number;
  isClarification?: boolean;
}

interface Lecture {
  id: string;
  title: string;
  duration: string;
  type: string;
  stops: Stop[];
}

interface AdhdMaterial {
  id: string;
  fileName: string;
  status: "processing" | "completed" | "failed";
  createdAt: string;
  _count?: { slides: number };
}

// ==========================================
// 2. HARDCODED DEMO DATA (Fallback)
// ==========================================

const DEMO_LECTURE: Lecture = {
  id: "mitosis",
  title: "Cell Division — Mitosis",
  duration: "6 min walkthrough",
  type: "Demo",
  stops: [
    {
      id: 1,
      title: "Rolling up the Yarn 🧶",
      descriptionNormal:
        "The cell's instruction manuals (DNA) are usually long and stringy. To keep them from tangling, the cell rolls them up into tight, neat little packages called chromosomes.",
      descriptionSimple:
        "The cell rolls its long, stringy instructions into tidy little balls. This keeps them from getting tangled up!",
      keyIdea: "The cell packs its instructions neatly before moving them.",
      imageNormal:
        "https://storage.googleapis.com/concepto-2/adhdImages/1.png",
      imageSimple:
        "https://storage.googleapis.com/concepto-2/adhdImages/1Simplified.png",
    },
    {
      id: 2,
      title: "The Control Room Opens 🚪",
      descriptionNormal:
        "The cell has a safe room in the center where it keeps the instructions. To start dividing, the walls of this safe room melt away so the packages can move freely.",
      descriptionSimple:
        "The cell's center safe room opens up wide. Now the packed instructions can float out and move around freely.",
      keyIdea: "The cell unlocks its center so things can move.",
      imageNormal:
        "https://storage.googleapis.com/concepto-2/adhdImages/2.png",
      imageSimple:
        "https://storage.googleapis.com/concepto-2/adhdImages/2simplified.png",
    },
    {
      id: 3,
      title: "Line Up for the Parade! 🚶‍♂️",
      descriptionNormal:
        "All the neat little packages travel to the very center of the cell. They line up perfectly straight right in the middle, waiting patiently for the next step.",
      descriptionSimple:
        "All the tidy packages travel to the very middle of the cell. They stand perfectly in a straight line, waiting for their turn.",
      keyIdea: "Everything lines up in the center to get ready to share evenly.",
      imageNormal:
        "https://storage.googleapis.com/concepto-2/adhdImages/3.png",
      imageSimple:
        "https://storage.googleapis.com/concepto-2/adhdImages/3simplified.png",
    },
    {
      id: 4,
      title: "The Friendly Tug-of-War 🪢",
      descriptionNormal:
        "Tiny invisible ropes reach out from the edges of the cell and grab the packages. They gently pull the packages apart, sending one matching half to the left, and the other to the right!",
      descriptionSimple:
        "Tiny ropes reach out and grab the lined-up packages. They gently pull one matching half to the left, and the other to the right.",
      keyIdea:
        "The cell pulls exact copies to opposite sides so both sides get the same thing.",
      imageNormal:
        "https://storage.googleapis.com/concepto-2/adhdImages/4.png",
      imageSimple:
        "https://storage.googleapis.com/concepto-2/adhdImages/4simplified.png",
    },
    {
      id: 5,
      title: "Building New Walls 🧱",
      descriptionNormal:
        "Now that the packages are safely separated on opposite sides, the cell builds a brand new safe room around each set. The packages can finally unroll and relax.",
      descriptionSimple:
        "The cell builds a brand new safe room around each set of packages. Now the packages can safely unroll and relax in their new homes.",
      keyIdea: "The cell creates a safe space for each new set of instructions.",
      imageNormal:
        "https://storage.googleapis.com/concepto-2/adhdImages/5.png",
      imageSimple:
        "https://storage.googleapis.com/concepto-2/adhdImages/5simplified.png",
    },
    {
      id: 6,
      title: "Pinch and Pop! 🎈",
      descriptionNormal:
        "Finally, the big cell pinches right in the middle, just like twisting a long balloon. Pop! The cell completely splits, leaving two perfect, happy twin cells ready to grow.",
      descriptionSimple:
        "The big cell pinches right in the middle, just like a long balloon. Pop! It completely splits into two perfect, happy twin cells.",
      keyIdea: "One big cell completely splits into two identical twin cells.",
      imageNormal:
        "https://storage.googleapis.com/concepto-2/adhdImages/6.png",
      imageSimple:
        "https://storage.googleapis.com/concepto-2/adhdImages/6simplified.png",
    },
  ],
};

const QUIZ_BANK = [
  {
    q: "Quick check — does mitosis make 2 or 3 daughter cells?",
    a: "2",
    b: "3",
    correct: "a",
    right: "Exactly right — every daughter cell gets a full matching set.",
    wrong: "Good guess — it's actually 2. Easy mix-up, that number matters more than the reasoning here.",
  },
  {
    q: "True or false: chromosomes coil up before they move.",
    a: "True",
    b: "False",
    correct: "a",
    right: "Yep — coiling stops them tangling mid-move.",
    wrong: "Close call — it's actually True. Coiling happens first so nothing snags.",
  },
  {
    q: "What pulls the chromosomes apart?",
    a: "Spindle fibers",
    b: "The cell wall",
    correct: "a",
    right: "Nailed it — spindle fibers act like tiny tow ropes.",
    wrong: "Reasonable guess — it's spindle fibers, think of them as tiny tow ropes.",
  },
];

const TICKER_LINES = [
  "Redrawing this your way — hang tight 🌱",
  "You've made it through 3 slides today. Good pace.",
  "No rush here. Clear beats fast.",
  "Every question you ask makes the next step easier.",
];

// ==========================================
// 3. HELPERS
// ==========================================

function slideToStop(slide: {
  id: string;
  textContent?: string;
  text?: string;
  imageUrl?: string;
  image?: string;
  order: number;
  isClarification: boolean;
}, index: number): Stop {
  const content = slide.textContent || slide.text || "";
  const img = slide.imageUrl || slide.image || "https://storage.googleapis.com/concepto-2/adhdImages/1.png";

  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);
  const titleWords = content.split(" ").slice(0, 5).join(" ");
  const title = titleWords + (content.split(" ").length > 5 ? "…" : "");
  const keyIdea = sentences[sentences.length - 1] || content;

  return {
    id: index + 1,
    title: slide.isClarification ? `🎯 ${title}` : title,
    descriptionNormal: content,
    descriptionSimple: content,
    keyIdea,
    imageNormal: img,
    imageSimple: img,
    order: slide.order,
    isClarification: slide.isClarification,
  };
}

// ==========================================
// 4. MAIN COMPONENT
// ==========================================

export default function LuminaFocusLab() {
  const [activeLecture, setActiveLecture] = useState<Lecture>(DEMO_LECTURE);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isFocusStageActive, setIsFocusStageActive] = useState<boolean>(false);
  const [streak, setStreak] = useState<number>(3);

  const [isSimplified, setIsSimplified] = useState<boolean>(false);
  const [customExplainer, setCustomExplainer] = useState<{
    quote: string;
    body: string;
  } | null>(null);
  const [isMissPanelOpen, setIsMissPanelOpen] = useState<boolean>(false);
  const [missInputText, setMissInputText] = useState<string>("");

  const [isLoadingOverlay, setIsLoadingOverlay] = useState<boolean>(false);
  const [loaderTitle, setLoaderTitle] = useState<string>("");
  const [quizState, setQuizState] = useState<any>(QUIZ_BANK[0]);
  const [quizFeedback, setQuizFeedback] = useState<{
    show: boolean;
    correct: boolean;
    head: string;
    body: string;
  } | null>(null);
  const [tickerIndex, setTickerIndex] = useState<number>(0);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionsUnlocked, setActionsUnlocked] = useState<boolean>(false);

  const [materials, setMaterials] = useState<AdhdMaterial[]>([]);
  const [isFetchingMaterials, setIsFetchingMaterials] = useState(false);
  const [isLoadingMaterial, setIsLoadingMaterial] = useState(false);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentStop = activeLecture.stops[stepIndex] || activeLecture.stops[0];
  const isDemo = activeLecture.id === "mitosis";

  useEffect(() => {
    fetchMaterials();
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFocusStageActive(false);
        setIsPlaying(false);
        setIsLoadingOverlay(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && isFocusStageActive && !isLoadingOverlay) {
      timer = setInterval(() => {
        setStepIndex((prev) => {
          const next = (prev + 1) % activeLecture.stops.length;
          if (next === 0) setStreak((s) => s + 1);
          return next;
        });
      }, 30000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, isFocusStageActive, isLoadingOverlay, activeLecture.stops.length]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (isLoadingOverlay) {
      t = setInterval(
        () => setTickerIndex((prev) => (prev + 1) % TICKER_LINES.length),
        1800
      );
    }
    return () => clearInterval(t);
  }, [isLoadingOverlay]);

  useEffect(() => {
    setActionsUnlocked(false);
    const t = setTimeout(() => setActionsUnlocked(true), 800);
    return () => clearTimeout(t);
  }, [stepIndex, isSimplified, customExplainer]);

  useEffect(() => {
    setStepIndex(0);
    setIsSimplified(false);
    setCustomExplainer(null);
  }, [activeLecture.id]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function fetchMaterials() {
    setIsFetchingMaterials(true);
    try {
      const res = await fetch("/api/adhd/list");
      if (res.ok) {
        const data = await res.json();
        setMaterials(data.materials || []);
      }
    } catch (e) {
      console.error("Failed to fetch ADHD materials", e);
    } finally {
      setIsFetchingMaterials(false);
    }
  }

  async function fetchMaterialSlides(materialId: string, fileName: string) {
    setIsLoadingMaterial(true);
    try {
      const res = await fetch(`/api/adhd/upload?materialId=${materialId}`);
      if (!res.ok) throw new Error("Failed to load material");
      const data = await res.json();
      const slides: any[] = data.material?.slides || [];

      if (slides.length === 0) {
        triggerToast("No slides yet — still processing?");
        return;
      }

      const stops: Stop[] = slides.map((s: any, i: number) => slideToStop(s, i));

      setActiveLecture({
        id: materialId,
        title: fileName,
        duration: `${stops.length} slides`,
        type: "Uploaded",
        stops,
      });
    } catch (e: any) {
      triggerToast("Couldn't load slides: " + e.message);
    } finally {
      setIsLoadingMaterial(false);
    }
  }

  async function handleUploadSubmit() {
    if (!uploadFile) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);

      const res = await fetch("/api/adhd/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();
      const materialId: string = data.materialId;

      triggerToast("✅ Uploaded! Processing your lesson…");
      setIsUploadOpen(false);
      setUploadFile(null);

      setMaterials((prev) => [
        {
          id: materialId,
          fileName: uploadFile.name,
          status: "processing",
          createdAt: new Date().toISOString(),
          _count: { slides: 0 },
        },
        ...prev,
      ]);

      pollingRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/adhd/upload?materialId=${materialId}`);
          if (!pollRes.ok) return;
          const pollData = await pollRes.json();
          const status = pollData.status as "processing" | "completed" | "failed";
          const slideCount = pollData.material?.slides?.length ?? 0;

          setMaterials((prev) =>
            prev.map((m) =>
              m.id === materialId
                ? { ...m, status, _count: { slides: slideCount } }
                : m
            )
          );

          if (status === "completed" || status === "failed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (status === "completed") {
              triggerToast(`🎉 "${uploadFile.name}" is ready!`);
            } else {
              triggerToast("Processing failed — try a different file format.");
            }
          }
        } catch {
          // silent polling error
        }
      }, 5000);
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setIsUploading(false);
    }
  }

  const triggerToast = (msg: string) => setToastMessage(msg);

  const handleStartFocus = async () => {
    if (activeLecture.stops.length === 0) {
      triggerToast("No slides loaded. Select a lesson from the sidebar.");
      return;
    }
    setStepIndex(0);
    setIsSimplified(false);
    setCustomExplainer(null);
    setIsFocusStageActive(true);
    setIsPlaying(true);
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request denied.", err);
    }
  };

  const handleExitFocus = async () => {
    setIsFocusStageActive(false);
    setIsPlaying(false);
    setIsLoadingOverlay(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
  };

  const handleNextStep = () => {
    setIsPlaying(false);
    setStepIndex((prev) => (prev + 1) % activeLecture.stops.length);
  };

  const handlePrevStep = () => {
    setIsPlaying(false);
    setStepIndex(
      (prev) => (prev - 1 + activeLecture.stops.length) % activeLecture.stops.length
    );
  };

  const runLoaderQuiz = (title: string, onComplete: () => void) => {
    setIsPlaying(false);
    setLoaderTitle(title);
    setQuizFeedback(null);
    setQuizState(QUIZ_BANK[Math.floor(Math.random() * QUIZ_BANK.length)]);
    setIsLoadingOverlay(true);
    setTimeout(() => {
      setIsLoadingOverlay(false);
      onComplete();
    }, 12000);
  };

  const handleSimplifySlide = async () => {
    if (!isDemo && activeLecture.id && currentStop.order !== undefined) {
      runLoaderQuiz("Redrawing this step in a simpler way…", async () => {
        try {
          const res = await fetch("/api/adhd/clarify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              materialId: activeLecture.id,
              currentOrder: currentStop.order,
              slideText: currentStop.descriptionNormal,
              question: "Please explain this even simpler for a learner with ADHD",
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const newStop = slideToStop(data.newSlide, activeLecture.stops.length);
            setActiveLecture((prev) => {
              const newStops = [...prev.stops];
              newStops.splice(stepIndex + 1, 0, newStop);
              return { ...prev, stops: newStops };
            });
            setStepIndex((prev) => prev + 1);
            triggerToast("Simplified slide added right after this one ✨");
          }
        } catch {
          triggerToast("Simplify failed — try again");
        }
      });
    } else {
      runLoaderQuiz("Redrawing this step in a simpler way…", () => {
        setIsSimplified((prev) => !prev);
        triggerToast("Simplified: shorter sentence + a plainer visual");
      });
    }
  };

  const handleMissSubmit = async () => {
    if (!missInputText.trim()) return;
    const submittedText = missInputText;
    setIsMissPanelOpen(false);
    setMissInputText("");

    if (!isDemo && activeLecture.id && currentStop.order !== undefined) {
      runLoaderQuiz("Building a focused explainer around what you typed…", async () => {
        try {
          const res = await fetch("/api/adhd/clarify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              materialId: activeLecture.id,
              currentOrder: currentStop.order,
              slideText: currentStop.descriptionNormal,
              question: submittedText,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const newStop = slideToStop(data.newSlide, activeLecture.stops.length);
            setActiveLecture((prev) => {
              const newStops = [...prev.stops];
              newStops.splice(stepIndex + 1, 0, newStop);
              return { ...prev, stops: newStops };
            });
            setStepIndex((prev) => prev + 1);
            triggerToast("🎯 Clarification slide added just for you");
          } else {
            triggerToast("Couldn't get clarification — try again");
          }
        } catch {
          triggerToast("Clarification failed — check your connection");
        }
      });
    } else {
      runLoaderQuiz("Building a focused explainer around what you typed…", () => {
        setCustomExplainer({
          quote: `"${submittedText}"`,
          body: "Here's this step rebuilt around just that — a plainer visual, no extra detail added on top, so there's one less thing competing for your attention.",
        });
        triggerToast("Got it — this step now zooms in on what you asked about");
      });
    }
  };

  const handleQuizAnswer = (selectedKey: string) => {
    const correct = selectedKey === quizState.correct;
    setQuizFeedback({
      show: true,
      correct,
      head: correct ? "Exactly right!" : "Good thinking!",
      body: correct ? quizState.right : quizState.wrong,
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setUploadFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadFile(file);
  };

  return (
    <div className="min-h-screen mt-16 bg-[#F5FAF7] text-[#1E2A24] font-sans antialiased selection:bg-[#EAF3EE]">
      {/* --- DASHBOARD SHELL --- */}
      <div className="max-w-7xl mx-auto min-h-screen grid grid-cols-1 md:grid-cols-[272px_1fr]">
        <aside className="hidden md:flex flex-col gap-4 p-6 border-r border-[#E1ECE6] bg-[#F5FAF7]">
          {/* Upload Button Toggle */}
          <button
            onClick={() => setIsUploadOpen((v) => !v)}
            className="flex items-center gap-2 w-full bg-[#1F9C7C] hover:bg-[#167C63] text-white font-semibold px-4 py-2.5 rounded-xl transition-all text-sm shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>Upload a lesson</span>
            <ChevronDown
              className={`w-3.5 h-3.5 ml-auto transition-transform ${isUploadOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Upload Dropdown Panel */}
          <AnimatePresence>
            {isUploadOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white border border-[#E1ECE6] rounded-2xl p-4 flex flex-col gap-3">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? "border-[#1F9C7C] bg-[#EAF6F2]"
                        : "border-[#CFEBDD] bg-[#F9FEFC] hover:bg-[#F0FAF5]"
                    }`}
                  >
                    <FileText className="w-6 h-6 text-[#1F9C7C] mx-auto mb-2" />
                    {uploadFile ? (
                      <p className="text-xs font-semibold text-[#1E2A24] truncate px-2">
                        {uploadFile.name}
                      </p>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-[#1E2A24]">
                          Drop file or click to browse
                        </p>
                        <p className="text-[11px] text-[#5B6B62] mt-1">
                          PDF, DOCX, MP4, MOV, WEBM
                        </p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.mp4,.mov,.avi,.mkv,.webm,.flv,.wmv,.m4v"
                      onChange={handleFileChange}
                    />
                  </div>

                  {uploadError && (
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {uploadError}
                    </div>
                  )}

                  <button
                    onClick={handleUploadSubmit}
                    disabled={!uploadFile || isUploading}
                    className="w-full flex items-center justify-center gap-2 bg-[#1F9C7C] hover:bg-[#167C63] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-xs transition-all"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        Process lesson
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <span className="text-[11px] font-semibold tracking-wider text-[#5B6B62] uppercase px-1 mt-2">
            {isFetchingMaterials ? "Loading…" : "Your lessons"}
          </span>

          <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[50vh]">
            {/* Demo Item */}
            {(() => {
              const isActive = activeLecture.id === "mitosis";
              return (
                <button
                  onClick={() => setActiveLecture(DEMO_LECTURE)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                    isActive
                      ? "bg-[#E7F6EF] border-[#CDEBDC] text-[#1E2A24]"
                      : "border-transparent hover:bg-[#EEF6F1] text-[#1E2A24]"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${
                      isActive ? "bg-[#1F9C7C] text-white" : "bg-[#EAF1EC] text-[#5B6B62]"
                    }`}
                  >
                    ▶
                  </span>
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-semibold text-sm truncate">
                      {DEMO_LECTURE.title}
                    </span>
                    <span className="text-xs text-[#5B6B62]">Demo · 6 slides</span>
                  </div>
                </button>
              );
            })()}

            {/* Uploaded Materials List */}
            {materials.map((m) => {
              const isActive = activeLecture.id === m.id;
              const isProcessing = m.status === "processing";
              const isFailed = m.status === "failed";
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    if (isProcessing || isFailed) return;
                    fetchMaterialSlides(m.id, m.fileName);
                  }}
                  disabled={isProcessing || isFailed || isLoadingMaterial}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                    isActive
                      ? "bg-[#E7F6EF] border-[#CDEBDC]"
                      : isProcessing || isFailed
                      ? "border-transparent opacity-60 cursor-not-allowed"
                      : "border-transparent hover:bg-[#EEF6F1]"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isProcessing
                        ? "bg-[#FFF3CD]"
                        : isFailed
                        ? "bg-red-50"
                        : isActive
                        ? "bg-[#1F9C7C] text-white"
                        : "bg-[#EAF1EC] text-[#5B6B62]"
                    }`}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
                    ) : isFailed ? (
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    ) : isActive ? (
                      <span className="text-xs">▶</span>
                    ) : (
                      <CheckCircle className="w-3 h-3 text-[#1F9C7C]" />
                    )}
                  </span>
                  <div className="flex flex-col overflow-hidden min-w-0">
                    <span className="font-semibold text-sm truncate text-[#1E2A24]">
                      {m.fileName}
                    </span>
                    <span className="text-xs text-[#5B6B62]">
                      {isProcessing
                        ? "Processing…"
                        : isFailed
                        ? "Failed"
                        : `${m._count?.slides ?? 0} slides`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-auto border border-dashed border-[#CFE3D7] rounded-2xl p-4 bg-[#FBFEFC]">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1E2A24]">
              <Lock className="w-3.5 h-3.5 text-[#1F9C7C]" />
              <span>Your focus pattern</span>
            </div>
            <p className="text-xs text-[#5B6B62] mt-1.5 leading-relaxed">
              Once the full AI engine is live, this panel will show when and how you focus best.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="p-6 md:p-10 flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#1E2A24]">Focus Lab</h1>
              <div className="flex items-center gap-2 text-sm text-[#5B6B62] mt-1">
                <span className="inline-flex items-center gap-1.5 bg-[#EAF3EE] text-[#167C63] px-2.5 py-1 rounded-full text-xs font-semibold">
                  🧠 ADHD Focus Mode
                </span>
                <span>Designed for attention, not against it</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white border border-[#E1ECE6] rounded-2xl px-4 py-2.5 shadow-sm text-sm font-semibold">
              <Flame className="w-4 h-4 text-[#FF7A59]" />
              <span>Focus streak:</span>
              <span className="text-[#167C63] font-bold">{streak}</span>
              <span>slides</span>
            </div>
          </div>

          {/* Mobile Upload Toggle Trigger */}
          <div className="md:hidden">
            <button
              onClick={() => setIsUploadOpen((v) => !v)}
              className="flex items-center justify-center gap-2 w-full bg-[#1F9C7C] text-white font-semibold px-4 py-3 rounded-xl shadow-sm text-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Upload or select a lesson</span>
            </button>
          </div>

          <div className="bg-white border border-[#E1ECE6] rounded-3xl p-8 md:p-12 shadow-sm flex flex-col items-center text-center max-w-2xl mx-auto my-auto gap-5">
            <span className="text-5xl">🖐️</span>
            <h2 className="text-xl font-bold text-[#1E2A24]">
              Ready when you are: {activeLecture.title}
            </h2>
            <p className="text-sm text-[#5B6B62] max-w-md leading-relaxed">
              Starting a lecture switches to a distraction-free full-screen view — one step, one visual, one idea at a time.
            </p>
            <button
              onClick={handleStartFocus}
              className="mt-2 bg-[#1F9C7C] hover:bg-[#167C63] text-white font-semibold px-6 py-3.5 rounded-xl transition-all shadow-sm flex items-center gap-2 text-sm"
            >
              <span>Start focus session</span>
              <span>→</span>
            </button>
          </div>
        </main>
      </div>

      {/* ==========================================
          5. FULLSCREEN FOCUS STAGE OVERLAY
      ========================================== */}
      <AnimatePresence>
        {isFocusStageActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#F5FAF7] z-[9999] flex flex-col items-center overflow-y-auto p-4 md:p-8"
          >
            <div className="w-full max-w-5xl flex justify-between items-center mb-4">
              <button
                onClick={handleExitFocus}
                className="inline-flex items-center gap-2 bg-white hover:bg-[#EEF6F1] border border-[#E1ECE6] text-[#5B6B62] hover:text-[#1E2A24] px-4 py-2 rounded-full text-xs font-semibold transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Exit focus session</span>
              </button>
              <span className="text-xs font-semibold text-[#5B6B62]">
                Lumina · Attention Mode
              </span>
            </div>

            <div className="w-full max-w-5xl flex flex-col gap-5 my-auto">
              <h2 className="text-xl font-bold text-center text-[#1E2A24]">
                {activeLecture.title}
              </h2>

              <div className="bg-white border border-[#E1ECE6] rounded-3xl shadow-sm overflow-hidden flex flex-col">
                {/* Visual Canvas Area */}
                <div className="relative w-full h-[45vh] min-h-[300px] max-h-[500px] bg-[#0F1712] overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={`${currentStop.id}-${isSimplified ? "simple" : "normal"}`}
                      src={isSimplified ? currentStop.imageSimple : currentStop.imageNormal}
                      alt="Lecture visual step"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </AnimatePresence>

                  <div className="absolute top-4 left-4 bg-[#0F1712]/60 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                    Step {stepIndex + 1} of {activeLecture.stops.length}
                  </div>

                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#0F1712]/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-[#0F1712]/80 transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>

                  {/* Loading / Quiz Overlay */}
                  <AnimatePresence>
                    {isLoadingOverlay && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-[#090F0B]/95 z-20 flex flex-col items-center justify-center p-6 text-white text-center gap-4"
                      >
                        <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-[#FFC857] animate-spin" />
                        <h3 className="font-bold text-base">{loaderTitle}</h3>

                        <div className="bg-white/10 border border-white/15 rounded-2xl p-5 max-w-sm w-full flex flex-col items-center gap-3">
                          <span className="text-2xl">🤔</span>
                          <p className="text-sm text-[#EEF6F1] leading-relaxed">
                            {quizState.q}
                          </p>
                          <div className="flex gap-3 w-full justify-center">
                            <button
                              onClick={() => handleQuizAnswer("a")}
                              className="bg-white/15 hover:bg-white/25 border border-white/30 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all"
                            >
                              {quizState.a}
                            </button>
                            <button
                              onClick={() => handleQuizAnswer("b")}
                              className="bg-white/15 hover:bg-white/25 border border-white/30 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all"
                            >
                              {quizState.b}
                            </button>
                          </div>

                          <AnimatePresence>
                            {quizFeedback?.show && (
                              <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="w-full mt-2 rounded-xl p-3.5 bg-[#FFC857]/15 border border-[#FFC857]/50 flex items-start gap-3 text-left"
                              >
                                <span className="text-xl leading-none">
                                  {quizFeedback.correct ? "👍" : "💪"}
                                </span>
                                <div>
                                  <div className="font-bold text-xs text-[#FFC857] mb-1">
                                    {quizFeedback.head}
                                  </div>
                                  <div className="text-xs text-[#F5F1E6] leading-relaxed">
                                    {quizFeedback.body}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <span className="text-[11px] text-white/50 mt-1">
                          Take your time — no rush to answer
                        </span>
                        <div className="text-xs text-white/70 min-h-[18px]">
                          {TICKER_LINES[tickerIndex]}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Caption Banner & Slide Progress Dots */}
                <div className="p-6 flex flex-col gap-4">
                  <div className="flex justify-center gap-2">
                    {activeLecture.stops.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setIsPlaying(false);
                          setStepIndex(i);
                        }}
                        className={`h-2 rounded-full transition-all ${
                          i === stepIndex
                            ? "w-7 bg-[#1F9C7C]"
                            : "w-2 bg-[#D9E6DD] hover:bg-[#A3C4B3]"
                        }`}
                      />
                    ))}
                  </div>

                  <motion.div
                    key={`${currentStop.id}-${isSimplified}`}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#F3FBF7] border border-[#CFEBDD] rounded-2xl p-5 shadow-sm text-left flex flex-col gap-3"
                  >
                    <h3 className="text-lg font-bold text-[#1E2A24] m-0 leading-tight">
                      {currentStop.title}
                    </h3>
                    
                    <p className="text-[15px] font-medium text-[#1E2A24] leading-relaxed m-0">
                      {isSimplified ? currentStop.descriptionSimple : currentStop.descriptionNormal}
                    </p>

                    <div className="bg-[#E7F6EF] rounded-xl p-3.5 border border-[#CDEBDC] flex gap-3 items-start mt-2 shadow-sm">
                      <span className="text-xl leading-none">💡</span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-bold text-[#167C63] uppercase tracking-widest">
                          Key Idea
                        </span>
                        <span className="text-[13.5px] font-semibold text-[#1E2A24] leading-snug">
                          {currentStop.keyIdea}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </div>

                <div className="px-6 pb-6 pt-2 flex items-center justify-between border-t border-[#E1ECE6]/60">
                  <button
                    onClick={handlePrevStep}
                    className="flex items-center gap-1.5 bg-[#F5FAF7] hover:bg-[#EEF6F1] border border-[#E1ECE6] px-4 py-2 rounded-xl text-xs font-semibold text-[#1E2A24] transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <span className="text-xs text-[#5B6B62] font-medium">
                    Step {stepIndex + 1} of {activeLecture.stops.length}
                  </span>
                  <button
                    onClick={handleNextStep}
                    className="flex items-center gap-1.5 bg-[#F5FAF7] hover:bg-[#EEF6F1] border border-[#E1ECE6] px-4 py-2 rounded-xl text-xs font-semibold text-[#1E2A24] transition-colors"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action Rows */}
              <div className="flex flex-col gap-3">
                {!actionsUnlocked && (
                  <div className="text-center text-xs text-[#5B6B62] flex items-center justify-center gap-1.5 py-1">
                    <span>✎</span>
                    <span>finishing this step — options unlock right after</span>
                  </div>
                )}

                <AnimatePresence>
                  {actionsUnlocked && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      <div className="bg-white border border-[#E1ECE6] rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 font-bold text-sm text-[#1E2A24] mb-1">
                            <span className="w-6 h-6 rounded-lg bg-[#FFC857] text-[#5B4200] flex items-center justify-center text-xs">
                              ✦
                            </span>
                            <span>Losing the thread?</span>
                          </div>
                          <p className="text-xs text-[#5B6B62] leading-relaxed">
                            We'll redraw this step in a plainer way — shorter sentence, bigger visual cue.
                          </p>
                        </div>
                        <button
                          onClick={handleSimplifySlide}
                          className="w-fit bg-[#1F9C7C] hover:bg-[#167C63] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{isSimplified ? "Show detailed version" : "Make it simpler"}</span>
                        </button>
                      </div>

                      <div className="bg-white border border-[#E1ECE6] rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 font-bold text-sm text-[#1E2A24] mb-1">
                            <span className="w-6 h-6 rounded-lg bg-[#4C7EF3] text-white flex items-center justify-center text-xs">
                              ?
                            </span>
                            <span>Tell us what you missed</span>
                          </div>
                          <p className="text-xs text-[#5B6B62] leading-relaxed">
                            Type the exact part that lost you — we'll build a fresh explainer around just that.
                          </p>
                        </div>

                        {!isMissPanelOpen ? (
                          <button
                            onClick={() => setIsMissPanelOpen(true)}
                            className="w-fit bg-transparent hover:bg-[#EEF6F1] border border-[#E1ECE6] text-[#1E2A24] text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
                          >
                            Open input
                          </button>
                        ) : (
                          <div className="flex flex-col gap-2.5 mt-1">
                            <textarea
                              value={missInputText}
                              onChange={(e) => setMissInputText(e.target.value)}
                              placeholder="e.g. 'I don't get why the fibers pull the chromosomes apart'"
                              maxLength={300}
                              rows={3}
                              className="w-full text-xs p-3 rounded-xl border border-[#E1ECE6] bg-[#F5FAF7] focus:outline-none focus:border-[#4C7EF3] transition-colors resize-none"
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-[#5B6B62]">
                                {missInputText.length} / 300
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setIsMissPanelOpen(false)}
                                  className="text-xs text-[#5B6B62] hover:text-[#1E2A24] px-2 py-1"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleMissSubmit}
                                  className="bg-[#1F9C7C] hover:bg-[#167C63] text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1"
                                >
                                  <span>Simplify this part</span>
                                  <Send className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {customExplainer && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="bg-[#F2FBF6] border border-[#CDEBDC] rounded-2xl p-5 flex flex-col gap-1.5 shadow-sm"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-sm text-[#1E2A24]">
                      <span>🎯</span>
                      <span>Focused just for you</span>
                    </div>
                    <div className="text-xs italic text-[#5B6B62]">
                      {customExplainer.quote}
                    </div>
                    <div className="text-xs text-[#1E2A24] leading-relaxed mt-1">
                      {customExplainer.body}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1E2A24] text-white text-xs font-medium px-5 py-3 rounded-full shadow-lg z-[100] whitespace-nowrap"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}