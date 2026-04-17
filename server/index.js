import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import authRouter from './auth.js';
import recordsRouter from './records.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/records', recordsRouter);

app.use(express.static(PROJECT_ROOT, { extensions: ['html'] }));

app.use((err, req, res, _next) => {
  const status = err?.status || 500;
  if (status >= 500) console.error('[server-error]', err);
  res.status(status).json({ error: err?.message || '伺服器錯誤' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
