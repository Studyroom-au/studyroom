import { NextResponse } from "next/server";

// Direct claiming is disabled. Tutors must use the request flow instead.
// See: POST /api/leads/[leadsId]/request
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Direct claiming is disabled. Please request to tutor and wait for admin review.",
    },
    { status: 410 }
  );
}
