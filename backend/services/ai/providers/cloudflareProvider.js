export class AiProviderError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Extract the generated text from Cloudflare Workers AI response data.
 *
 * Supported response shapes (tried in priority order):
 *   1. result.choices[0].message.content  — Chat Completions format (observed live)
 *   2. result.response                    — Legacy Workers AI text format
 *
 * reasoning / reasoning_content are intentionally ignored — they are internal
 * chain-of-thought outputs and must never be used as the user-facing summary.
 *
 * Returns: { text: string | null, finishReason: string | null }
 */
const extractResultText = (data) => {
  // 1. Choices-based Chat Completions format (primary — observed with qwen3-30b-a3b-fp8)
  const choices = data?.result?.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const choice = choices[0];
    const finishReason = choice?.finish_reason ?? null;
    // message.content is the user-visible generated text.
    // reasoning / reasoning_content are internal CoT and are explicitly excluded.
    const content = choice?.message?.content;
    const text =
      typeof content === "string" && content.trim() ? content.trim() : null;

    return { text, finishReason };
  }

  // 2. Legacy Workers AI response field
  const legacyText = data?.result?.response;
  if (typeof legacyText === "string" && legacyText.trim()) {
    return { text: legacyText.trim(), finishReason: null };
  }

  return { text: null, finishReason: null };
};

export const generateSummaryWithCloudflare = async ({
  systemPrompt,
  userPrompt,
  config,
}) => {
  if (!config.accountId || !config.apiToken) {
    throw new AiProviderError(
      503,
      "AI_PROVIDER_UNCONFIGURED",
      "AI summarization service is unconfigured."
    );
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${config.model}`;

  const payload = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    // 2048 tokens is sufficient headroom for the structured JSON output schema
    // (summary + decisions + actionItems + openQuestions), while remaining
    // comfortably within free-tier Workers AI limits.
    max_tokens: 2048,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AiProviderError(
          503,
          "AI_PROVIDER_AUTH_ERROR",
          "AI provider service authentication failed."
        );
      }

      if (response.status === 429) {
        throw new AiProviderError(
          503,
          "AI_PROVIDER_QUOTA_EXCEEDED",
          "AI provider rate limit or quota exceeded."
        );
      }

      throw new AiProviderError(
        502,
        "AI_PROVIDER_FAILED",
        "AI provider service is temporarily unavailable."
      );
    }

    const data = await response.json();
    const { text, finishReason } = extractResultText(data);

    // If generation was truncated by token limit and produced no usable content,
    // treat it as an incomplete generation error. Do not fall through or expose
    // reasoning text.
    if (!text && finishReason === "length") {
      throw new AiProviderError(
        502,
        "AI_PROVIDER_INCOMPLETE_GENERATION",
        "AI provider generation was truncated before completion."
      );
    }

    if (!text) {
      throw new AiProviderError(
        502,
        "AI_PROVIDER_MALFORMED_RESPONSE",
        "AI provider returned an empty or malformed response."
      );
    }

    return text;
  } catch (error) {
    if (error instanceof AiProviderError) {
      throw error;
    }

    if (error.name === "AbortError" || error.name === "TimeoutError") {
      throw new AiProviderError(
        504,
        "AI_PROVIDER_TIMEOUT",
        "AI provider request timed out."
      );
    }

    throw new AiProviderError(
      502,
      "AI_PROVIDER_UNAVAILABLE",
      "AI provider service is temporarily unavailable."
    );
  }
};
