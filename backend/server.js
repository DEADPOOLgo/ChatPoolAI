const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
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

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
