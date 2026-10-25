/**
 * aiInsightService.js
 *
 * Responsible ONLY for turning already-calculated budget/projection numbers
 * into concise natural-language insights via the Groq Chat Completions API.
 *
 * This service:
 *  - does NOT access PostgreSQL, Budget.js, Expense.js, req, or res
 *  - does NOT calculate spending, projection, risk, or recommendation numbers
 *  - is fully isolated: swap the provider here without touching any caller
 *
 * Required environment variables:
 *  - GROQ_API_KEY  (required — Groq API key)
 *
 * The model is fixed in this file (GROQ_MODEL). The old AI_API_KEY and
 * AI_MODEL variables are no longer read.
 */


const GROQ_CHAT_COMPLETIONS_ENDPOINT =
  "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-20b";
const REQUEST_TIMEOUT_MS = 30000;

// gpt-oss models spend part of this budget on reasoning tokens, so keep it
// comfortably above the size of the expected JSON answer.
const MAX_COMPLETION_TOKENS = 4096;


const MAX_RETRIES_AFTER_INITIAL_ATTEMPT = 2;
const RETRY_BASE_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;


const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"];


class AIInsightServiceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "AIInsightServiceError";
    this.code = code || "AI_INSIGHT_SERVICE_ERROR";
  }
}


// Groq strict structured outputs require every property to be listed in
// "required" and every object to set "additionalProperties: false".
// The model only returns wording. Month, figures, risk and alerts are always
// restored from backend data by the caller, so they are not part of this schema.
const INSIGHT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    insights: {
      type: "array",
      description:
        "Exactly one concise insight per input budget, in the same order as the input.",
      items: {
        type: "object",
        properties: {
          budgetId: {
            type: ["string", "integer", "null"],
            description:
              "The same identifier supplied for this budget in the input data. Internal use only; never mention it in any text.",
          },
          category: {
            type: "string",
            description:
              "The plain category name of this budget exactly as supplied (for example Food). No IDs, months, or extra words.",
          },
          riskLevel: {
            type: "string",
            enum: RISK_LEVELS,
            description:
              "Must be copied exactly from the riskLevel supplied in the input data for this budget. Never recalculated or changed.",
          },
          message: {
            type: "string",
            description:
              "A concise, non-judgmental 1-2 sentence description of this budget's status for its month, using only the supplied numbers. Never mention IDs. Monetary values must use the ₹ symbol, never $.",
          },
          recommendation: {
            type: "string",
            description:
              "A concise, practical 1-2 sentence recommendation derived only from the supplied remainingAmount and recommendedDailySpend. Monetary values must use the ₹ symbol, never $.",
          },
        },
        required: ["budgetId", "category", "riskLevel", "message", "recommendation"],
        additionalProperties: false,
      },
    },
    summary: {
      type: "string",
      description:
        "A concise 1-2 sentence overall summary across all budgets that does not repeat each budget's figures. Never mention IDs. Monetary values must use the ₹ symbol, never $.",
    },
  },
  required: ["insights", "summary"],
  additionalProperties: false,
};


