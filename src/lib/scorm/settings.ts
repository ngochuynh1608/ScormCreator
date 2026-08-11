import type { Project, ScormPlayerSettings } from "../types";

export const DEFAULT_SCORM_SETTINGS: ScormPlayerSettings = {
  buttonPrimary: "#3ddc97",
  buttonSecondary: "#2a3a4a",
  quizTheme: "dark",
  passScore: 70,
  requireFullAudio: false,
};

function clampPassScore(n: number) {
  if (!Number.isFinite(n)) return DEFAULT_SCORM_SETTINGS.passScore;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function isHexColor(value: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export function normalizeScormSettings(
  input?: Partial<ScormPlayerSettings> | null,
): ScormPlayerSettings {
  const primary =
    input?.buttonPrimary && isHexColor(input.buttonPrimary)
      ? input.buttonPrimary.trim()
      : DEFAULT_SCORM_SETTINGS.buttonPrimary;
  const secondary =
    input?.buttonSecondary && isHexColor(input.buttonSecondary)
      ? input.buttonSecondary.trim()
      : DEFAULT_SCORM_SETTINGS.buttonSecondary;
  const quizTheme = input?.quizTheme === "light" ? "light" : "dark";
  return {
    buttonPrimary: primary,
    buttonSecondary: secondary,
    quizTheme,
    passScore: clampPassScore(
      typeof input?.passScore === "number"
        ? input.passScore
        : DEFAULT_SCORM_SETTINGS.passScore,
    ),
    requireFullAudio: Boolean(input?.requireFullAudio),
  };
}

export function getProjectScormSettings(project: Project): ScormPlayerSettings {
  return normalizeScormSettings(project.scormSettings);
}
