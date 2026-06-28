import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import { connectDB } from './config/db.js';
import deviceRoutes from './routes/deviceRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Shared middleware for browser requests and JSON API bodies.
app.use(cors());
app.use(express.json());

// Public auth endpoints are mounted before protected device routes.
app.use('/auth', authRoutes);

// Serve the dashboard and static assets from the project root.
app.use('/static', express.static(path.join(__dirname, '../static')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../templates/index.html'));
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
        await connectDB();
        app.listen(port, () => {
            console.log(`Node.js server running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

startServer();
