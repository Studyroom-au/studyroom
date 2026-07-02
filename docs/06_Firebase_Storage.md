# 06 — Firebase Storage

## Overview

Firebase Cloud Storage is used for storing files uploaded during tutoring sessions. The storage bucket is configured as part of the `studyroom-6ba75` Firebase project.

---

## Bucket

| Property | Value |
|----------|-------|
| Bucket name | `studyroom-6ba75.firebasestorage.app` |
| Region | unclear — not specified in configuration |

---

## Folder Structure

### `workSamples/{tutorId}/{sessionId}/{timestamp}_{safeName}`

The only confirmed storage path in the codebase.

| Segment | Description |
|---------|-------------|
| `tutorId` | Firebase Auth UID of the uploading tutor |
| `sessionId` | Firestore document ID of the session |
| `timestamp` | Unix timestamp prefix for uniqueness |
| `safeName` | Sanitised original file name |

**Example path:**
```
workSamples/abc123tutorUID/xyz789sessionID/1720000000000_maths-notes.pdf
```

---

## Upload Logic

**Source file:** `src/lib/storage.ts`  
**Function:** `uploadSessionWorkSample({ tutorId, sessionId, file })`

This function:
1. Sanitises the file name (removes special characters)
2. Constructs the full storage path with a timestamp prefix
3. Uploads the file to Firebase Storage
4. Returns an object: `{ url, path, fileName, contentType, size }`

The returned `url` is a long-lived Firebase Storage download URL stored in the `sessions/{sessionId}/logs/{logId}.workSamples` array.

---

## Who Can Upload

**Only tutors**, via the `SessionLogEditor` component (`src/components/session/SessionLogEditor.tsx`).

Upload is triggered when a tutor creates or updates a session log after completing a session. The component:
1. Calls `uploadSessionWorkSample()` for each file
2. Stores the returned URL array in the Firestore session log document

---

## Who Can Read

Access to work samples is indirect — there are no direct Firebase Storage permission rules referenced in the codebase. Access is controlled by who can read the Firestore `sessions/{id}/logs/{logId}` document that contains the `fileUrl`.

| User | Can read session log (and therefore the URL) |
|------|---------------------------------------------|
| Tutor (own sessions) | ✅ |
| Student (own sessions) | ✅ |
| Parent (children's sessions) | ✅ |
| Admin | ✅ |
| Other tutors | ❌ |
| Unauthenticated | ❌ (if storage rules are set correctly) |

---

## Storage Security Rules

> **UNCLEAR — This is a potential technical risk.**

No Firebase Storage rules file (e.g. `storage.rules`) was found in the project root. The Firestore rules file (`firestore.rules`) governs the database but does not control Cloud Storage.

Firebase Storage has its own separate rules file. Without explicit rules:
- The default Firebase Storage rules may be restrictive (requiring auth only) or may be open, depending on when the project was created
- There is no evidence in the codebase of custom storage rules

**Recommendation:** Audit and configure `storage.rules` to ensure `workSamples/` paths are only accessible to authenticated users, and ideally locked down further by tutor UID matching the path segment.

This is documented as a known risk in [15_Known_Technical_Debt.md](15_Known_Technical_Debt.md).

---

## File Types

The upload function accepts any file type via the browser's file picker. The `contentType` is determined from the uploaded file's MIME type and stored alongside the URL in Firestore.

Known expected file types:
- PDF documents (student work, worksheets)
- Images (photos of handwritten work)
- Other document types (unclear — no explicit MIME type restriction found in `storage.ts`)

---

## File Size Limits

No explicit file size limit was found in `storage.ts` or the `SessionLogEditor` component. Firebase Storage has default limits, but no application-level validation was identified. This may be a gap.

---

## Summary

| Aspect | Details |
|--------|---------|
| Only upload path | `workSamples/{tutorId}/{sessionId}/{ts}_{safeName}` |
| Uploaders | Tutors only (via SessionLogEditor) |
| Access control | Via Firestore log document (indirect) |
| Storage rules | **Unclear — no rules file found. Risk flag.** |
| File size limit | Not enforced at application level |
| Content types | Any (no restriction found) |
