import { NextRequest, NextResponse } from "next/server";
import { marked } from "marked";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, verifyIdTokenFromRequest } from "@/lib/firebaseAdmin";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 80);
}

export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyIdTokenFromRequest(req);
    if (decoded.email !== "lily.studyroom@gmail.com") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();

    const body = await req.json() as {
      slug?: string;
      title?: string;
      description?: string;
      content?: string;
      author?: string;
      tags?: string[];
      tagsRaw?: string;
      date?: string;
      published?: boolean;
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!body.content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const slug = body.slug?.trim() || slugify(body.title);
    const contentHtml = await marked(body.content);

    const postData = {
      title: body.title.trim(),
      description: body.description?.trim() || "",
      content: body.content,
      contentHtml,
      author: body.author?.trim() || "Studyroom",
      tags: Array.isArray(body.tags)
        ? body.tags
        : (body.tagsRaw ?? "").split(",").map((t: string) => t.trim()).filter(Boolean),
      date: body.date || new Date().toISOString().split("T")[0],
      published: body.published === true,
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = db.collection("blogPosts").doc(slug);
    const existing = await docRef.get();

    if (existing.exists) {
      await docRef.set(postData, { merge: true });
    } else {
      await docRef.set({
        ...postData,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    console.error("[blog-save]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
