export interface AppConfig {
  port: number;
  nodeEnv: string;
  mongodbUri: string;
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  refreshCookieName: string;
  bcryptSaltRounds: number;
  corsOrigin: string;
  defaultUserPassword: string;
  seed: {
    ownerUsername: string;
    ownerEmail: string;
    ownerPassword: string;
    demoData: boolean;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongodbUri: process.env.MONGODB_URI ?? '',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? 'meena_refresh',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  defaultUserPassword: process.env.DEFAULT_USER_PASSWORD ?? 'Meena1234!',
  seed: {
    ownerUsername: process.env.SEED_OWNER_USERNAME ?? 'owner',
    ownerEmail: process.env.SEED_OWNER_EMAIL ?? 'owner@meenaplatoo.local',
    ownerPassword: process.env.SEED_OWNER_PASSWORD ?? 'ChangeMe123!',
    demoData: process.env.SEED_DEMO_DATA === 'true',
  },
});
