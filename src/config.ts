import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

const config = {
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
  platformSecret: process.env.PLATFORM_SECRET ?? '',
  dbPath: process.env.DB_PATH ?? 'scout-off.db',
};

export default config;
