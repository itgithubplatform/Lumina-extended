import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: { classId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "teacher") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const classroom = await prisma.classroom.findUnique({
      where: { id: params.classId, teacherId: session.user.id },
      include: {
        students: {
          select: { id: true, name: true, email: true, accessibility: true }
        }
      }
    });

    if (!classroom) return NextResponse.json({ message: "Classroom not found" }, { status: 404 });
    return NextResponse.json({ students: classroom.students }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { classId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "teacher") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { email, name, accessibility } = await req.json();

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ message: "Invalid email format." }, { status: 400 });
    }

    const classroom = await prisma.classroom.findUnique({
      where: { id: params.classId, teacherId: session.user.id }
    });
    if (!classroom) return NextResponse.json({ message: "Unauthorized access to classroom" }, { status: 403 });

    let user = await prisma.user.findUnique({
      where: { email },
      include: { classesJoin: { select: { id: true } } }
    });

    if (user) {
      if (user.classesJoin.some(c => c.id === params.classId)) {
        return NextResponse.json({ message: "Student is already in this class." }, { status: 409 });
      }
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accessibility: accessibility || user.accessibility,
          classesJoin: { connect: { id: params.classId } }
        }
      });
      return NextResponse.json({ message: "Existing user configured and added to class." }, { status: 200 });
    }

    user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        role: "student",
        accessibility: accessibility || [],
        classesJoin: { connect: { id: params.classId } }
      }
    }) as any;

    return NextResponse.json({ message: "New student pre-registered and added.", user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Error processing request." }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { classId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "teacher") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { studentId, name, accessibility } = await req.json();
    if (!studentId) return NextResponse.json({ message: "Student ID required." }, { status: 400 });

    const updatedUser = await prisma.user.update({
      where: { id: studentId },
      data: { 
        name: name !== undefined ? name : undefined,
        accessibility: accessibility !== undefined ? accessibility : undefined 
      }
    });

    return NextResponse.json({ message: "Student profile updated." }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Error updating student." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { classId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "teacher") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");
    
    if (!studentId) return NextResponse.json({ message: "Student ID required." }, { status: 400 });

    await prisma.classroom.update({
      where: { id: params.classId },
      data: { students: { disconnect: { id: studentId } } }
    });

    return NextResponse.json({ message: "Student removed from classroom." }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Error removing student." }, { status: 500 });
  }
}