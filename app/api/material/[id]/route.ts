import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  req: Request,
  context: RouteContext
) {
  try {
    // -------------------------------------------------------
    // 1. AUTHENTICATION
    // -------------------------------------------------------

    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (
      !token ||
      (!token.sub && !token.email)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized session",
        },
        {
          status: 401,
        }
      );
    }

    // -------------------------------------------------------
    // 2. GET MATERIAL ID
    // -------------------------------------------------------

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Material ID is required",
        },
        {
          status: 400,
        }
      );
    }

    // -------------------------------------------------------
    // 3. FETCH MATERIAL
    // -------------------------------------------------------

    const material =
      await prisma.adhdMaterial.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          fileName: true,
          originalPath: true,
          fileType: true,
          extractedText: true,
          educationalContext: true,
          status: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,

          focusSessions: {
            orderBy: {
              createdAt: "desc",
            },

            select: {
              id: true,
              status: true,
              errorMessage: true,
              createdAt: true,
              updatedAt: true,

              _count: {
                select: {
                  slides: true,
                },
              },
            },
          },
        },
      });

    // -------------------------------------------------------
    // 4. MATERIAL NOT FOUND
    // -------------------------------------------------------

    if (!material) {
      return NextResponse.json(
        {
          success: false,
          error: "ADHD material not found",
        },
        {
          status: 404,
        }
      );
    }

    // -------------------------------------------------------
    // 5. RESPONSE
    // -------------------------------------------------------

    return NextResponse.json(
      {
        success: true,

        material: {
          id: material.id,

          fileName:
            material.fileName,

          fileType:
            material.fileType,

          status:
            material.status,

          errorMessage:
            material.errorMessage,

          extractedText:
            material.extractedText,

          educationalContext:
            material.educationalContext,

          createdAt:
            material.createdAt,

          updatedAt:
            material.updatedAt,

          focusSessions:
            material.focusSessions.map(
              (session) => ({
                id: session.id,

                status:
                  session.status,

                errorMessage:
                  session.errorMessage,

                slideCount:
                  session._count.slides,

                createdAt:
                  session.createdAt,

                updatedAt:
                  session.updatedAt,
              })
            ),
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "ADHD material detail error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to retrieve ADHD material",
      },
      {
        status: 500,
      }
    );
  }
}