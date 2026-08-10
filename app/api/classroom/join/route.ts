import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const baseUrl = process.env.NEXTAUTH_URL || "https://34.100.218.126.nip.io";
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        if (!id) {
            return NextResponse.redirect(new URL('/dashboard', baseUrl));
        }

        const session = await getServerSession(authOptions);
        
        if (!session) {
            return NextResponse.redirect(new URL('/auth/signin', baseUrl));
        }
        
        if (session.user.role !== 'student') {
            return NextResponse.redirect(new URL('/dashboard', baseUrl));
        }

        const classRoom = await prisma.classroom.findUnique({
            where: { id },
            include: { students: true }
        });

        if (!classRoom) {
            return NextResponse.redirect(new URL('/classroom/create', baseUrl));
        }

        const isAlreadyEnrolled = classRoom.students.some((student) => student.id === session.user.id);
        
        if (isAlreadyEnrolled) {
            return NextResponse.redirect(new URL(`/classroom/${classRoom.id}`, baseUrl));
        }

        const updatedClassRoom = await prisma.classroom.update({
            where: { id },
            data: {
                students: {
                    connect: { id: session.user.id }
                }
            }
        });

        return NextResponse.redirect(new URL(`/classroom/${updatedClassRoom.id}`, baseUrl));

    } catch (error) {
        console.log('Join classroom error:', error);
        return NextResponse.redirect(new URL('/dashboard?error=join_failed', baseUrl));
    }
}
