"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface Stop {
  id: number;
  title: string;
  descriptionNormal: string;
  descriptionSimple: string;
  keyIdea: string;
  imageNormal: string;
  imageSimple: string;
}

export default function FocusSessionViewer({ materialId }: { materialId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [title, setTitle] = useState("Focus Session");
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSimplified, setIsSimplified] = useState(false);

  useEffect(() => {
    async function loadDynamicLesson() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/adhd/material-upload?id=${materialId}`);
        const data = await res.json();
        const material = data?.material || data?.materials?.find((m: any) => m.id === materialId);

        const aiRes = await fetch("/api/adhd/generate-slides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            materialId,
            textContent: material?.content || "",
            fileName: material?.fileName || "Uploaded Material",
          }),
        });

        const aiData = await aiRes.json();
        if (aiData.success && aiData.data?.stops) {
          setStops(aiData.data.stops);
          setTitle(aiData.data.title);
        } else {
          throw new Error(aiData.error || "Failed to parse lesson structure.");
        }
      } catch (err: any) {
        console.error("Failed to load dynamic slides:", err);
        setError(err.message || "Failed to load focus session.");
      } finally {
        setLoading(false);
      }
    }

    if (materialId) {
      loadDynamicLesson();
    }
  }, [materialId]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && stops.length > 0) {
      timer = setInterval(() => {
        setStepIndex((prev) => (prev + 1) % stops.length);
      }, 15000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, stops.length]);

  if (loading) {
    return (
      <div className= "min-h-screen bg-[#0F1712] flex flex-col items-center justify-center text-white gap-3 p-4 text-center" >
      <Loader2 className="w-8 h-8 animate-spin text-[#1F9C7C]" />
        <p className="text-sm font-semibold" > Generating dynamic story & scenes via Vertex AI...</p>
          < span className = "text-xs text-white/50" > Processing material: { materialId } </span>
            </div>
    );
  }

  if (error || stops.length === 0) {
    return (
      <div className= "min-h-screen bg-[#F5FAF7] flex flex-col items-center justify-center p-6 text-center" >
      <div className="bg-white border border-[#E1ECE6] rounded-3xl p-8 max-w-md w-full shadow-sm flex flex-col items-center gap-4" >
        <AlertCircle className="w-10 h-10 text-red-500" />
          <h2 className="text-lg font-bold text-[#1E2A24]" > Lesson Load Failed </h2>
            < p className = "text-xs text-[#5B6B62]" > { error || "No stops generated."
  } </p>
    < button
  onClick = {() => router.back()
}
className = "bg-[#1F9C7C] text-white text-xs font-semibold px-5 py-2.5 rounded-xl"
  >
  Return to Focus Lab
    </button>
    </div>
    </div>
    );
  }

const currentStop = stops[stepIndex];

return (
  <div className= "min-h-screen bg-[#F5FAF7] p-4 md:p-8 flex flex-col items-center" >
  <div className="w-full max-w-4xl flex justify-between items-center mb-4" >
    <button
          onClick={ () => router.back() }
className = "inline-flex items-center gap-2 bg-white border border-[#E1ECE6] text-[#5B6B62] hover:text-[#1E2A24] px-4 py-2 rounded-full text-xs font-semibold shadow-sm"
  >
  <X className="w-3.5 h-3.5" />
    <span>Exit focus session </span>
      </button>
      < span className = "text-xs font-semibold text-[#5B6B62] truncate max-w-[250px]" >
        { title }
        </span>
        </div>

        < div className = "w-full max-w-4xl bg-white border border-[#E1ECE6] rounded-3xl shadow-sm overflow-hidden flex flex-col my-auto" >
          <div className="relative w-full h-[45vh] min-h-[300px] max-h-[480px] bg-[#0F1712]" >
            <AnimatePresence mode="wait" >
              <motion.img
              key={ `${currentStop.id}-${isSimplified ? "simple" : "normal"}` }
src = { isSimplified? currentStop.imageSimple : currentStop.imageNormal }
alt = "Scene visual"
initial = {{ opacity: 0 }}
animate = {{ opacity: 1 }}
exit = {{ opacity: 0 }}
transition = {{ duration: 0.35 }}
className = "absolute inset-0 w-full h-full object-cover"
  />
  </AnimatePresence>

  < div className = "absolute top-4 left-4 bg-[#0F1712]/60 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full" >
    Step { stepIndex + 1 } of { stops.length }
</div>

  < button
onClick = {() => setIsPlaying(!isPlaying)}
className = "absolute top-4 right-4 w-9 h-9 rounded-full bg-[#0F1712]/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-[#0F1712]/80 transition-colors"
  >
  { isPlaying?<Pause className = "w-4 h-4" /> : <Play className="w-4 h-4" />}
</button>
  </div>

  < div className = "p-6 flex flex-col gap-4" >
    <div className="flex justify-between items-center" >
      <div className="flex gap-2" >
      {
        stops.map((_, i) => (
          <button
                  key= { i }
                  onClick = {() => setStepIndex(i)}
className = {`h-2 rounded-full transition-all ${i === stepIndex ? "w-7 bg-[#1F9C7C]" : "w-2 bg-[#D9E6DD]"
  }`}
                />
              ))}
</div>

  < button
onClick = {() => setIsSimplified(!isSimplified)}
className = "flex items-center gap-1.5 text-xs bg-[#E7F6EF] text-[#167C63] px-3.5 py-1.5 rounded-xl font-semibold"
  >
  <Sparkles className="w-3.5 h-3.5" />
    <span>{ isSimplified? "Detailed Mode": "Simplify Mode" } </span>
    </button>
    </div>

    < div className = "bg-[#F3FBF7] border border-[#CFEBDD] rounded-2xl p-5 flex flex-col gap-2" >
      <h3 className="text-lg font-bold text-[#1E2A24]" > { currentStop.title } </h3>
        < p className = "text-sm text-[#1E2A24] leading-relaxed" >
          { isSimplified? currentStop.descriptionSimple : currentStop.descriptionNormal }
          </p>

          < div className = "bg-[#E7F6EF] rounded-xl p-3 border border-[#CDEBDC] flex gap-3 items-start mt-2" >
            <span className="text-lg" >💡</span>
              < div className = "flex flex-col" >
                <span className="text-[10px] font-bold text-[#167C63] uppercase tracking-wider" >
                  Key Idea
                    </span>
                    < span className = "text-xs font-semibold text-[#1E2A24]" >
                      { currentStop.keyIdea }
                      </span>
                      </div>
                      </div>
                      </div>
                      </div>

                      < div className = "px-6 pb-6 pt-2 flex items-center justify-between border-t border-[#E1ECE6]/60" >
                        <button
            disabled={ stepIndex === 0 }
onClick = {() => setStepIndex((prev) => Math.max(0, prev - 1))}
className = "disabled:opacity-40 flex items-center gap-1.5 bg-[#F5FAF7] border border-[#E1ECE6] px-4 py-2 rounded-xl text-xs font-semibold text-[#1E2A24]"
  >
  <ChevronLeft className="w-4 h-4" /> Previous
    </button>
    < span className = "text-xs text-[#5B6B62]" >
      Step { stepIndex + 1 } of { stops.length }
</span>
  < button
disabled = { stepIndex === stops.length - 1}
onClick = {() => setStepIndex((prev) => Math.min(stops.length - 1, prev + 1))}
className = "disabled:opacity-40 flex items-center gap-1.5 bg-[#1F9C7C] text-white px-4 py-2 rounded-xl text-xs font-semibold"
  >
  Next < ChevronRight className = "w-4 h-4" />
    </button>
    </div>
    </div>
    </div>
  );
}