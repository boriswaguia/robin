import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './routes/auth.js';
import { mailRouter } from './routes/mail.js';
import { ensureDirs } from './services/storage.js';
import { apiLimiter } from './middleware/rateLimiter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// Ensure uploads directory exists
ensureDirs();

// ── Security headers ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      frameSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // allow image previews
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  ...(process.env.CLIENT_ORIGIN ? [process.env.CLIENT_ORIGIN] : []),
  'http://localhost:5173',
  'http://localhost:80',
  'http://localhost',
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true, // required for cookies
}));

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// ── General rate limit ────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ── Static: uploaded images ──────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/mail', mailRouter);

// In production, serve the React build
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Robin server running on http://localhost:${PORT}`);
});
