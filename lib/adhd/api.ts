export interface AdhdMaterial {
  id: string;
  fileName: string;
  fileType: string | null;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt?: string;
  focusSessionCount?: number;
}

export interface AdhdSlide {
  id: string;
  order: number;
  keyIdea: string;
  content: string;
  imageUrl?: string | null;
}

export interface AdhdFocusSession {
  id: string;
  materialId: string;
  status: string;
  slides: AdhdSlide[];
}

/**
 * Upload ADHD learning material.
 */
export async function uploadAdhdMaterial(
  file: File
) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch(
    "/api/adhd/upload",
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        "Failed to upload material"
    );
  }

  return data;
}

/**
 * Get all ADHD materials.
 */
export async function getAdhdMaterials(): Promise<{
  materials: AdhdMaterial[];
}> {
  const response = await fetch(
    "/api/adhd/list",
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        "Failed to load materials"
    );
  }

  return data;
}

/**
 * Get a single material.
 */
export async function getAdhdMaterial(
  materialId: string
) {
  const response = await fetch(
    `/api/adhd/material/${materialId}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        "Failed to load material"
    );
  }

  return data;
}

/**
 * Generate an ADHD focus session.
 *
 * Vertex AI:
 * Material Context
 *      ↓
 * Gemini 2.5 Flash
 *      ↓
 * Exactly 6 slides
 */
export async function createAdhdFocusSession(
  materialId: string
): Promise<{
  success: boolean;
  session: AdhdFocusSession;
}> {
  const response = await fetch(
    "/api/adhd/focus",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        materialId,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        "Failed to create focus session"
    );
  }

  return data;
}