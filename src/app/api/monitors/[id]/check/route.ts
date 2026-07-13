import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { classifyMonitoringError } from "@/lib/monitoring/error-messages";
import { processMonitor } from "@/lib/monitoring/processor";
import { processPendingAnalyses } from "@/lib/monitoring/ai-processor";
import { withRateLimit } from "@/lib/rate-limit";
import { assertMonitorOwnedBy } from "@/lib/security/ownership";
import { securityLog } from "@/lib/security/log";

export const maxDuration = 120;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireUser();
    return withRateLimit(
      `monitor-check-${id}`,
      async () => {
        await assertMonitorOwnedBy(user.id, id);

        try {
          const result = await processMonitor(id);
          if (result.status === "change_detected") {
            await processPendingAnalyses(1);
          }
          return NextResponse.json({
            success: true,
            message: "Check completed",
            result,
          });
        } catch (error) {
          const monitoringError = classifyMonitoringError(error);
          securityLog({
            type: "failsafe.activated",
            message: "Manual monitor check failed safely",
            userId: user.id,
            resourceId: id,
            metadata: {
              kind: monitoringError.kind,
              technical: monitoringError.technical,
              error: error instanceof Error ? error.message : String(error),
            },
          });
          return NextResponse.json(
            {
              success: false,
              error: monitoringError.title,
              monitoringError: {
                kind: monitoringError.kind,
                title: monitoringError.title,
                description: monitoringError.description,
                suggestions: monitoringError.suggestions,
                statusLabel: monitoringError.statusLabel,
                technical: monitoringError.technical,
              },
            },
            { status: 422 }
          );
        }
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
