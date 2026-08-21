export class AiProviderError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

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
    max_tokens: 1024,
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

    // Cloudflare Workers AI standard response shape: { result: { response: "..." } }
    const resultText =
      data?.result?.response ||
      data?.result ||
      data?.response ||
      "";

    if (typeof resultText !== "string" || !resultText.trim()) {
      throw new AiProviderError(
        502,
        "AI_PROVIDER_MALFORMED_RESPONSE",
        "AI provider returned an empty or malformed response."
      );
    }

    return resultText.trim();
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
