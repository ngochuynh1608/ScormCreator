"use client";

import type { ContentSlide } from "@/lib/types";
import type { SlideDesignLayer } from "@/lib/design/layers";

function fileUrl(projectId: string, relative: string | null | undefined) {
  if (!relative) return null;
  return `/api/files/${projectId}/${relative}`;
}

type Props = {
  projectId: string;
  slide: ContentSlide;
  className?: string;
  /** When true, hotspot clicks call onHotspot. */
  interactiveHotspots?: boolean;
  onHotspot?: (layer: Extract<SlideDesignLayer, { kind: "hotspot" }>) => void;
};

/** Shared 16:9 stage: background (+ crop) + design layers. */
export function SlideStageView({
  projectId,
  slide,
  className = "",
  interactiveHotspots = false,
  onHotspot,
}: Props) {
  const layers = [...(slide.designLayers || [])].sort((a, b) => a.z - b.z);
  const crop = slide.imageCrop;
  const bg = fileUrl(projectId, slide.thumbnailPath);
  const video = fileUrl(projectId, slide.videoPath);

  return (
    <div
      className={`relative aspect-video overflow-hidden bg-[#0f2a36] ${className}`}
    >
      {video ? (
        <video
          key={video}
          src={video}
          controls
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : bg ? (
        <div className="absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bg}
            alt={slide.title}
            className="select-none"
            style={
              crop
                ? {
                    position: "absolute",
                    left: `${(-crop.x / crop.w) * 100}%`,
                    top: `${(-crop.y / crop.h) * 100}%`,
                    width: `${(100 / crop.w) * 100}%`,
                    height: `${(100 / crop.h) * 100}%`,
                    maxWidth: "none",
                    objectFit: "fill",
                  }
                : { width: "100%", height: "100%", objectFit: "contain" }
            }
          />
        </div>
      ) : null}

      {layers.map((layer) => {
        // Same % for w/h is not a circle on 16:9 — size by width + aspect-ratio.
        const hotspotSize =
          layer.kind === "hotspot" ? Math.min(layer.w, layer.h) : null;
        return (
        <div
          key={layer.id}
          className={`absolute ${layer.kind === "hotspot" ? "rounded-full" : ""}`}
          style={
            hotspotSize != null
              ? {
                  left: `${layer.x}%`,
                  top: `${layer.y}%`,
                  width: `${hotspotSize}%`,
                  height: "auto",
                  aspectRatio: "1",
                  zIndex: layer.z + 5,
                }
              : {
                  left: `${layer.x}%`,
                  top: `${layer.y}%`,
                  width: `${layer.w}%`,
                  height: `${layer.h}%`,
                  zIndex: layer.z + 5,
                }
          }
        >
          {layer.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl(projectId, layer.src) || ""}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : null}
          {layer.kind === "text" ? (
            <div
              className="flex h-full w-full items-center overflow-hidden px-1"
              style={{
                color: layer.color,
                fontSize: `clamp(10px, ${layer.fontSize}cqw, 64px)`,
                fontWeight: layer.bold ? 700 : 500,
                textAlign: layer.align,
                justifyContent:
                  layer.align === "left"
                    ? "flex-start"
                    : layer.align === "right"
                      ? "flex-end"
                      : "center",
                containerType: "size",
              }}
            >
              {layer.text}
            </div>
          ) : null}
          {layer.kind === "hotspot" ? (
            <button
              type="button"
              disabled={!interactiveHotspots}
              onClick={() => onHotspot?.(layer)}
              className="flex h-full w-full items-center justify-center rounded-full text-sm font-bold text-white shadow-md ring-2 ring-white/70 disabled:cursor-default"
              style={{ backgroundColor: layer.color || "#2f6fed" }}
            >
              {layer.label || "?"}
            </button>
          ) : null}
        </div>
        );
      })}
    </div>
  );
}
