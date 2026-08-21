import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const materialId = searchParams.get("materialId");

    if (!materialId) {
      return NextResponse.json({ success: false, error: "Material ID is required" }, { status: 400 });
    }

    const slides = await prisma.adhdSlide.findMany({
      where: { materialId },
      orderBy: { slideNumber: 'asc' },
    });

    return NextResponse.json({ success: true, slides });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}