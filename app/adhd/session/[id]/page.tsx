"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface SlideData {
  id: string;
  textContent: string;
  imageUrl: string | null;
  order: number;
}

export default function FocusSessionPage() {
  const params = useParams();
  const materialId = params.id as string;

  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSlides = async () => {
    if (!materialId) return;
    try {
      const res = await fetch(`/api/adhd/upload?materialId=${materialId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load material");

      if (data.status === "processing") {
        setTimeout(fetchSlides, 3000); // Poll while Gemini processes the PDF
        return;
      }

      if (data.status === "failed") {
        setError("Processing failed for this document.");
        setLoading(false);
        return;
      }

      setSlides(data.material.slides || []);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlides();
  }, [materialId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
        <p className="text-lg font-medium">Generating unique visual slides from your PDF...</p>
      </div>
    );
  }

  if (error || slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6">
        <p className="text-red-400 text-xl font-semibold mb-4">{error || "No slides found."}</p>
      </div>
    );
  }

  const currentSlide = slides[currentIndex];
  
  // Robust nested JSON cleaner to prevent raw strings from rendering
  let parsedContent = { 
    title: "Learning Slide", 
    descriptionNormal: "", 
    keyIdea: "" 
  };

  try {
    let content = currentSlide.textContent;
    // Handle double-stringified or JSON objects safely
    if (typeof content === "string") {
      content = JSON.parse(content);
    }
    if (typeof content === "string") {
      content = JSON.parse(content);
    }
    if (typeof content === "object" && content !== null) {
      parsedContent = {
        title: (content as any).title || "Learning Slide",
        descriptionNormal: (content as any).descriptionNormal || (content as any).descriptionSimple || JSON.stringify(content),
        keyIdea: (content as any).keyIdea || "",
      };
    }
  } catch (e) {
    parsedContent.descriptionNormal = currentSlide.textContent;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 flex flex-col items-center justify-center">
      {/* Progress */}
      <div className="w-full max-w-3xl flex justify-between items-center mb-4 text-sm text-purple-400 font-semibold">
        <span>Slide {currentIndex + 1} of {slides.length}</span>
      </div>

      {/* Slide Container */}
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-6">
        {/* Dynamic Image */}
        <div className="w-full h-64 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
          <img
            key={currentSlide.id}
            src={currentSlide.imageUrl || "https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=1000&q=80"}
            alt={parsedContent.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Dynamic Text Content */}
        <div>
          <h2 className="text-2xl font-bold mb-2 text-white">{parsedContent.title}</h2>
          <p className="text-slate-300 text-base leading-relaxed mb-4">{parsedContent.descriptionNormal}</p>
          {parsedContent.keyIdea && (
            <div className="bg-purple-950/50 border border-purple-800/40 p-3 rounded-lg text-purple-200 text-sm">
              💡 <strong>Key Takeaway:</strong> {parsedContent.keyIdea}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t border-slate-800">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
            disabled={currentIndex === 0}
            className="px-5 py-2 bg-slate-800 disabled:opacity-30 rounded-xl font-semibold hover:bg-slate-700 transition-all"
          >
            ← Previous
          </button>
          <button
            onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1))}
            disabled={currentIndex === slides.length - 1}
            className="px-5 py-2 bg-purple-600 disabled:opacity-30 rounded-xl font-semibold hover:bg-purple-500 transition-all"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}