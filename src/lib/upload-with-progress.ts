export type UploadPhase = "uploading" | "saving";

export type UploadProgress = {
  percent: number;
  loaded: number;
  total: number;
  phase: UploadPhase;
};

function parseJson(xhr: XMLHttpRequest): Record<string, unknown> {
  const text = xhr.responseText || "";
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return { error: text };
  }
  return {};
}

/** POST FormData with upload byte progress. Same-origin cookies are sent. */
export function postFormData(
  url: string,
  form: FormData,
  onProgress?: (progress: UploadProgress) => void,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      if (event.lengthComputable && event.total > 0) {
        const percent = Math.min(
          100,
          Math.round((event.loaded / event.total) * 100),
        );
        onProgress({
          percent,
          loaded: event.loaded,
          total: event.total,
          phase: percent >= 100 ? "saving" : "uploading",
        });
        return;
      }
      onProgress({
        percent: 0,
        loaded: event.loaded,
        total: event.total,
        phase: "uploading",
      });
    };

    xhr.upload.onload = () => {
      onProgress?.({
        percent: 100,
        loaded: 1,
        total: 1,
        phase: "saving",
      });
    };

    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        data: parseJson(xhr),
      });
    };
    xhr.onerror = () => reject(new Error("Không kết nối được máy chủ."));
    xhr.ontimeout = () => reject(new Error("Hết thời gian tải lên."));
    xhr.send(form);
  });
}
