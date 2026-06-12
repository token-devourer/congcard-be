import "dotenv/config";

function numberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function originsEnv(): string[] {
  const value = process.env.CORS_ORIGINS ?? "http://localhost:3000";
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: numberEnv("PORT", 2567),
  corsOrigins: originsEnv(),
  maxRooms: numberEnv("MAX_ROOMS", 100),
  turnTimeoutDefault: numberEnv("TURN_TIMEOUT_DEFAULT", 30),
  reconnectGraceSec: numberEnv("RECONNECT_GRACE_SEC", 60),
  logLevel: process.env.LOG_LEVEL ?? "info"
};
