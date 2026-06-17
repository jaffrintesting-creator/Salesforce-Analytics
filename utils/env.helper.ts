import dotenv from 'dotenv';
import path from 'path';

// Load .env.qa from ENV folder || Environment variable ENV_FILE during execution
const envFile = process.env.ENV_FILE || '.env.qa';

dotenv.config({
  path: path.resolve(process.cwd(), 'ENV', envFile),
});

export const env = {
  baseUrl: process.env.BASE_URL,
  username: process.env.APP_USERNAME,
  password: process.env.APP_PASSWORD,
};