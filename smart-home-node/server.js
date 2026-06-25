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
app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);
// --- NETWORK DEBUGGER: Prints exactly what the frontend is asking for ---
app.use((req, res, next) => {
    console.log(`📞 [NETWORK] ${req.method} request to: ${req.url}`);
    next();
});

// --- SERVE FRONTEND ---
app.use('/static', express.static(path.join(__dirname, '../static')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../templates/index.html'));
});

// --- THE PERMANENT ROUTER CONNECTION ---
app.use('/devices', deviceRoutes);

// --- STARTUP ---
async function startServer() {
    try {
        await connectDB();
        app.listen(port, () => {
            console.log(`🚀 Node.js Server running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
}

startServer();