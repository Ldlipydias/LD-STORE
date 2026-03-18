import serverless from 'serverless-http';
import app, { startServer } from '../../server';

// Ensure server is initialized (Vite middleware etc)
let cachedHandler: any;

export const handler = async (event: any, context: any) => {
  if (!cachedHandler) {
    await startServer();
    cachedHandler = serverless(app);
  }
  return cachedHandler(event, context);
};
