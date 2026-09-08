import { beforeEach, afterAll, describe, it, expect } from "vitest";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { POST as hubEarlyAccessPost } from "@/app/api/hub/early-access/route";
import { POST as tutorApplicationsPost } from "@/app/api/tutor-applications/route";

// Full integration tests against the REAL route handlers and a REAL
// Firestore emulator — mirrors the convention in
// src/lib/studyroom/__tests__/applySessionAction.emulator.test.ts, adapted
// to these two simple intake routes (which have no separate lib function to
// import, unlike applySessionAction). Requires the Firestore emulator
// running on 127.0.0.1:8080 (see package.json "test:emulator").
//
// Both routes send best-effort emails after the Firestore write; no
// RESEND_API_KEY/SMTP_* env vars are set in this test environment, so those
// calls throw internally and are caught as non-fatal — the route still
// succeeds. This project has no Auth emulator configured (firebase.json
// only configures firestore), so the admin-authenticated PATCH route
// (/api/admin/tutor-applications/[id]) is not covered here — same limitation
// as the pre-existing, also-untested /api/admin/tutor-access/decision route.

async function clearCollections() {
  const db = getAdminDb();
  for (const name of ["hubEarlyAccess", "tutorApplications"]) {
    const snap = await db.collection(name).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

function jsonRequest(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await clearCollections();
});

describe("POST /api/hub/early-access (Release 1C, emulator integration)", () => {
  const validBody = {
    name: "Jamie Student",
    email: "jamie@example.com",
    studentYearLevel: "Year 9",
    biggestStudyChallenge: "Staying organised",
    guardianAcknowledgement: true,
    referrer: "https://instagram.com",
    utm_source: "instagram",
    utm_medium: "social",
    utm_campaign: "spring-push",
  };

  it("creates a submission with server-controlled source and timestamp", async () => {
    const res = await hubEarlyAccessPost(jsonRequest("http://localhost/api/hub/early-access", validBody));
    expect(res.status).toBe(200);

    const db = getAdminDb();
    const snap = await db.collection("hubEarlyAccess").get();
    expect(snap.size).toBe(1);
    const data = snap.docs[0].data();
    expect(data.name).toBe("Jamie Student");
    expect(data.email).toBe("jamie@example.com");
    expect(data.source).toBe("hub_early_access");
    expect(data.utm_source).toBe("instagram");
    expect(data.submittedAt).toBeTruthy();
  });

  it("rejects a client-supplied source override — server value always wins", async () => {
    await hubEarlyAccessPost(
      jsonRequest("http://localhost/api/hub/early-access", { ...validBody, source: "hacked", reviewStatus: "reviewed" })
    );
    const db = getAdminDb();
    const snap = await db.collection("hubEarlyAccess").get();
    expect(snap.size).toBe(1);
    expect(snap.docs[0].data().source).toBe("hub_early_access");
    expect(snap.docs[0].data().reviewStatus).toBeUndefined();
  });

  it("rejects submission missing guardian acknowledgement", async () => {
    const res = await hubEarlyAccessPost(
      jsonRequest("http://localhost/api/hub/early-access", { ...validBody, guardianAcknowledgement: false })
    );
    expect(res.status).toBe(400);
    const db = getAdminDb();
    expect((await db.collection("hubEarlyAccess").get()).size).toBe(0);
  });

  it("rejects submission with an invalid email", async () => {
    const res = await hubEarlyAccessPost(
      jsonRequest("http://localhost/api/hub/early-access", { ...validBody, email: "not-an-email" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects submission with an unrecognised year level", async () => {
    const res = await hubEarlyAccessPost(
      jsonRequest("http://localhost/api/hub/early-access", { ...validBody, studentYearLevel: "Year 99" })
    );
    expect(res.status).toBe(400);
  });

  it("silently accepts (but does not store) a honeypot-tripped submission", async () => {
    const res = await hubEarlyAccessPost(
      jsonRequest("http://localhost/api/hub/early-access", { ...validBody, companyWebsite: "https://spam.example" })
    );
    expect(res.status).toBe(200);
    const db = getAdminDb();
    expect((await db.collection("hubEarlyAccess").get()).size).toBe(0);
  });
});

describe("POST /api/tutor-applications (Release 1C, emulator integration)", () => {
  const validBody = {
    fullName: "Alex Tutor",
    email: "alex.tutor@example.com",
    phone: "0412 345 678",
    suburb: "Logan Central",
    mode: "in_home",
    willingInHome: true,
    hasCar: true,
    subjects: "Maths, English",
    yearLevelsComfortable: "Year 5 to Year 10",
    blueCardStatus: "current",
    abnStatus: "have_abn",
    whyTutor: "I love helping students build confidence in maths.",
    referralSource: "Facebook",
    referrer: "https://facebook.com",
    utm_source: "facebook",
    utm_medium: "paid",
    utm_campaign: "recruit-logan",
  };

  it("creates an application with server-controlled reviewStatus/source, ignoring client overrides", async () => {
    const res = await tutorApplicationsPost(
      jsonRequest("http://localhost/api/tutor-applications", {
        ...validBody,
        reviewStatus: "reviewed",
        role: "tutor",
        approved: true,
        tutorAccess: "approved",
      })
    );
    expect(res.status).toBe(200);

    const db = getAdminDb();
    const snap = await db.collection("tutorApplications").get();
    expect(snap.size).toBe(1);
    const data = snap.docs[0].data();
    expect(data.fullName).toBe("Alex Tutor");
    expect(data.reviewStatus).toBe("new");
    expect(data.source).toBe("tutor_application");
    expect(data.utm_source).toBe("facebook");
    // Privileged fields must never be persisted from the client body.
    expect(data.role).toBeUndefined();
    expect(data.approved).toBeUndefined();
    expect(data.tutorAccess).toBeUndefined();
    expect(data.submittedAt).toBeTruthy();
  });

  it("rejects an application missing a required field (whyTutor too short)", async () => {
    const res = await tutorApplicationsPost(
      jsonRequest("http://localhost/api/tutor-applications", { ...validBody, whyTutor: "short" })
    );
    expect(res.status).toBe(400);
    const db = getAdminDb();
    expect((await db.collection("tutorApplications").get()).size).toBe(0);
  });

  it("rejects an application with an invalid mode value", async () => {
    const res = await tutorApplicationsPost(
      jsonRequest("http://localhost/api/tutor-applications", { ...validBody, mode: "carrier_pigeon" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects an application with an invalid Blue Card status", async () => {
    const res = await tutorApplicationsPost(
      jsonRequest("http://localhost/api/tutor-applications", { ...validBody, blueCardStatus: "definitely_not_a_real_status" })
    );
    expect(res.status).toBe(400);
  });

  it("silently accepts (but does not store) a honeypot-tripped submission", async () => {
    const res = await tutorApplicationsPost(
      jsonRequest("http://localhost/api/tutor-applications", { ...validBody, companyWebsite: "https://spam.example" })
    );
    expect(res.status).toBe(200);
    const db = getAdminDb();
    expect((await db.collection("tutorApplications").get()).size).toBe(0);
  });
});
