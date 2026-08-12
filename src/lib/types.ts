export type QuizOption = {
  id: string;
  text: string;
  correct: boolean;
};

export type QuizType = "single" | "truefalse";

export type QuizQuestion = {
  id: string;
  quizType: QuizType;
  question: string;
  options: QuizOption[];
  feedbackCorrect: string;
  feedbackIncorrect: string;
  points: number;
  maxAttempts: number;
};

export type ContentSlide = {
  id: string;
  type: "content";
  order: number;
  title: string;
  bodyText: string;
  notes: string;
  narrationScript: string;
  audioPath: string | null;
  audioDurationMs: number | null;
  /** ISO time when audio was last generated/uploaded — used to win PATCH races. */
  audioUpdatedAt?: string | null;
  hidden: boolean;
  thumbnailPath: string | null;
  /** Crop rectangle on background image (% of stage). */
  imageCrop?: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
  /**
   * Design overlays: images, text, hotspot quizzes on top of background.
   * Coordinates are % of the 16:9 stage.
   */
  designLayers?: Array<
    | {
        id: string;
        kind: "image";
        src: string;
        x: number;
        y: number;
        w: number;
        h: number;
        z: number;
      }
    | {
        id: string;
        kind: "text";
        text: string;
        fontSize: number;
        color: string;
        align: "left" | "center" | "right";
        bold: boolean;
        x: number;
        y: number;
        w: number;
        h: number;
        z: number;
      }
    | {
        id: string;
        kind: "hotspot";
        label: string;
        /** Circular marker fill color. */
        color?: string;
        question: QuizQuestion;
        x: number;
        y: number;
        w: number;
        h: number;
        z: number;
      }
  >;
  /** Optional video that replaces the slide image in player/preview. */
  videoPath?: string | null;
  /** Empty slide waiting for media or quiz choice. */
  blank?: boolean;
  mediaFiles: string[];
};

export type QuizSlide = {
  id: string;
  type: "quiz";
  order: number;
  title?: string;
  questions: QuizQuestion[];
  gating: boolean;
  hidden: boolean;
  /** @deprecated legacy single-question fields (migrated via getQuizQuestions) */
  quizType?: QuizType;
  question?: string;
  options?: QuizOption[];
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
  points?: number;
  maxAttempts?: number;
};

export type Slide = ContentSlide | QuizSlide;

export type ProjectStatus = "ready" | "processing" | "error";

export type ScormPlayerSettings = {
  /** Màu nút chính (Tiếp / Submit). */
  buttonPrimary: string;
  /** Màu nút phụ (Trước). */
  buttonSecondary: string;
  /** Nền panel câu hỏi trong player. */
  quizTheme: "light" | "dark";
  /** % điểm tối thiểu để passed khi hoàn thành. */
  passScore: number;
  /**
   * true = phải nghe hết audio mới Next.
   * false = được xem nhanh / chuyển slide sớm.
   */
  requireFullAudio: boolean;
};

export type Project = {
  id: string;
  title: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  originalFileName: string;
  slides: Slide[];
  errorMessage?: string;
  scormSettings?: ScormPlayerSettings;
  /** Account that owns this presentation. */
  ownerId?: string;
  /** Opaque token for unclaimed guest drafts (cookie must match). */
  guestClaimToken?: string | null;
};

export type TtsJobStatus = "queued" | "running" | "done" | "error" | "cancelled";

export type TtsJob = {
  id: string;
  projectId: string;
  slideId: string;
  status: TtsJobStatus;
  voice: string;
  language: string;
  rate: number;
  pitch: number;
  modelId?: string;
  provider?: "everai" | "mock" | "auto";
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
  resultAudioPath?: string;
  resultDurationMs?: number;
};

export type ScormVersion = "1.2" | "2004";

export type CourseExportData = {
  title: string;
  slides: Slide[];
  scormVersion: ScormVersion;
};