const buildPrompt = (budgetData) => {
  const sanitizedPayload = budgetData.map((item) => ({
    budgetId: item.budgetId,
    category: item.category,
    month: item.month,
    monthLabel: item.monthLabel,
    monthStatus: item.monthStatus,
    spendingStatus: item.spendingStatus,
    projectionStatus: item.projectionStatus,
    budgetAmount: item.budgetAmount,
    actualSpending: item.actualSpending,
    remainingAmount: item.remainingAmount,
    percentageUsed: item.percentageUsed,
    dailyBurnRate: item.dailyBurnRate,
    projectedTotal: item.projectedTotal,
    projectedPercentage: item.projectedPercentage,
    projectedOverage: item.projectedOverage,
    daysRemaining: item.daysRemaining,
    recommendedDailySpend: item.recommendedDailySpend,
    riskLevel: item.riskLevel,
  }));


  const instructions = [
    "You are a budgeting assistant for a personal finance app.",
    "You will be given a JSON array of already-calculated budget figures for one user.",
    "Each item describes ONE budget for ONE month.",
    "",
    "STRICT RULES:",
    "- Do NOT change, recalculate, reinterpret, or invent any numerical value.",
    "- Quote only figures that appear in the input, as given (rounded to whole rupees if needed). Do not calculate totals, differences, averages, or new percentages.",
    "- Do NOT recalculate or change the supplied riskLevel. Copy it exactly as given for each budget.",
    "- Do NOT recalculate or change the supplied recommendedDailySpend. Use it only to phrase the recommendation text.",
    "- Use ONLY the numbers supplied in the input. Do not invent expenses, budgets, dates, percentages, or financial facts.",
    "- If a value is missing or null, leave it out instead of guessing.",
    "- All monetary values are in Indian Rupees. Always use the ₹ symbol (e.g. ₹500), never $ or any other currency symbol or code.",
    "",
    "NAMING RULES:",
    "- Refer to a budget by its plain category name and its monthLabel, for example \"Food budget for Oct 2026\".",
    "- Never mention budgetId, database IDs, \"budget 12\", or any internal identifier in any text. budgetId is only for matching: copy it unchanged into the budgetId field.",
    "- The category field must contain only the plain category name from the input (for example \"Food\"), with no IDs, months, or extra words.",
    "- Several budgets can share a category in different months. Always include the monthLabel when you describe a budget, and never mix up figures between budgets.",
    "",
    "STATUS RULES (spendingStatus, projectionStatus and monthStatus are authoritative):",
    "- OVER_BUDGET means spending has already passed the budget. Never describe it as within, under, or on track.",
    "- WITHIN_BUDGET and BUDGET_USED_UP mean spending has not passed the budget. Never say it was exceeded. Only if projectionStatus is PROJECTED_OVER_BUDGET may you say it is projected (not that it has) to exceed the budget.",
    "- monthStatus PAST means the month has ended: use past tense and give no forward-looking daily spending advice.",
    "- monthStatus FUTURE means the month has not started: do not describe any spending.",
    "- monthStatus CURRENT means the month is in progress.",
    "- Never make contradictory statements about being within budget and over budget.",
    "",
    "STYLE RULES:",
    "- Do NOT give investment, lending, tax, or other high-stakes financial advice.",
    "- Keep all output informational and budgeting-focused only.",
    "- Use practical, natural, professional, non-judgmental language. Never shame or lecture the user.",
    "- Avoid repetition: the message describes the situation, the recommendation gives one practical next step, and the summary gives a brief overall picture without repeating individual budget figures.",
    "- The riskLevel you return for each budget must exactly match the riskLevel supplied for that budget in the input (LOW, MEDIUM, or HIGH).",
    "- Keep each insight message concise (1-2 sentences), describing current spending status and projected status.",
    "- Keep each recommendation concise (1-2 sentences), giving a practical suggestion based only on remainingAmount and recommendedDailySpend.",
    "- Keep the overall summary concise (1-2 sentences).",
    "- Return exactly one insight per input item, in the same order as the input.",
    "- For each item in the input array, preserve its budgetId exactly as given (including if it is missing/null) in your corresponding insight.",
    "",
    "You MUST respond with ONLY valid JSON, no markdown formatting, no code fences, matching exactly this shape:",
    "{",
    '  "insights": [',
    '    { "budgetId": <same identifier as input>, "category": "<string>", "riskLevel": "<LOW|MEDIUM|HIGH, copied from input>", "message": "<string>", "recommendation": "<string>" }',
    "  ],",
    '  "summary": "<string>"',
    "}",
    "",
    "Input budget data:",
    JSON.stringify(sanitizedPayload),
  ];


  return instructions.join("\n");
};


/**
 * Reads the generated text from a Groq Chat Completions response:
 * choices[0].message.content
 */
