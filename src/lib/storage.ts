import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export async function uploadSessionWorkSample(args: {
  tutorId: string;
  sessionId: string;
  file: File;
}) {
  const { tutorId, sessionId, file } = args;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `workSamples/${tutorId}/${sessionId}/${Date.now()}_${safeName}`;

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  return { url, path, fileName: file.name, contentType: file.type, size: file.size };
}
