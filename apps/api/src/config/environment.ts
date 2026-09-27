export interface AppEnvironment {
  DATABASE_URL: string;
  JWT_SECRET: string;
  API_PORT: number;
  WEB_ORIGIN: string;
  COOKIE_SECURE: boolean;
  AI_BASE_URL: string;
  AI_API_KEY: string;
  AI_MODEL: string;
}

export function validateEnvironment(input: Record<string, unknown>): AppEnvironment {
  const databaseUrl = String(input.DATABASE_URL ?? '');
  const jwtSecret = String(input.JWT_SECRET ?? '');
  const webOrigin = String(input.WEB_ORIGIN ?? 'http://localhost:3000');

  if (!databaseUrl.startsWith('mysql://')) {
    throw new Error('DATABASE_URL must be a MySQL connection URL');
  }
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }

  return {
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    API_PORT: Number(input.API_PORT ?? 3001),
    WEB_ORIGIN: webOrigin,
    COOKIE_SECURE: String(input.COOKIE_SECURE ?? 'false') === 'true',
    AI_BASE_URL: String(input.AI_BASE_URL ?? 'https://api.openai.com/v1'),
    AI_API_KEY: String(input.AI_API_KEY ?? ''),
    AI_MODEL: String(input.AI_MODEL ?? ''),
  };
}