const extractOutputTextFromCompletion = (completion) => {
  const choice = Array.isArray(completion?.choices)
    ? completion.choices[0]
    : null;


  if (choice?.finish_reason === "length") {
    throw new AIInsightServiceError(
      "AI provider response was cut off before it was complete.",
      "AI_MALFORMED_RESPONSE"
    );
  }


  const refusal = choice?.message?.refusal;


  if (typeof refusal === "string" && refusal.trim() !== "") {
    throw new AIInsightServiceError(
      "AI provider declined to generate a response.",
      "AI_EMPTY_RESPONSE"
    );
  }


  const outputText = choice?.message?.content;


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


// The identifier is only ever used by the caller to match an insight back to
// its budget, so anything that is not a string or number is treated as missing.
const normalizeBudgetIdValue = (budgetId) =>
  typeof budgetId === "string" || typeof budgetId === "number"
    ? budgetId
    : null;


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
      typeof insight.riskLevel === "string" &&
      RISK_LEVELS.includes(insight.riskLevel) &&
      typeof insight.message === "string" &&
      insight.message.trim() !== "" &&
      typeof insight.recommendation === "string" &&
      insight.recommendation.trim() !== ""
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
      budgetId: normalizeBudgetIdValue(insight.budgetId),
      category: insight.category.trim(),
      riskLevel: insight.riskLevel,
      message: insight.message.trim(),
      recommendation: insight.recommendation.trim(),
    })),
    summary: parsedResponse.summary.trim(),
  };
};


const wait = (delayMs) =>
  new Promise((resolve) => setTimeout(resolve, delayMs));


/**
 * Performs a single attempt at calling the Groq Chat Completions endpoint.
 *
 * The per-attempt timeout covers the WHOLE operation: connecting, receiving
 * response headers, and reading the full response body. The timer is only
 * cleared (in "finally") after the body has been consumed or the attempt has
 * failed, and the same AbortController signal is used for fetch() and for the
 * body read.
 *
 * Returns { ok, status, retryAfterHeader, body } where body is the parsed JSON
 * for successful responses. Does NOT retry — retry orchestration lives in
 * callGroqChatCompletionsApi.
 */
const performSingleGroqRequest = async (apiKey, requestBody) => {
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(
    () => abortController.abort(),
    REQUEST_TIMEOUT_MS
  );


  try {
    let response;


    try {
      response = await fetch(GROQ_CHAT_COMPLETIONS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });
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
    }


    let responseText;


    try {
      responseText = await response.text();
    } catch (bodyReadError) {
      if (!response.ok) {
        // The error body is not needed. Report the HTTP status instead.
        return {
          ok: false,
          status: response.status,
          retryAfterHeader: response.headers?.get?.("retry-after") ?? null,
          body: null,
        };
      }


      if (bodyReadError.name === "AbortError") {
        throw new AIInsightServiceError(
          "AI provider request timed out.",
          "AI_TIMEOUT"
        );
      }


      throw new AIInsightServiceError(
        "Failed to reach AI provider due to a network error.",
        "AI_NETWORK_ERROR"
      );
    }


    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        retryAfterHeader: response.headers?.get?.("retry-after") ?? null,
        body: null,
      };
    }


    let responseBody;


    try {
      responseBody = JSON.parse(responseText);
    } catch (jsonError) {
      throw new AIInsightServiceError(
        "AI provider response could not be parsed as JSON.",
        "AI_INVALID_JSON"
      );
    }


    return {
      ok: true,
      status: response.status,
      retryAfterHeader: null,
      body: responseBody,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
};


/**
 * Works out how long to wait before the next attempt.
 * 5xx: exponential backoff. 429: honour the Retry-After header (seconds) when
 * present, but never wait less than the normal backoff.
 */
