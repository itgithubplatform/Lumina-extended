// app/api/adhd/list/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Fetch ALL materials so the user sees their file immediately on the landing page
    const materials = await prisma.adhdMaterial.findMany({
      orderBy: { 
        createdAt: "desc" 
      },
      include: {
        _count: {
          select: { slides: true }
        }
      }
    });

    return NextResponse.json({ materials }, { status: 200 });
  } catch (err: any) {
    console.error("Failed to fetch materials:", err.message);
    return NextResponse.json({ error: err.message || "Failed to fetch materials" }, { status: 500 });
  }
}