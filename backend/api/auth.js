const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../lib/db');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_change_me';

// Signup Route
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const existingUser = db.findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: uuidv4(),
            email,
            name: name || email.split('@')[0],
            password: hashedPassword,
            createdAt: new Date().toISOString()
        };

        db.addUser(newUser);

        // Auto login after signup
        const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(201).json({ message: 'User created successfully', user: { id: newUser.id, email: newUser.email, name: newUser.name } });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login Route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = db.findUserByEmail(email);
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ message: 'Login successful', user: { id: user.id, email: user.email, name: user.name } });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout Route
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

// Status Route
router.get('/status', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ isAuthenticated: false });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.findUserById(decoded.id);
        if (!user) return res.status(401).json({ isAuthenticated: false });

        res.json({ isAuthenticated: true, user: { id: user.id, email: user.email, name: user.name } });
    } catch (e) {
        res.status(401).json({ isAuthenticated: false });
    }
});

module.exports = router;
