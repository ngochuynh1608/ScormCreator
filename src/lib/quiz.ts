import { v4 as uuidv4 } from "uuid";
import type { QuizOption, QuizQuestion, QuizSlide, QuizType } from "./types";

export function createQuizOptions(quizType: QuizType): QuizOption[] {
  if (quizType === "truefalse") {
    return [
      { id: uuidv4(), text: "Đúng", correct: true },
      { id: uuidv4(), text: "Sai", correct: false },
    ];
  }
  return [
    { id: uuidv4(), text: "Đáp án A", correct: true },
    { id: uuidv4(), text: "Đáp án B", correct: false },
    { id: uuidv4(), text: "Đáp án C", correct: false },
    { id: uuidv4(), text: "Đáp án D", correct: false },
  ];
}

export function createQuizQuestion(quizType: QuizType): QuizQuestion {
  return {
    id: uuidv4(),
    quizType,
    question:
      quizType === "truefalse"
        ? "Khẳng định này đúng hay sai?"
        : "Chọn đáp án đúng:",
    options: createQuizOptions(quizType),
    feedbackCorrect: "Chính xác!",
    feedbackIncorrect: "Chưa đúng.",
    points: 1,
    maxAttempts: 2,
  };
}

export function createQuizSlide(input: {
  id?: string;
  order?: number;
  quizType?: QuizType;
  gating?: boolean;
}): QuizSlide {
  const quizType = input.quizType === "truefalse" ? "truefalse" : "single";
  return {
    id: input.id || uuidv4(),
    type: "quiz",
    order: input.order ?? 0,
    title: "Câu hỏi",
    questions: [createQuizQuestion(quizType)],
    gating: input.gating ?? true,
    hidden: false,
  };
}

/** Normalize legacy single-question quiz slides into questions[]. */
export function getQuizQuestions(slide: QuizSlide): QuizQuestion[] {
  if (Array.isArray(slide.questions) && slide.questions.length > 0) {
    return slide.questions;
  }
  if (slide.question) {
    return [
      {
        id: `${slide.id}-legacy`,
        quizType: slide.quizType === "truefalse" ? "truefalse" : "single",
        question: slide.question,
        options: slide.options || createQuizOptions("single"),
        feedbackCorrect: slide.feedbackCorrect || "Chính xác!",
        feedbackIncorrect: slide.feedbackIncorrect || "Chưa đúng.",
        points: slide.points ?? 1,
        maxAttempts: slide.maxAttempts ?? 2,
      },
    ];
  }
  return [];
}

export function quizSlidePoints(slide: QuizSlide): number {
  return getQuizQuestions(slide).reduce((sum, q) => sum + (q.points || 1), 0);
}

export function normalizeQuizSlide(slide: QuizSlide): QuizSlide {
  const questions = getQuizQuestions(slide);
  return {
    id: slide.id,
    type: "quiz",
    order: slide.order,
    title: slide.title || "Câu hỏi",
    questions,
    gating: slide.gating,
    hidden: slide.hidden,
  };
}
