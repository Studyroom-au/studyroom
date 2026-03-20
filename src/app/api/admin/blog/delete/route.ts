import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyIdTokenFromRequest } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyIdTokenFromRequest(req);
    if (decoded.email !== "lily.studyroom@gmail.com") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { slug } = await req.json() as { slug?: string };
    if (!slug) return NextResponse.json({ error: "Slug required" }, { status: 400 });

    const db = getAdminDb();
    await db.collection("blogPosts").doc(slug).delete();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[blog-delete]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
