"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ContentSlide } from "@/lib/types";
import { createQuizQuestion } from "@/lib/quiz";
import {
  clampBox,
  createHotspotLayer,
  createImageLayer,
  createTextLayer,
  type SlideDesignLayer,
  type SlideImageCrop,
} from "@/lib/design/layers";

type Tool = "select" | "crop" | "hotspot";

type Props = {
  projectId: string;
  slide: ContentSlide;
  busy?: boolean;
  onChange: (patch: Partial<ContentSlide>) => void;
  onUploadOverlayImage: (file: File) => Promise<string | null>;
  onClose: () => void;
};

function fileUrl(projectId: string, relative: string | null | undefined) {
  if (!relative) return null;
  return `/api/files/${projectId}/${relative}`;
}

export function SlideDesignPanel({
  projectId,
  slide,
  busy = false,
  onChange,
  onUploadOverlayImage,
  onClose,
}: Props) {
  const [layers, setLayersState] = useState<SlideDesignLayer[]>(
    slide.designLayers || [],
  );
  const [crop, setCropState] = useState<SlideImageCrop | null>(
    slide.imageCrop || null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState<{
    mode: "move" | "resize" | "crop";
    id?: string;
    startX: number;
    startY: number;
    origin: SlideImageCrop | SlideDesignLayer;
  } | null>(null);
  const [cropDraft, setCropDraft] = useState<SlideImageCrop | null>(null);
  const [composing, setComposing] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [questionDraft, setQuestionDraft] = useState("");
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({});
  const stageRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const cropRef = useRef(crop);
  cropRef.current = crop;

  useEffect(() => {
    setLayersState(slide.designLayers || []);
    setCropState(slide.imageCrop || null);
    setSelectedId(null);
    setTool("select");
    setCropDraft(null);
    setComposing(false);
    setTextDraft("");
    setQuestionDraft("");
    setOptionDrafts({});
  }, [slide.id]);

  useEffect(() => {
    // Sync when parent updates after upload/persist of same slide,
    // but not while user is composing Vietnamese IME.
    if (composing) return;
    setLayersState(slide.designLayers || []);
    setCropState(slide.imageCrop || null);
  }, [slide.designLayers, slide.imageCrop, composing]);

  useEffect(() => {
    const sel = layers.find((l) => l.id === selectedId) || null;
    if (sel?.kind === "text") {
      setTextDraft(sel.text);
    } else if (sel?.kind === "hotspot") {
      setQuestionDraft(sel.question.question);
      const opts: Record<string, string> = {};
      for (const o of sel.question.options) opts[o.id] = o.text;
      setOptionDrafts(opts);
    }
  }, [selectedId]);

  const selected = useMemo(
    () => layers.find((l) => l.id === selectedId) || null,
    [layers, selectedId],
  );

  function commitLayers(next: SlideDesignLayer[]) {
    setLayersState(next);
    onChange({ designLayers: next, imageCrop: crop });
  }

  function commitCrop(next: SlideImageCrop | null) {
    setCropState(next);
    onChange({ designLayers: layers, imageCrop: next });
  }

  function updateLayer(id: string, patch: Partial<SlideDesignLayer>) {
    const next = layers.map((l) =>
      l.id === id ? ({ ...l, ...patch } as SlideDesignLayer) : l,
    );
    setLayersState(next);
    return next;
  }

  function deleteSelected() {
    if (selectedId) {
      commitLayers(layers.filter((l) => l.id !== selectedId));
      setSelectedId(null);
      return;
    }
    if (crop) commitCrop(null);
  }

  async function addOverlayImage(file: File) {
    setUploading(true);
    try {
      const src = await onUploadOverlayImage(file);
      if (!src) return;
      const layer = createImageLayer(layers, src);
      commitLayers([...layers, layer]);
      setSelectedId(layer.id);
      setTool("select");
    } finally {
      setUploading(false);
    }
  }

  function addText() {
    const layer = createTextLayer(layers);
    commitLayers([...layers, layer]);
    setSelectedId(layer.id);
    setTool("select");
  }

  function pctFromEvent(e: React.PointerEvent | PointerEvent) {
    const el = stageRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    };
  }

  function onStagePointerDown(e: React.PointerEvent) {
    if (tool === "crop") {
      const p = pctFromEvent(e);
      const origin = { x: p.x, y: p.y, w: 0, h: 0 };
      setCropDraft(origin);
      setDrag({ mode: "crop", startX: p.x, startY: p.y, origin });
      stageRef.current?.setPointerCapture?.(e.pointerId);
      return;
    }
    if (tool === "hotspot") {
      const p = pctFromEvent(e);
      const q = createQuizQuestion("single");
      q.question = "Câu hỏi hotspot?";
      const layer = createHotspotLayer(layers, q);
      layer.x = Math.min(88, Math.max(0, p.x - 6));
      layer.y = Math.min(88, Math.max(0, p.y - 6));
      commitLayers([...layers, layer]);
      setSelectedId(layer.id);
      setTool("select");
      return;
    }
    if (e.target === stageRef.current) setSelectedId(null);
  }

  function onLayerPointerDown(e: React.PointerEvent, layer: SlideDesignLayer) {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelectedId(layer.id);
    const p = pctFromEvent(e);
    setDrag({
      mode: "move",
      id: layer.id,
      startX: p.x,
      startY: p.y,
      origin: { ...layer },
    });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onResizePointerDown(e: React.PointerEvent, layer: SlideDesignLayer) {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelectedId(layer.id);
    const p = pctFromEvent(e);
    setDrag({
      mode: "resize",
      id: layer.id,
      startX: p.x,
      startY: p.y,
      origin: { ...layer },
    });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const p = pctFromEvent(e);
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;

    if (drag.mode === "crop") {
      setCropDraft(
        clampBox({
          x: Math.min(drag.startX, p.x),
          y: Math.min(drag.startY, p.y),
          w: Math.abs(dx),
          h: Math.abs(dy),
        }),
      );
      return;
    }
    if (!drag.id) return;
    const origin = drag.origin as SlideDesignLayer;
    if (drag.mode === "move") {
      updateLayer(
        drag.id,
        clampBox({
          x: origin.x + dx,
          y: origin.y + dy,
          w: origin.w,
          h: origin.h,
        }),
      );
    } else {
      const origin = drag.origin as SlideDesignLayer;
      const size = Math.max(4, Math.max(origin.w + dx, origin.h + dy));
      if (origin.kind === "hotspot") {
        updateLayer(
          drag.id,
          clampBox({
            x: origin.x,
            y: origin.y,
            w: size,
            h: size,
          }),
        );
      } else {
        updateLayer(
          drag.id,
          clampBox({
            x: origin.x,
            y: origin.y,
            w: origin.w + dx,
            h: origin.h + dy,
          }),
        );
      }
    }
  }

  function onPointerUp() {
    if (drag?.mode === "crop" && cropDraft && cropDraft.w >= 4 && cropDraft.h >= 4) {
      commitCrop(clampBox(cropDraft));
      setTool("select");
    } else if (drag?.id) {
      onChange({
        designLayers: layersRef.current,
        imageCrop: cropRef.current,
      });
    }
    setDrag(null);
    setCropDraft(null);
  }

  const bgUrl = fileUrl(projectId, slide.thumbnailPath);

  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#1a2330]">Design slide</p>
          <p className="mt-1 text-xs leading-5 text-[#6b7c8d]">
            Thêm ảnh chèn, text, cắt nền, hotspot câu hỏi; kéo để di chuyển.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-[#e8eef5] px-3 py-1.5 text-xs font-semibold text-[#1a2330]"
        >
          Đóng
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void addOverlayImage(f);
          }}
        />
        <ToolBtn
          label="Thêm ảnh"
          icon="image"
          disabled={busy || uploading}
          onClick={() => imageInputRef.current?.click()}
        />
        <ToolBtn label="Thêm text" icon="text" onClick={addText} />
        <ToolBtn
          label="Cắt ảnh"
          icon="crop"
          active={tool === "crop"}
          onClick={() => {
            setTool((t) => (t === "crop" ? "select" : "crop"));
            setSelectedId(null);
          }}
        />
        <ToolBtn
          label="Hotspot"
          icon="hotspot"
          active={tool === "hotspot"}
          onClick={() =>
            setTool((t) => (t === "hotspot" ? "select" : "hotspot"))
          }
        />
        <ToolBtn
          label="Xóa"
          icon="delete"
          danger
          disabled={!selectedId && !crop}
          onClick={deleteSelected}
        />
      </div>

      {tool === "crop" ? (
        <p className="text-xs text-[#8a5a00]">
          Kéo trên ảnh nền để chọn vùng cắt.
        </p>
      ) : null}
      {tool === "hotspot" ? (
        <p className="text-xs text-[#8a5a00]">
          Bấm lên ảnh để đặt hotspot câu hỏi.
        </p>
      ) : null}

      <div
        ref={stageRef}
        className="relative aspect-video touch-none overflow-hidden rounded-xl bg-[#0f2a36]"
        onPointerDown={onStagePointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {bgUrl ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bgUrl}
              alt=""
              draggable={false}
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
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/70">
            Chưa có ảnh nền
          </div>
        )}

        {cropDraft ? (
          <div
            className="pointer-events-none absolute border-2 border-[#2bb673] bg-[#2bb673]/20"
            style={{
              left: `${cropDraft.x}%`,
              top: `${cropDraft.y}%`,
              width: `${cropDraft.w}%`,
              height: `${cropDraft.h}%`,
            }}
          />
        ) : null}

        {[...layers]
          .sort((a, b) => a.z - b.z)
          .map((layer) => {
            // Same % for w/h is oval on 16:9 — circle via width + aspect-ratio.
            const hotspotSize =
              layer.kind === "hotspot" ? Math.min(layer.w, layer.h) : null;
            return (
            <div
              key={layer.id}
              className={`absolute ${
                selectedId === layer.id
                  ? "ring-2 ring-[#2bb673]"
                  : layer.kind === "hotspot"
                    ? ""
                    : "ring-1 ring-white/30"
              } ${tool === "select" ? "cursor-move" : "pointer-events-none"} ${
                layer.kind === "hotspot" ? "rounded-full" : ""
              }`}
              style={
                hotspotSize != null
                  ? {
                      left: `${layer.x}%`,
                      top: `${layer.y}%`,
                      width: `${hotspotSize}%`,
                      height: "auto",
                      aspectRatio: "1",
                      zIndex: layer.z + 10,
                    }
                  : {
                      left: `${layer.x}%`,
                      top: `${layer.y}%`,
                      width: `${layer.w}%`,
                      height: `${layer.h}%`,
                      zIndex: layer.z + 10,
                    }
              }
              onPointerDown={(e) => onLayerPointerDown(e, layer)}
            >
              {layer.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fileUrl(projectId, layer.src) || ""}
                  alt=""
                  draggable={false}
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
                  {selectedId === layer.id ? textDraft : layer.text}
                </div>
              ) : null}
              {layer.kind === "hotspot" ? (
                <div
                  className="flex h-full w-full items-center justify-center rounded-full text-sm font-bold text-white shadow-md ring-2 ring-white/70"
                  style={{ backgroundColor: layer.color || "#2f6fed" }}
                >
                  {layer.label || "?"}
                </div>
              ) : null}
              {selectedId === layer.id && tool === "select" ? (
                <span
                  className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize rounded-sm bg-[#2bb673]"
                  onPointerDown={(e) => onResizePointerDown(e, layer)}
                />
              ) : null}
            </div>
            );
          })}
      </div>

      {selected?.kind === "text" ? (
        <div className="grid gap-2 rounded-xl bg-[#f7f9fb] p-3">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#8a98a8]">
            Nội dung text
            <textarea
              value={textDraft}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={(e) => {
                setComposing(false);
                const value = e.currentTarget.value;
                setTextDraft(value);
                const next = updateLayer(selected.id, { text: value });
                onChange({ designLayers: next, imageCrop: crop });
              }}
              onChange={(e) => {
                const value = e.target.value;
                setTextDraft(value);
                if (composing) return;
                const next = updateLayer(selected.id, { text: value });
                onChange({ designLayers: next, imageCrop: crop });
              }}
              onBlur={() => {
                if (composing) return;
                const next = updateLayer(selected.id, { text: textDraft });
                onChange({ designLayers: next, imageCrop: crop });
              }}
              rows={2}
              className="mt-1 w-full rounded-lg border border-[#e2e8ef] bg-white px-2 py-1.5 text-sm text-[#0f2a36]"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[#8a98a8]">
              Cỡ chữ
              <input
                type="range"
                min={2}
                max={12}
                step={0.5}
                value={selected.fontSize}
                onChange={(e) => {
                  const next = updateLayer(selected.id, {
                    fontSize: Number(e.target.value),
                  });
                  onChange({ designLayers: next, imageCrop: crop });
                }}
                className="mt-1 w-full accent-[#2bb673]"
              />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[#8a98a8]">
              Màu
              <input
                type="color"
                value={selected.color}
                onChange={(e) => {
                  const next = updateLayer(selected.id, {
                    color: e.target.value,
                  });
                  onChange({ designLayers: next, imageCrop: crop });
                }}
                className="mt-1 h-9 w-full cursor-pointer rounded border-0 bg-transparent"
              />
            </label>
          </div>
        </div>
      ) : null}

      {selected?.kind === "hotspot" ? (
        <div className="grid gap-2 rounded-xl bg-[#f7f9fb] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#0f2a36]">
              Câu hỏi hotspot
            </p>
            <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#8a98a8]">
              Màu
              <input
                type="color"
                value={selected.color || "#2f6fed"}
                onChange={(e) => {
                  const next = updateLayer(selected.id, {
                    color: e.target.value,
                  });
                  onChange({ designLayers: next, imageCrop: crop });
                }}
                className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
              />
            </label>
          </div>
          <input
            value={questionDraft}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(e) => {
              setComposing(false);
              const value = e.currentTarget.value;
              setQuestionDraft(value);
              const next = updateLayer(selected.id, {
                question: { ...selected.question, question: value },
              });
              onChange({ designLayers: next, imageCrop: crop });
            }}
            onChange={(e) => {
              const value = e.target.value;
              setQuestionDraft(value);
              if (composing) return;
              const next = updateLayer(selected.id, {
                question: { ...selected.question, question: value },
              });
              onChange({ designLayers: next, imageCrop: crop });
            }}
            onBlur={() => {
              if (composing) return;
              const next = updateLayer(selected.id, {
                question: { ...selected.question, question: questionDraft },
              });
              onChange({ designLayers: next, imageCrop: crop });
            }}
            className="w-full rounded-lg border border-[#e2e8ef] bg-white px-2 py-1.5 text-sm"
            placeholder="Nhập câu hỏi…"
          />
          {selected.question.options.map(
            (
              opt: { id: string; text: string; correct: boolean },
              idx: number,
            ) => (
            <label
              key={opt.id}
              className="flex items-center gap-2 text-sm text-[#0f2a36]"
            >
              <input
                type="radio"
                name={`hs-${selected.id}`}
                checked={opt.correct}
                onChange={() => {
                  const next = updateLayer(selected.id, {
                    question: {
                      ...selected.question,
                      options: selected.question.options.map(
                        (
                          o: { id: string; text: string; correct: boolean },
                          i: number,
                        ) => ({
                          ...o,
                          correct: i === idx,
                        }),
                      ),
                    },
                  });
                  onChange({ designLayers: next, imageCrop: crop });
                }}
              />
              <input
                value={optionDrafts[opt.id] ?? opt.text}
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={(e) => {
                  setComposing(false);
                  const value = e.currentTarget.value;
                  setOptionDrafts((d) => ({ ...d, [opt.id]: value }));
                  const next = updateLayer(selected.id, {
                    question: {
                      ...selected.question,
                      options: selected.question.options.map(
                        (o: { id: string; text: string; correct: boolean }) =>
                          o.id === opt.id ? { ...o, text: value } : o,
                      ),
                    },
                  });
                  onChange({ designLayers: next, imageCrop: crop });
                }}
                onChange={(e) => {
                  const value = e.target.value;
                  setOptionDrafts((d) => ({ ...d, [opt.id]: value }));
                  if (composing) return;
                  const next = updateLayer(selected.id, {
                    question: {
                      ...selected.question,
                      options: selected.question.options.map(
                        (o: { id: string; text: string; correct: boolean }) =>
                          o.id === opt.id ? { ...o, text: value } : o,
                      ),
                    },
                  });
                  onChange({ designLayers: next, imageCrop: crop });
                }}
                onBlur={() => {
                  if (composing) return;
                  const value = optionDrafts[opt.id] ?? opt.text;
                  const next = updateLayer(selected.id, {
                    question: {
                      ...selected.question,
                      options: selected.question.options.map(
                        (o: { id: string; text: string; correct: boolean }) =>
                          o.id === opt.id ? { ...o, text: value } : o,
                      ),
                    },
                  });
                  onChange({ designLayers: next, imageCrop: crop });
                }}
                className="flex-1 rounded-lg border border-[#e2e8ef] bg-white px-2 py-1 text-sm"
              />
            </label>
          ),
          )}
        </div>
      ) : null}

      {crop ? (
        <button
          type="button"
          onClick={() => commitCrop(null)}
          className="rounded-full bg-[#e8eef5] px-4 py-2 text-sm font-semibold text-[#1a2330]"
        >
          Bỏ cắt ảnh nền
        </button>
      ) : null}
    </div>
  );
}

function ToolBtn({
  label,
  icon,
  onClick,
  active,
  danger,
  disabled,
}: {
  label: string;
  icon: "image" | "text" | "crop" | "hotspot" | "delete";
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`group relative inline-flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-40 ${
        danger
          ? "bg-[#fdecea] text-[#c62828] hover:bg-[#f8d7d3]"
          : active
            ? "bg-[#e8f8ef] text-[#1f7a4d]"
            : "bg-[#f3f6f9] text-[#0f2a36] hover:bg-[#e8eef2]"
      }`}
    >
      <ToolIcon name={icon} />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#1a2330] px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {label}
      </span>
    </button>
  );
}

function ToolIcon({
  name,
}: {
  name: "image" | "text" | "crop" | "hotspot" | "delete";
}) {
  if (name === "image") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
        <path
          d="m21 16-5.5-5.5L7 19"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (name === "text") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 6h14M12 6v12M9 18h6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (name === "crop") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 3v12a3 3 0 0 0 3 3h12M3 6h12a3 3 0 0 1 3 3v12"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (name === "hotspot") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        <path
          d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-1 0v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
