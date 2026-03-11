export type StepQuestionnaireOption = {
  id: string;
  label: string;
};

export type StepQuestionnaireQuestion = {
  id: string;
  prompt: string;
  options: StepQuestionnaireOption[];
  correctOptionId?: string;
};

export type StepQuestionnaire = {
  questions: StepQuestionnaireQuestion[];
  passingScore?: number;
  successMessage?: string;
  failureMessage?: string;
};

export type StepQuestionnaireAttemptAnswer = {
  questionId: string;
  answerId: string;
  correct?: boolean;
};

export type StepQuestionnaireAttempt = {
  answers: StepQuestionnaireAttemptAnswer[];
  answeredAt?: string;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  passingScore: number;
  attempts?: number;
};

function readTrimmedString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readOptions(rawOptions: unknown) {
  if (!Array.isArray(rawOptions)) {
    return [] as StepQuestionnaireOption[];
  }

  return rawOptions
    .filter(
      (option): option is Record<string, unknown> =>
        Boolean(option) && typeof option === 'object'
    )
    .map((option, index) => ({
      id: readTrimmedString(option.id) ?? `option-${index + 1}`,
      label: readTrimmedString(option.label) ?? ''
    }))
    .filter((option) => option.label.length > 0);
}

function readQuestion(
  rawQuestion: unknown,
  index: number
): StepQuestionnaireQuestion | null {
  if (!rawQuestion || typeof rawQuestion !== 'object') {
    return null;
  }

  const candidate = rawQuestion as Record<string, unknown>;
  const prompt = readTrimmedString(candidate.prompt);
  const options = readOptions(candidate.options);

  if (!prompt || options.length < 2) {
    return null;
  }

  const correctOptionId = readTrimmedString(candidate.correctOptionId);

  return {
    id: readTrimmedString(candidate.id) ?? `question-${index + 1}`,
    prompt,
    options,
    correctOptionId: options.some((option) => option.id === correctOptionId)
      ? correctOptionId
      : undefined
  };
}

export function clampPassingScore(
  score: number | undefined,
  totalQuestions: number
) {
  if (totalQuestions <= 0) {
    return 0;
  }

  const safeScore =
    typeof score === 'number' && Number.isFinite(score)
      ? Math.round(score)
      : totalQuestions;

  return Math.max(1, Math.min(safeScore, totalQuestions));
}

export function readStepQuestionnaire(value: unknown) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const successMessage = readTrimmedString(candidate.successMessage);
  const failureMessage = readTrimmedString(candidate.failureMessage);
  const rawPassingScore =
    typeof candidate.passingScore === 'number' && Number.isFinite(candidate.passingScore)
      ? candidate.passingScore
      : undefined;

  if (Array.isArray(candidate.questions)) {
    const questions = candidate.questions
      .map((question, index) => readQuestion(question, index))
      .filter((question): question is StepQuestionnaireQuestion => Boolean(question));

    if (!questions.length) {
      return undefined;
    }

    return {
      questions,
      passingScore: clampPassingScore(rawPassingScore, questions.length),
      successMessage,
      failureMessage
    } satisfies StepQuestionnaire;
  }

  const prompt = readTrimmedString(candidate.prompt);
  const options = readOptions(candidate.options);

  if (!prompt || options.length < 2) {
    return undefined;
  }

  const correctOptionId = readTrimmedString(candidate.correctOptionId);

  return {
    questions: [
      {
        id: 'question-1',
        prompt,
        options,
        correctOptionId: options.some((option) => option.id === correctOptionId)
          ? correctOptionId
          : undefined
      }
    ],
    passingScore: clampPassingScore(rawPassingScore, 1),
    successMessage,
    failureMessage
  } satisfies StepQuestionnaire;
}

export function readStepQuestionnaireAttempt(value: unknown) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const passed =
    typeof candidate.passed === 'boolean' ? candidate.passed : undefined;
  const answeredAt = readTrimmedString(candidate.answeredAt);
  const attempts =
    typeof candidate.attempts === 'number' && Number.isFinite(candidate.attempts)
      ? Math.max(1, Math.round(candidate.attempts))
      : undefined;

  if (Array.isArray(candidate.answers)) {
    const answers = candidate.answers.reduce<StepQuestionnaireAttemptAnswer[]>(
      (accumulator, answer, index) => {
        if (!answer || typeof answer !== 'object') {
          return accumulator;
        }

        const candidateAnswer = answer as Record<string, unknown>;
        const answerId = readTrimmedString(candidateAnswer.answerId);
        if (!answerId) {
          return accumulator;
        }

        accumulator.push({
          questionId:
            readTrimmedString(candidateAnswer.questionId) ?? `question-${index + 1}`,
          answerId,
          correct:
            typeof candidateAnswer.correct === 'boolean'
              ? candidateAnswer.correct
              : undefined
        });

        return accumulator;
      },
      []
    );

    if (!answers.length || passed == null) {
      return undefined;
    }

    const totalQuestions =
      typeof candidate.totalQuestions === 'number' &&
      Number.isFinite(candidate.totalQuestions)
        ? Math.max(answers.length, Math.round(candidate.totalQuestions))
        : answers.length;
    const correctCount =
      typeof candidate.correctCount === 'number' &&
      Number.isFinite(candidate.correctCount)
        ? Math.max(0, Math.min(Math.round(candidate.correctCount), totalQuestions))
        : answers.filter((answer) => answer.correct).length;

    return {
      answers,
      answeredAt,
      passed,
      correctCount,
      totalQuestions,
      passingScore: clampPassingScore(
        typeof candidate.passingScore === 'number' &&
          Number.isFinite(candidate.passingScore)
          ? candidate.passingScore
          : undefined,
        totalQuestions
      ),
      attempts
    } satisfies StepQuestionnaireAttempt;
  }

  const answerId = readTrimmedString(candidate.answerId);
  if (!answerId || passed == null) {
    return undefined;
  }

  return {
    answers: [{ questionId: 'question-1', answerId, correct: passed }],
    answeredAt,
    passed,
    correctCount: passed ? 1 : 0,
    totalQuestions: 1,
    passingScore: 1,
    attempts
  } satisfies StepQuestionnaireAttempt;
}
