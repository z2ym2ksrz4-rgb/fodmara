import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";

/**
 * Meal photos. Stored as JPEG files in the app's Data directory (meals/<mealId>.jpg) – on the device only, never in the
 * JSON backup and not in the PDF by default. Read back as a data URL for display so web (IndexedDB) and native behave alike.
 */
const path = (mealId: string) => `meals/${mealId}.jpg`;

export const photoSupported = () => Capacitor.getPlatform() !== "web" || typeof navigator !== "undefined" && !!navigator.mediaDevices;

/** Opens the camera / photo picker and saves the result. Returns the stored path, or null if the user cancelled. */
export async function takeMealPhoto(mealId: string, source: "camera" | "photos" = "camera"): Promise<string | null> {
  let photo;
  try {
    photo = await Camera.getPhoto({ quality: 60, width: 1280, resultType: CameraResultType.Base64, source: source === "camera" ? CameraSource.Camera : CameraSource.Photos, correctOrientation: true, saveToGallery: false });
  } catch { return null; } // cancelled or denied
  if (!photo.base64String) return null;
  try { await Filesystem.mkdir({ path: "meals", directory: Directory.Data, recursive: true }); } catch { /* exists */ }
  await Filesystem.writeFile({ path: path(mealId), data: photo.base64String, directory: Directory.Data });
  return path(mealId);
}

export async function loadMealPhoto(p: string): Promise<string | null> {
  try {
    const r = await Filesystem.readFile({ path: p, directory: Directory.Data });
    const data = typeof r.data === "string" ? r.data : await (r.data as Blob).text();
    return data.startsWith("data:") ? data : `data:image/jpeg;base64,${data}`;
  } catch { return null; }
}

export async function deleteMealPhoto(p: string | null | undefined) {
  if (!p) return;
  try { await Filesystem.deleteFile({ path: p, directory: Directory.Data }); } catch { /* already gone */ }
}
