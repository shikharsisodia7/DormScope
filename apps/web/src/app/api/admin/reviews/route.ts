import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError, requireAdminKey, parsePagination } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!requireAdminKey(req)) return jsonError("Unauthorized", 401);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "PENDING";
    const { page, pageSize, skip } = parsePagination(searchParams);

    const where = { status: status as never };
    const [total, reviews] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        include: {
          dorm: { select: { id: true, name: true, slug: true, college: { select: { name: true, slug: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return jsonOk({ items: reviews, total, page, pageSize });
  } catch (err) {
    return handleRouteError(err);
  }
}

const moderateSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED", "HIDDEN", "PENDING"]),
});

export async function PATCH(req: Request) {
  try {
    if (!requireAdminKey(req)) return jsonError("Unauthorized", 401);
    const input = moderateSchema.parse(await req.json());

    const review = await prisma.review.update({
      where: { id: input.reviewId },
      data: { status: input.status, moderatedAt: new Date() },
      select: { id: true, status: true, moderatedAt: true },
    });

    return jsonOk({ review });
  } catch (err) {
    return handleRouteError(err);
  }
}
