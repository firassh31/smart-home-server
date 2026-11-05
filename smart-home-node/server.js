import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import { connectDB } from './config/db.js';
import deviceRoutes from './routes/deviceRoutes.js';
import { ensureAuthIndexes } from './models/authModels.js';

const __filename = fileURLToPath(import.meta.url);


const app = express();
const port = process.env.PORT;

// Render terminates TLS at its proxy; trust it so req.ip is the real client.
app.set('trust proxy', 1);

// Shared middleware for browser requests and JSON API bodies.
app.use(cors());
app.use(express.json());

// Brute-force protection: per-IP cap on login/register/OTP attempts.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts from this device. Try again in 15 minutes.' },
});

// Public auth endpoints are mounted before protected device routes.
app.use('/auth', authLimiter, authRoutes);

app.get('/', (req, res) => {
    res.status(200).send('MSHome API is live and running!');
});

// Device endpoints enforce JWT and role checks inside the router.
app.use('/devices', deviceRoutes);

// Weather proxy keeps the OpenWeatherMap API key on the server.
app.get('/api/weather', async (req, res) => {
    try {
        const { lat, lon, city } = req.query;
        const apiKey = process.env.WEATHER_API_KEY;
        const url = lat && lon
            ? `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
            : `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`;

        const response = await fetch(url);
        const result = await response.json();

        if (!response.ok) {
            console.error("OpenWeatherMap API rejected the request:", result);
            return res.status(response.status).json(result);
        }

        res.status(200).json(result);
    } catch (error) {
        console.error("Server-side weather fetch error:", error.message);
        res.status(500).json({ error: "Could not fetch weather data" });
    }
});

// Connect to MongoDB before accepting HTTP traffic.
async function startServer() {
    try {
        const db = await connectDB();
        // Unique phone index and the OTP TTL index must exist before traffic.
        await ensureAuthIndexes(db);
        app.listen(port, () => {
            console.log(`Node.js server running`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

startServer();
