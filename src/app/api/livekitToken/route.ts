// src/app/api/livekitToken/route.ts
import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { AccessToken } from "livekit-server-sdk";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL; // e.g. wss://your-livekit-host

export async function POST(req: Request) {
  try {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      return new NextResponse("LiveKit env vars missing", { status: 500 });
    }

    const auth = getAdminAuth();
    if (!auth) {
      return new NextResponse("Firebase Admin not configured", { status: 500 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new NextResponse("Invalid JSON body", { status: 400 });
    }

    const { idToken, roomName } = (body as { idToken?: string; roomName?: string } | undefined) ?? {};
    if (!idToken || !roomName) {
      return new NextResponse("Missing idToken or roomName", { status: 400 });
    }

    const decoded = await auth.verifyIdToken(idToken).catch((err) => {
      console.error("[livekitToken] verifyIdToken failed", err);
      return null;
    });
    if (!decoded) {
      return new NextResponse("Invalid ID token", { status: 401 });
    }

    const uid = decoded.uid;
    const role = (decoded.role as string | undefined) ?? "student";

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: uid,
      metadata: JSON.stringify({ role }),
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      url: LIVEKIT_URL,
      token,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[livekitToken] error", msg);
    return new NextResponse("Failed to create room token", { status: 500 });
  }
}