const getRetryDelayMs = (status, retryAfterHeader, attemptNumber) => {
  const backoffDelayMs = RETRY_BASE_DELAY_MS * 2 ** (attemptNumber - 1);


  if (status !== 429) {
    return backoffDelayMs;
  }


  const retryAfterSeconds = Number(retryAfterHeader);


  if (
    retryAfterHeader === null ||
    retryAfterHeader === undefined ||
    String(retryAfterHeader).trim() === "" ||
    !Number.isFinite(retryAfterSeconds) ||
    retryAfterSeconds < 0
  ) {
    return backoffDelayMs;
  }


  return Math.max(retryAfterSeconds * 1000, backoffDelayMs);
};


/**
 * Calls the Groq Chat Completions API, retrying only on transient errors
 * (HTTP 429 and 5xx), with a short wait between attempts.
 *
 * Retry policy:
 *  - Up to 2 retries after the initial attempt (3 total attempts max).
 *  - Only HTTP 429 and 5xx status codes are retried.
 *  - If a 429 asks us to wait longer than MAX_RETRY_DELAY_MS (for example a
 *    daily quota), we do not retry and fail immediately.
 *  - Timeouts, network errors, and other 4xx statuses are NOT retried —
 *    they throw immediately with their controlled error codes.
 *  - REQUEST_TIMEOUT_MS applies to each attempt (headers + body), not to the
 *    whole retry sequence.
 */
const callGroqChatCompletionsApi = async (prompt) => {
  const apiKey = process.env.GROQ_API_KEY;


  if (!apiKey) {
    throw new AIInsightServiceError(
      "GROQ_API_KEY environment variable is not configured.",
      "AI_MISSING_API_KEY"
    );
  }


  const requestBody = {
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    reasoning_effort: "low",
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "budget_insights",
        strict: true,
        schema: INSIGHT_RESPONSE_SCHEMA,
      },
    },
  };


  const totalAttempts = MAX_RETRIES_AFTER_INITIAL_ATTEMPT + 1;
  let lastHttpErrorStatus = null;


  for (let attemptNumber = 1; attemptNumber <= totalAttempts; attemptNumber += 1) {
    // Timeouts/network errors are NOT retryable — they throw immediately
    // and propagate straight out of this function on any attempt.
    const result = await performSingleGroqRequest(apiKey, requestBody);


    if (result.ok) {
      return result.body;
    }


    lastHttpErrorStatus = result.status;


    const isRetryableError =
      result.status === 429 ||
      (result.status >= 500 && result.status <= 599);


    const isLastAttempt = attemptNumber === totalAttempts;


    const retryDelayMs = isRetryableError
      ? getRetryDelayMs(result.status, result.retryAfterHeader, attemptNumber)
      : 0;


    if (!isRetryableError || isLastAttempt || retryDelayMs > MAX_RETRY_DELAY_MS) {
      throw new AIInsightServiceError(
        `AI provider returned an error response (status ${result.status}).`,
        "AI_HTTP_ERROR"
      );
    }


    await wait(retryDelayMs);
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
 * The returned wording is NOT trusted for financial facts. Callers must match
 * each insight to its budget by budgetId and restore all figures, risk levels,
 * and alerts from their own calculations.
 *
 * @param {Array<Object>} budgetData - Array of pre-calculated budget/projection figures.
 *   Each item may include: budgetId, category, month, monthLabel, monthStatus,
 *   spendingStatus, projectionStatus, budgetAmount, actualSpending,
 *   remainingAmount, percentageUsed, dailyBurnRate, projectedTotal,
 *   projectedPercentage, projectedOverage, daysRemaining,
 *   recommendedDailySpend, riskLevel.
 * @returns {Promise<{ insights: Array<{ budgetId: any, category: string, riskLevel: string, message: string, recommendation: string }>, summary: string }>}
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


  const completion = await callGroqChatCompletionsApi(prompt);
  const outputText = extractOutputTextFromCompletion(completion);
  const parsedJson = parseModelJsonText(outputText);


  return validateInsightResponse(parsedJson);
};


module.exports = {
  generateBudgetInsights,
  AIInsightServiceError,
};
