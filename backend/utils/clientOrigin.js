const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isAllowedClientOrigin(
  origin,
  clientUrl = process.env.CLIENT_URL,
  nodeEnv = process.env.NODE_ENV,
) {
  if (!origin || origin === clientUrl) return true;
  if (nodeEnv === "production" || !clientUrl) return false;

  try {
    const requested = new URL(origin);
    const configured = new URL(clientUrl);

    // Development hosts are interchangeable only on the configured port and
    // protocol. Never extend this to other hosts, LAN addresses, or production.
    return (
      requested.origin === origin &&
      configured.origin === clientUrl &&
      LOOPBACK_HOSTS.has(requested.hostname) &&
      LOOPBACK_HOSTS.has(configured.hostname) &&
      requested.protocol === configured.protocol &&
      requested.port === configured.port
    );
  } catch {
    return false;
  }
}

export function clientOrigin(origin, callback) {
  if (isAllowedClientOrigin(origin)) {
    callback(null, true);
  } else {
    callback(new Error("Not allowed by CORS"));
  }
}
