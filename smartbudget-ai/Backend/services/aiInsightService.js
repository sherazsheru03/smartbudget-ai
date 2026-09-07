/**
 * aiInsightService.js
 *
 * Responsible ONLY for turning already-calculated budget/projection numbers
 * into concise natural-language insights via the Gemini Interactions API.
 *
 * This service:
 *  - does NOT access PostgreSQL, Budget.js, Expense.js, req, or res
 *  - does NOT calculate spending or projection numbers
 *  - is fully isolated: swap the provider here without touching any caller
 *
 * Required environment variables:
 *  - AI_API_KEY  (required — Gemini API key)
 *  - AI_MODEL    (optional — defaults to a Gemini Interactions-compatible model)
 */

const GEMINI_INTERACTIONS_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_AI_MODEL = "gemini-3.7-flash";
const REQUEST_TIMEOUT_MS = 30000;

const MAX_RETRIES_AFTER_INITIAL_ATTEMPT = 2;
const RETRY_BASE_DELAY_MS = 1000;

class AIInsightServiceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "AIInsightServiceError";
    this.code = code || "AI_INSIGHT_SERVICE_ERROR";
  }
}

const INSIGHT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    insights: {
      type: "array",
      description: "One concise insight per relevant budget category.",
      items: {
        type: "object",
        properties: {
          budgetId: {
            type: ["string", "integer", "null"],
            description:
              "The same identifier supplied for this budget in the input data.",
          },
          category: {
            type: "string",
            description: "The budget category this insight refers to.",
          },
          message: {
            type: "string",
            description:
              "A concise, non-judgmental 1-2 sentence insight using only the supplied numbers.",
          },
        },
        required: ["category", "message"],
      },
    },
    summary: {
      type: "string",
      description: "A concise 1-3 sentence overall summary across all budgets.",
    },
  },
  required: ["insights", "summary"],
};

const buildPrompt = (budgetData) => {
  const sanitizedPayload = budgetData.map((item) => ({
    budgetId: item.budgetId,
    category: item.category,
    budgetAmount: item.budgetAmount,
    actualSpending: item.actualSpending,
    remainingAmount: item.remainingAmount,
    percentageUsed: item.percentageUsed,
    dailyBurnRate: item.dailyBurnRate,
    projectedTotal: item.projectedTotal,
    projectedOverage: item.projectedOverage,
    daysRemaining: item.daysRemaining,
  }));

  const instructions = [
    "You are a budgeting assistant for a personal finance app.",
    "You will be given a JSON array of already-calculated budget figures for one user.",
    "",
    "STRICT RULES:",
    "- Do NOT change, recalculate, reinterpret, or invent any numerical value.",
    "- Use ONLY the numbers supplied in the input. Do not invent expenses, budgets, dates, percentages, or financial facts.",
    "- Do NOT give investment, lending, tax, or other high-stakes financial advice.",
    "- Keep all output informational and budgeting-focused only.",
    "- Use practical, non-judgmental language. Never shame or lecture the user.",
    "- Clearly distinguish three states per budget: \"on track\", \"at risk\", and \"projected to exceed\", based on the supplied percentageUsed/projectedOverage/daysRemaining values.",
    "- Keep each insight message concise (1-2 sentences).",
    "- Keep the overall summary concise (1-3 sentences).",
    "- For each item in the input array, preserve its budgetId exactly as given (including if it is missing/null) in your corresponding insight.",
    "",
    "Input budget data:",
    JSON.stringify(sanitizedPayload),
  ];

  return instructions.join("\n");
};

const extractOutputTextFromInteraction = (interaction) => {
  const modelOutputStep = Array.isArray(interaction?.steps)
    ? interaction.steps.find((step) => step?.type === "model_output")
    : null;

  const textContent = Array.isArray(modelOutputStep?.content)
    ? modelOutputStep.content.find((contentItem) => contentItem?.type === "text")
    : null;

  const outputText = textContent?.text;

  if (typeof outputText !== "string" || outputText.trim() === "") {
    throw new AIInsightServiceError(
      "AI provider returned an empty or unexpected response.",
      "AI_EMPTY_RESPONSE"
    );
  }

  return outputText;
};

const parseModelJsonText = (text) => {
  const trimmedText = text.trim();

  const fencedJsonMatch = trimmedText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonCandidate = fencedJsonMatch ? fencedJsonMatch[1].trim() : trimmedText;

  try {
    return JSON.parse(jsonCandidate);
  } catch (parseError) {
    throw new AIInsightServiceError(
      "AI provider response was not valid JSON.",
      "AI_INVALID_JSON"
    );
  }
};

