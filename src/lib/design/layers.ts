import { v4 as uuidv4 } from "uuid";
import type { QuizQuestion } from "../types";

/** Position/size as % of the 16:9 stage (0–100). */
export type SlideBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SlideImageOverlay = SlideBox & {
  id: string;
  kind: "image";
  src: string;
  z: number;
};

export type SlideTextOverlay = SlideBox & {
  id: string;
  kind: "text";
  text: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  bold: boolean;
  z: number;
};

export type SlideHotspotOverlay = SlideBox & {
  id: string;
  kind: "hotspot";
  label: string;
  /** Fill color of the circular hotspot marker. */
  color?: string;
  question: QuizQuestion;
  z: number;
};

export type SlideDesignLayer =
  | SlideImageOverlay
  | SlideTextOverlay
  | SlideHotspotOverlay;

export type SlideImageCrop = SlideBox;

export function clampBox(box: SlideBox): SlideBox {
  const w = Math.min(100, Math.max(4, box.w));
  const h = Math.min(100, Math.max(4, box.h));
  const x = Math.min(100 - w, Math.max(0, box.x));
  const y = Math.min(100 - h, Math.max(0, box.y));
  return { x, y, w, h };
}

export function nextLayerZ(layers: SlideDesignLayer[]): number {
  return layers.reduce((m, l) => Math.max(m, l.z), 0) + 1;
}

export function createTextLayer(
  layers: SlideDesignLayer[],
): SlideTextOverlay {
  return {
    id: uuidv4(),
    kind: "text",
    text: "Nhập nội dung…",
    fontSize: 4.5,
    color: "#ffffff",
    align: "center",
    bold: true,
    z: nextLayerZ(layers),
    x: 20,
    y: 40,
    w: 60,
    h: 12,
  };
}

export function createImageLayer(
  layers: SlideDesignLayer[],
  src: string,
): SlideImageOverlay {
  return {
    id: uuidv4(),
    kind: "image",
    src,
    z: nextLayerZ(layers),
    x: 25,
    y: 25,
    w: 50,
    h: 50,
  };
}

export function createHotspotLayer(
  layers: SlideDesignLayer[],
  question: QuizQuestion,
): SlideHotspotOverlay {
  return {
    id: uuidv4(),
    kind: "hotspot",
    label: "?",
    color: "#2f6fed",
    question,
    z: nextLayerZ(layers),
    x: 44,
    y: 40,
    w: 10,
    h: 10,
  };
}

export function cropStyle(crop?: SlideImageCrop | null): {
  objectFit: "none";
  objectPosition: string;
  transform: string;
  transformOrigin: string;
  width: string;
  height: string;
  maxWidth: "none";
  maxHeight: "none";
} | null {
  if (!crop) return null;
  const scaleX = 100 / Math.max(4, crop.w);
  const scaleY = 100 / Math.max(4, crop.h);
  const scale = Math.max(scaleX, scaleY);
  return {
    objectFit: "none",
    objectPosition: `${-crop.x * scale}% ${-crop.y * scale}%`,
    transform: `scale(${scale})`,
    transformOrigin: "0 0",
    width: "100%",
    height: "100%",
    maxWidth: "none",
    maxHeight: "none",
  };
}
