import { createApp } from './app';
import { getEnv } from './config/env';

async function bootstrap() {
  const app = await createApp();
  const env = getEnv();
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Server running on http://0.0.0.0:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void bootstrap();
