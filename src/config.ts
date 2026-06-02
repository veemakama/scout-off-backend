import dotenv from 'dotenv';
dotenv.config();

const VALID_NODE_ENVS = ['development', 'staging', 'production', 'test'] as const;
export type NodeEnv = typeof VALID_NODE_ENVS[number];

const rawNodeEnv = process.env.NODE_ENV ?? 'development';
if (!(VALID_NODE_ENVS as readonly string[]).includes(rawNodeEnv)) {
  throw new Error(`Invalid NODE_ENV="${rawNodeEnv}". Must be one of: ${VALID_NODE_ENVS.join(', ')}`);
}
export const nodeEnv = rawNodeEnv as NodeEnv;

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

/** Returns true in production or staging environments. */
export function isProduction(): boolean {
  return nodeEnv === 'production';
}

export function isStaging(): boolean {
  return nodeEnv === 'staging';
}

export function isDevelopment(): boolean {
  return nodeEnv === 'development' || nodeEnv === 'test';
}

/** Env-specific defaults */
const envDefaults: Record<NodeEnv, { logLevel: string; showErrorDetails: boolean; useMockServices: boolean }> = {
  development: { logLevel: 'debug', showErrorDetails: true,  useMockServices: true  },
  test:        { logLevel: 'warn',  showErrorDetails: true,  useMockServices: true  },
  staging:     { logLevel: 'info',  showErrorDetails: false, useMockServices: false },
  production:  { logLevel: 'warn',  showErrorDetails: false, useMockServices: false },
};

const defaults = envDefaults[nodeEnv];

const config = {
  nodeEnv,
  port: parseInt(process.env.PORT ?? '4000', 10),
  network: (process.env.NETWORK ?? 'testnet') as 'testnet' | 'mainnet',
  networkPassphrase:
    process.env.NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015',
  horizonUrl:
    process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl:
    process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  contractId: required('CONTRACT_ID'),
  jwtSecret: required('JWT_SECRET'),
  pinata: {
    apiKey: process.env.PINATA_API_KEY ?? '',
    secret: process.env.PINATA_SECRET ?? '',
    gateway: process.env.PINATA_GATEWAY ?? 'https://gateway.pinata.cloud',
  },
  platformFeeBps: parseInt(process.env.PLATFORM_FEE_BPS ?? '500', 10),
  dbPath: process.env.DB_PATH ?? 'scout-off.db',
  logLevel: (process.env.LOG_LEVEL ?? defaults.logLevel) as 'debug' | 'info' | 'warn' | 'error',
  /** Whether to include stack traces and internal details in error responses. */
  showErrorDetails: defaults.showErrorDetails,
  /** Whether to use mock/stub service implementations (dev + test only). */
  useMockServices: defaults.useMockServices,
  stellarHealthCheckEnabled: process.env.STELLAR_HEALTH_CHECK !== 'false',
  adminWallet: process.env.ADMIN_WALLET ?? '',
  securityHeaders: {
    hsts: process.env.SECURITY_HSTS ?? 'max-age=31536000; includeSubDomains',
    xContentTypeOptions: process.env.SECURITY_X_CONTENT_TYPE_OPTIONS ?? 'nosniff',
    xFrameOptions: process.env.SECURITY_X_FRAME_OPTIONS ?? 'DENY',
    referrerPolicy: process.env.SECURITY_REFERRER_POLICY ?? 'no-referrer',
  },
  webhook: {
    enabled: process.env.WEBHOOK_ENABLED === 'true',
    url: process.env.WEBHOOK_URL ?? '',
  },
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '60', 10),
  },
};

export default config;
