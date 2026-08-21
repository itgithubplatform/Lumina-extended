"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function FocusSessionPage() {
  const params = useParams();
  const materialId = params.materialId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [slides, setSlides] = useState<any[]>([]);
  const [isFocusStageActive, setIsFocusStageActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessionData() {
      try {
        // 1. Trigger slide generation in backend
        await fetch("/api/adhd/generate-slides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ materialId }),
        });

        // 2. Fetch the 6 generated slides from DB
        const res = await fetch(`/api/adhd/slides?materialId=${materialId}`);
        const data = await res.json();

        if (data.success && data.slides && data.slides.length > 0) {
          setSlides(data.slides);
        } else {
          setToastMessage("Could not retrieve slides.");
        }
      } catch (err) {
        console.error("Error loading session:", err);
        setToastMessage("Network error loading focus slides.");
      } finally {
        setIsLoading(false);
      }
    }

    if (materialId) {
      loadSessionData();
    }
  }, [materialId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5FAF7] flex flex-col items-center justify-center gap-4 text-[#1E2A24]">
        <div className="w-10 h-10 rounded-full border-4 border-[#1F9C7C]/20 border-t-[#1F9C7C] animate-spin" />
        <p className="font-semibold text-sm">Building your 6 ADHD-friendly slides and key ideas...</p>
      </div>
    );
  }

  const currentSlide = slides[stepIndex] || {};

  return (
    <div className="min-h-screen bg-[#F5FAF7] flex flex-col items-center justify-center p-6">
      {toastMessage && (
        <div className="mb-4 bg-red-100 text-red-700 px-4 py-2 rounded-xl text-xs font-semibold">
          {toastMessage}
        </div>
      )}

      {/* Pre-start preview card */}
      <div className="bg-white border border-[#E1ECE6] rounded-3xl p-8 md:p-12 shadow-sm flex flex-col items-center text-center max-w-2xl mx-auto gap-5">
        <span className="text-5xl">🎯</span>
        <h2 className="text-xl font-bold text-[#1E2A24]">
          Ready for your Focus Session ({slides.length} Steps Generated)
        </h2>
        <p className="text-sm text-[#5B6B62] max-w-md leading-relaxed">
          Your content has been chunked into bite-sized visual steps with key ideas for distraction-free learning.
        </p>
        <button
          onClick={() => setIsFocusStageActive(true)}
          className="mt-2 bg-[#1F9C7C] hover:bg-[#167C63] text-white font-semibold px-6 py-3.5 rounded-xl transition-all shadow-sm flex items-center gap-2 text-sm"
        >
          <span>Start focus session</span>
          <span>→</span>
        </button>
      </div>

      {/* FULLSCREEN FOCUS STAGE */}
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
                onClick={() => setIsFocusStageActive(false)}
                className="inline-flex items-center gap-2 bg-white hover:bg-[#EEF6F1] border border-[#E1ECE6] text-[#5B6B62] px-4 py-2 rounded-full text-xs font-semibold transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Exit session</span>
              </button>
              <span className="text-xs font-semibold text-[#5B6B62]">
                Lumina · Attention Mode
              </span>
            </div>

            <div className="w-full max-w-5xl flex flex-col gap-5 my-auto">
              <div className="bg-white border border-[#E1ECE6] rounded-3xl shadow-sm overflow-hidden flex flex-col">
                
                {/* IMAGE CONTAINER USING YOUR GCS BUCKET URL */}
                <div className="relative w-full h-[40vh] min-h-[260px] bg-[#0F1712] overflow-hidden">
                  <img
                    src={currentSlide.imageUrl || "https://storage.googleapis.com/concepto-2/adhdImages/1.png"}
                    alt="Slide Visual"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4 bg-[#0F1712]/60 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                    Step {stepIndex + 1} of {slides.length}
                  </div>
                </div>

                <div className="p-6 flex flex-col gap-4">
                  <div className="flex justify-center gap-2">
                    {slides.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setStepIndex(i)}
                        className={`h-2 rounded-full transition-all ${
                          i === stepIndex ? "w-7 bg-[#1F9C7C]" : "w-2 bg-[#D9E6DD]"
                        }`}
                      />
                    ))}
                  </div>

                  <div className="bg-[#F3FBF7] border border-[#CFEBDD] rounded-2xl p-5 shadow-sm text-left flex flex-col gap-3">
                    <h3 className="text-lg font-bold text-[#1E2A24] m-0">
                      {currentSlide.title}
                    </h3>

                    <p className="text-[15px] font-medium text-[#1E2A24] leading-relaxed m-0">
                      {currentSlide.textContent}
                    </p>

                    {/* KEY IDEA BOX */}
                    <div className="bg-[#E7F6EF] rounded-xl p-3.5 border border-[#CDEBDC] flex gap-3 items-start mt-2 shadow-sm">
                      <span className="text-xl leading-none">💡</span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-bold text-[#167C63] uppercase tracking-widest">
                          Key Idea
                        </span>
                        <span className="text-[13.5px] font-semibold text-[#1E2A24] leading-snug">
                          {currentSlide.keyIdea}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-2 flex items-center justify-between border-t border-[#E1ECE6]/60">
                  <button
                    onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                    disabled={stepIndex === 0}
                    className="flex items-center gap-1.5 bg-[#F5FAF7] border border-[#E1ECE6] px-4 py-2 rounded-xl text-xs font-semibold text-[#1E2A24] disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <span className="text-xs text-[#5B6B62] font-medium">
                    Step {stepIndex + 1} of {slides.length}
                  </span>
                  <button
                    onClick={() => setStepIndex((prev) => Math.min(slides.length - 1, prev + 1))}
                    disabled={stepIndex === slides.length - 1}
                    className="flex items-center gap-1.5 bg-[#F5FAF7] border border-[#E1ECE6] px-4 py-2 rounded-xl text-xs font-semibold text-[#1E2A24] disabled:opacity-40"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}