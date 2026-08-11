import type { Project, ScormVersion } from "../types";
import { getProjectScormSettings } from "./settings";

function fileEntriesXml(files: string[]): string {
  const unique = [...new Set(files.map((f) => f.replace(/\\/g, "/")))];
  return unique.map((f) => `      <file href="${escapeXml(f)}"/>`).join("\n");
}

export function buildManifest12(
  title: string,
  files: string[] = [],
  passScore = 70,
): string {
  const safe = escapeXml(title);
  const mastery = Math.max(0, Math.min(100, Math.round(passScore)));
  const defaultFiles = [
    "index.html",
    "player.js",
    "player.css",
    "scorm-api.js",
    "course.json",
  ];
  const all = files.length ? files : defaultFiles;
  return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<manifest identifier="com.scormcreator.course" version="1"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org1">
    <organization identifier="org1">
      <title>${safe}</title>
      <item identifier="item1" identifierref="resource1" isvisible="true">
        <title>${safe}</title>
        <adlcp:masteryscore>${mastery}</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="resource1" type="webcontent" adlcp:scormtype="sco" href="index.html">
${fileEntriesXml(all)}
    </resource>
  </resources>
</manifest>`;
}

export function buildManifest2004(title: string, files: string[] = []): string {
  const safe = escapeXml(title);
  const defaultFiles = [
    "index.html",
    "player.js",
    "player.css",
    "scorm-api.js",
    "course.json",
  ];
  const all = files.length ? files : defaultFiles;
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.scormcreator.course.2004" version="1"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
                      http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd
                      http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd
                      http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd
                      http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="org1">
    <organization identifier="org1" adlseq:objectivesGlobalToSystem="false">
      <title>${safe}</title>
      <item identifier="item1" identifierref="resource1" isvisible="true">
        <title>${safe}</title>
        <imsss:sequencing>
          <imsss:deliveryControls completionSetByContent="true" objectiveSetByContent="true"/>
        </imsss:sequencing>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="resource1" type="webcontent" adlcp:scormType="sco" href="index.html">
${fileEntriesXml(all)}
    </resource>
  </resources>
</manifest>`;
}

export function buildManifest(
  title: string,
  version: ScormVersion,
  files: string[] = [],
  passScore = 70,
): string {
  return version === "2004"
    ? buildManifest2004(title, files)
    : buildManifest12(title, files, passScore);
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function serializeCourseJson(
  project: Project,
  version: ScormVersion,
) {
  const settings = getProjectScormSettings(project);
  const slides = project.slides;
  const visible = slides
    .filter((s) => !s.hidden)
    .filter((s) => !(s.type === "content" && s.blank))
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      if (s.type === "content") {
        return {
          id: s.id,
          type: s.type,
          title: s.title,
          bodyText: s.bodyText,
          narrationScript: s.narrationScript,
          audio: s.audioPath ? s.audioPath.replace(/\\/g, "/") : null,
          audioDurationMs: s.audioDurationMs,
          thumbnail: s.thumbnailPath
            ? s.thumbnailPath.replace(/\\/g, "/")
            : null,
          video: s.videoPath ? s.videoPath.replace(/\\/g, "/") : null,
        };
      }
      return {
        id: s.id,
        type: s.type,
        title: s.title || "Câu hỏi",
        questions: (s.questions && s.questions.length
          ? s.questions
          : [
              {
                id: `${s.id}-legacy`,
                quizType: s.quizType === "truefalse" ? "truefalse" : "single",
                question: s.question || "",
                options: s.options || [],
                feedbackCorrect: s.feedbackCorrect || "Chính xác!",
                feedbackIncorrect: s.feedbackIncorrect || "Chưa đúng.",
                points: s.points ?? 1,
                maxAttempts: s.maxAttempts ?? 2,
              },
            ]
        ).map((q) => ({
          id: q.id,
          quizType: q.quizType,
          question: q.question,
          options: q.options,
          feedbackCorrect: q.feedbackCorrect,
          feedbackIncorrect: q.feedbackIncorrect,
          points: q.points,
          maxAttempts: q.maxAttempts,
        })),
        gating: s.gating,
      };
    });

  return JSON.stringify(
    {
      title: project.title,
      scormVersion: version,
      passScore: settings.passScore,
      buttonPrimary: settings.buttonPrimary,
      buttonSecondary: settings.buttonSecondary,
      quizTheme: settings.quizTheme,
      requireFullAudio: settings.requireFullAudio,
      slides: visible,
    },
    null,
    2,
  );
}