const validateInsightResponse = (parsedResponse) => {
  if (!parsedResponse || typeof parsedResponse !== "object") {
    throw new AIInsightServiceError(
      "AI provider response was not a JSON object.",
      "AI_MALFORMED_RESPONSE"
    );
  }

  if (!Array.isArray(parsedResponse.insights)) {
    throw new AIInsightServiceError(
      "AI provider response is missing a valid 'insights' array.",
      "AI_MALFORMED_RESPONSE"
    );
  }

  const hasValidInsightShape = parsedResponse.insights.every((insight) => {
    return (
      insight &&
      typeof insight === "object" &&
      typeof insight.category === "string" &&
      insight.category.trim() !== "" &&
      typeof insight.message === "string" &&
      insight.message.trim() !== ""
    );
  });

  if (!hasValidInsightShape) {
    throw new AIInsightServiceError(
      "AI provider response contains a malformed insight entry.",
      "AI_MALFORMED_RESPONSE"
    );
  }

  if (typeof parsedResponse.summary !== "string") {
    throw new AIInsightServiceError(
      "AI provider response is missing a valid 'summary' string.",
      "AI_MALFORMED_RESPONSE"
    );
  }

  return {
    insights: parsedResponse.insights.map((insight) => ({
      budgetId: insight.budgetId,
      category: insight.category,
      message: insight.message,
    })),
    summary: parsedResponse.summary,
  };
};

const wait = (delayMs) =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

/**
 * Performs a single attempt at calling the Gemini Interactions endpoint.
 * Applies the per-request timeout via AbortController.
 * Does NOT retry — retry orchestration lives in callGeminiInteractionsApi.
 */
const performSingleGeminiRequest = async (apiKey, requestBody) => {
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(
    () => abortController.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(GEMINI_INTERACTIONS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: abortController.signal,
    });

    return response;
  } catch (networkError) {
    if (networkError.name === "AbortError") {
      throw new AIInsightServiceError(
        "AI provider request timed out.",
        "AI_TIMEOUT"
      );
    }

    throw new AIInsightServiceError(
      "Failed to reach AI provider due to a network error.",
      "AI_NETWORK_ERROR"
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
};

/**
 * Calls the Gemini Interactions API, retrying only on transient 5xx
 * responses, with a short exponential backoff between attempts.
 *
 * Retry policy:
 *  - Up to 2 retries after the initial attempt (3 total attempts max).
 *  - Only HTTP 5xx status codes are retried.
 *  - Timeouts, network errors, and 4xx statuses are NOT retried —
 *    they throw immediately with their existing controlled error codes.
 */
const callGeminiInteractionsApi = async (prompt) => {
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    throw new AIInsightServiceError(
      "AI_API_KEY environment variable is not configured.",
      "AI_MISSING_API_KEY"
    );
  }

  const model = process.env.AI_MODEL || DEFAULT_AI_MODEL;

  const requestBody = {
    model,
    input: prompt,
    store: false,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: INSIGHT_RESPONSE_SCHEMA,
    },
  };

  const totalAttempts = MAX_RETRIES_AFTER_INITIAL_ATTEMPT + 1;
  let lastHttpErrorStatus = null;

  for (let attemptNumber = 1; attemptNumber <= totalAttempts; attemptNumber += 1) {
    // Timeouts/network errors are NOT retryable — they throw immediately
    // and propagate straight out of this function on any attempt.
    const response = await performSingleGeminiRequest(apiKey, requestBody);

    if (response.ok) {
      let responseBody;

      try {
        responseBody = await response.json();
      } catch (jsonError) {
        throw new AIInsightServiceError(
          "AI provider response could not be parsed as JSON.",
          "AI_INVALID_JSON"
        );
      }

      return responseBody;
    }

    const isRetryableServerError = response.status >= 500 && response.status <= 599;
    lastHttpErrorStatus = response.status;

    const isLastAttempt = attemptNumber === totalAttempts;

    if (!isRetryableServerError || isLastAttempt) {
      throw new AIInsightServiceError(
        `AI provider returned an error response (status ${response.status}).`,
        "AI_HTTP_ERROR"
      );
    }

    const backoffDelayMs = RETRY_BASE_DELAY_MS * 2 ** (attemptNumber - 1);
    await wait(backoffDelayMs);
  }

  // Defensive fallback — should be unreachable given the loop above,
  // but guarantees a controlled error rather than an undefined return.
  throw new AIInsightServiceError(
    `AI provider returned an error response (status ${lastHttpErrorStatus}).`,
    "AI_HTTP_ERROR"
  );
};

/**
 * Generates concise, non-judgmental budget insights from pre-computed data.
 *
 * @param {Array<Object>} budgetData - Array of pre-calculated budget/projection figures.
 *   Each item may include: budgetId, category, budgetAmount, actualSpending,
 *   remainingAmount, percentageUsed, dailyBurnRate, projectedTotal,
 *   projectedOverage, daysRemaining.
 * @returns {Promise<{ insights: Array<{ budgetId: any, category: string, message: string }>, summary: string }>}
 * @throws {AIInsightServiceError} on missing API key, network failure, timeout,
 *   invalid provider response, or malformed insight data.
 */
const generateBudgetInsights = async (budgetData) => {
  if (!Array.isArray(budgetData) || budgetData.length === 0) {
    throw new AIInsightServiceError(
      "budgetData must be a non-empty array of pre-calculated budget figures.",
      "AI_INVALID_INPUT"
    );
  }

  const prompt = buildPrompt(budgetData);

  const interaction = await callGeminiInteractionsApi(prompt);
  const outputText = extractOutputTextFromInteraction(interaction);
  const parsedJson = parseModelJsonText(outputText);

  return validateInsightResponse(parsedJson);
};

module.exports = {
  generateBudgetInsights,
  AIInsightServiceError,
};
