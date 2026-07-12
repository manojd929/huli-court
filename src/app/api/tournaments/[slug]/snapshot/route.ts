import { NextResponse } from "next/server";

import { fetchDraftSnapshotBySlug } from "@/services/draft-service";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const snapshot = await fetchDraftSnapshotBySlug(slug);
  if (!snapshot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}
