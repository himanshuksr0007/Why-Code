"use client";

/**
 * Composer attachments: files the user uploads and screenshots they
 * capture with the browser's screen-share picker.
 *
 * Text-like files are read in the browser and inlined into the
 * question when it is sent, so the model answers with the file's
 * content as context. Images (uploads and screenshots) are kept as
 * downscaled data URLs and rendered in the conversation — the current
 * model pipeline is text-only, so images are conversation artifacts,
 * not model input.
 */

export interface ComposerAttachment {
  id: string;
  name: string;
  kind: "text" | "image";
  size: number;
  /** Text files: the file's text. Images: a downscaled data URL. */
  content: string;
}

/** Files larger than this are refused — a question is not a backup. */
export const MAX_FILE_BYTES = 200_000;
/** Per-file cap on the characters inlined into a sent question. */
export const MAX_INLINE_CHARS = 12_000;

function makeId(): string {
  return `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function looksLikeText(text: string): boolean {
  if (text.includes("\u0000")) return false;
  const sample = text.slice(0, 2000);
  if (!sample) return true;
  const replacements = (sample.match(/\uFFFD/g) ?? []).length;
  return replacements / sample.length < 0.05;
}

export type ReadResult =
  | { ok: true; attachment: ComposerAttachment }
  | { ok: false; reason: string };

/** Read one picked file into a composer attachment. */
export async function readFileAttachment(file: File): Promise<ReadResult> {
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: `${file.name} is too large (max ${Math.round(MAX_FILE_BYTES / 1000)} KB)`,
    };
  }
  if (file.type.startsWith("image/")) {
    const dataUrl = await downscaleImageDataUrl(await fileToDataUrl(file));
    return {
      ok: true,
      attachment: {
        id: makeId(),
        name: file.name || "image",
        kind: "image",
        size: file.size,
        content: dataUrl,
      },
    };
  }
  const text = await file.text();
  if (!looksLikeText(text)) {
    return {
      ok: false,
      reason: `${file.name} could not be read as text — only text files and images can be attached`,
    };
  }
  return {
    ok: true,
    attachment: {
      id: makeId(),
      name: file.name || "file.txt",
      kind: "text",
      size: file.size,
      content: text,
    },
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Shrink an image data URL to at most 1280px wide (JPEG), so chat
 * storage stays small. Falls back to the original on any failure. */
export function downscaleImageDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, 1280 / image.naturalWidth);
        if (scale >= 1 && dataUrl.length < 400_000) {
          resolve(dataUrl);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(dataUrl);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

/**
 * Capture a screenshot through the browser's screen-share picker:
 * the user chooses a tab/window/screen, we grab one frame, and the
 * share stops immediately. Returns null when the user cancels.
 */
export async function captureScreenshot(): Promise<ComposerAttachment | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen capture is not supported in this browser");
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    // Race every wait: on a throttled or backgrounded page, play()
    // and animation frames can stall indefinitely, and a screenshot
    // must never hang on them.
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    await Promise.race([video.play().catch(() => undefined), delay(2500)]);
    if (!video.videoWidth) {
      await Promise.race([
        new Promise((resolve) =>
          video.addEventListener("loadedmetadata", resolve, { once: true }),
        ),
        delay(1500),
      ]);
    }
    await delay(300);
    const trackSettings = stream.getVideoTracks()[0]?.getSettings() ?? {};
    const sourceWidth = video.videoWidth || trackSettings.width || 1280;
    const sourceHeight = video.videoHeight || trackSettings.height || 720;
    const scale = Math.min(1, 1280 / sourceWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not capture the frame");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const stamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      id: makeId(),
      name: `Screenshot ${stamp}.jpg`,
      kind: "image",
      size: Math.round(dataUrl.length * 0.75),
      content: dataUrl,
    };
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

/** The question actually sent to the backend: the typed question plus
 * each text attachment inlined as a labelled block. */
export function composeQuestionWithAttachments(
  question: string,
  attachments: ComposerAttachment[],
): string {
  const textFiles = attachments.filter((item) => item.kind === "text");
  if (textFiles.length === 0) return question;
  const blocks = textFiles.map((file) => {
    const body =
      file.content.length > MAX_INLINE_CHARS
        ? `${file.content.slice(0, MAX_INLINE_CHARS)}\n… (truncated)`
        : file.content;
    return `\n\n[Attached file: ${file.name}]\n${body}`;
  });
  return question + blocks.join("");
}
