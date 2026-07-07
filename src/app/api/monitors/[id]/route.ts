import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { requireUser } from "@/lib/auth";

import { getAllowedIntervals, isIntervalAllowed } from "@/lib/constants";

import { prisma } from "@/lib/db";

import { apiErrorResponse, ApiError, parseJsonBody } from "@/lib/errors";

import { assertNotificationAllowed } from "@/lib/plan-guards";

import { withRateLimit } from "@/lib/rate-limit";

import { updateMonitorSchema } from "@/lib/validations";



export async function GET(

  _request: NextRequest,

  { params }: { params: Promise<{ id: string }> }

) {

  const { id } = await params;



  try {

    const user = await requireUser();

    return withRateLimit(

      `monitor-get-${id}`,

      async () => {

        const monitor = await prisma.monitor.findFirst({

          where: { id, userId: user.id },

          include: {

            changes: { orderBy: { createdAt: "desc" }, take: 10 },

            _count: { select: { changes: true, snapshots: true } },

          },

        });



        if (!monitor) {

          return NextResponse.json({ error: "Monitor not found" }, { status: 404 });

        }



        return NextResponse.json({

          monitor,

          plan: user.subscription?.plan ?? "FREE",

        });

      },

      user.id

    );

  } catch (error) {

    return apiErrorResponse(error);

  }

}



export async function PATCH(

  request: NextRequest,

  { params }: { params: Promise<{ id: string }> }

) {

  const { id } = await params;



  try {

    const user = await requireUser();

    return withRateLimit(

      `monitor-patch-${id}`,

      async () => {

        const body = await parseJsonBody(request);

        const parsed = updateMonitorSchema.safeParse(body);



        if (!parsed.success) {

          return NextResponse.json(

            { error: "Validation failed", details: parsed.error.flatten() },

            { status: 400 }

          );

        }



        const existing = await prisma.monitor.findFirst({

          where: { id, userId: user.id },

        });



        if (!existing) {

          return NextResponse.json({ error: "Monitor not found" }, { status: 404 });

        }



        const plan = user.subscription?.plan ?? "FREE";



        if (parsed.data.interval && !isIntervalAllowed(plan, parsed.data.interval)) {

          return NextResponse.json(

            {

              error: `Interval not allowed. Allowed: ${getAllowedIntervals(plan).join(", ")}`,

            },

            { status: 403 }

          );

        }



        if (parsed.data.notificationMethod) {

          assertNotificationAllowed(plan, parsed.data.notificationMethod);

        }



        if (parsed.data.url && parsed.data.url !== existing.url) {

          const duplicate = await prisma.monitor.findFirst({

            where: { userId: user.id, url: parsed.data.url, NOT: { id } },

            select: { id: true },

          });

          if (duplicate) {

            return NextResponse.json(

              { error: "You are already monitoring this URL." },

              { status: 409 }

            );

          }

        }



        const { config, ...rest } = parsed.data;

        try {

          const monitor = await prisma.monitor.update({

            where: { id },

            data: {

              ...rest,

              ...(config !== undefined

                ? { config: config === null ? Prisma.JsonNull : (config as Prisma.InputJsonValue) }

                : {}),

            },

          });

          return NextResponse.json({ monitor });

        } catch (error) {

          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {

            return NextResponse.json(

              { error: "You are already monitoring this URL." },

              { status: 409 }

            );

          }

          throw error;

        }

      },

      user.id

    );

  } catch (error) {

    if (error instanceof ApiError) {

      return NextResponse.json({ error: error.message }, { status: error.status });

    }

    return apiErrorResponse(error);

  }

}



export async function DELETE(

  _request: NextRequest,

  { params }: { params: Promise<{ id: string }> }

) {

  const { id } = await params;



  try {

    const user = await requireUser();

    return withRateLimit(

      `monitor-delete-${id}`,

      async () => {

        const existing = await prisma.monitor.findFirst({

          where: { id, userId: user.id },

        });



        if (!existing) {

          return NextResponse.json({ error: "Monitor not found" }, { status: 404 });

        }



        await prisma.monitor.delete({ where: { id } });

        return NextResponse.json({ success: true });

      },

      user.id

    );

  } catch (error) {

    return apiErrorResponse(error);

  }

}


