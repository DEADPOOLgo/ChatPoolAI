const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http'); // Import http
const { setupWebSocket } = require('./lib/socket'); // Import socket setup
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7320;

const authRoutes = require('./api/auth');
const chatRoutes = require('./api/chat');

// Middleware
app.use(cors({
    origin: 'http://localhost:7321', // Allow frontend
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Basic Route
app.get('/', (req, res) => {
    res.json({ message: 'Backend is running on port ' + PORT });
});

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket
setupWebSocket(server);

// Start Server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
