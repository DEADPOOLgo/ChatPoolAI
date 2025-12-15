const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Mock LLM or Real Call
async function callLLM(message, history) {
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = 'gemini-2.5-flash'; // Standard model

    // Simple text-only system prompt simulation 
    // (Gemini REST API doesn't strictly support 'system' role in all versions, but we can prepend context)
    const context = "You are a helpful AI assistant.";

    if (!apiKey) {
        return `[MOCK RESPONSE] You said: "${message}". Set GEMINI_API_KEY for real AI.`;
    }

    try {
        const contents = [
            { role: 'user', parts: [{ text: context }] }, // Implicit context if needed, or just skip
            ...history.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            })),
            { role: 'user', parts: [{ text: message }] }
        ];

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        const data = await response.json();

        if (data.error) {
            console.error("LLM Error", data.error);
            return `Error from AI Provider: ${data.error.message}`;
        }

        return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response text found.";

    } catch (error) {
        console.error("LLM Call Failed", error);
        return "Sorry, I couldn't reach the AI service.";
    }
}

// Get All Threads (Sidebar)
router.get('/threads', authenticateToken, (req, res) => {
    // Return only metadata, not all messages to save bandwidth
    const threads = db.getThreadsByUserId(req.user.id).map(t => ({
        id: t.id,
        title: t.title,
        updatedAt: t.updatedAt
    }));
    res.json(threads);
});

// Get Messages for a Thread
router.get('/threads/:threadId', authenticateToken, (req, res) => {
    const thread = db.getThreadById(req.params.threadId);
    if (!thread || thread.userId !== req.user.id) {
        return res.status(404).json({ error: "Thread not found" });
    }
    res.json(thread.messages || []);
});

// Send Message (Create Thread if needed)
router.post('/message', authenticateToken, async (req, res) => {
    let { message, threadId } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    let thread;
    let isNewThread = false;

    // 1. Get or Create Thread
    if (threadId) {
        thread = db.getThreadById(threadId);
        if (!thread || thread.userId !== req.user.id) {
            return res.status(404).json({ error: "Thread not found" });
        }
    } else {
        isNewThread = true;
        thread = {
            id: uuidv4(),
            userId: req.user.id,
            title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: []
        };
        db.createThread(thread);
        threadId = thread.id;
    }

    // 2. Prepare History for Context (Last 10 messages)
    const history = (thread.messages || []).slice(-10).map(m => ({ role: m.role, text: m.text }));

    // 3. Save User Message
    const userMsg = {
        id: uuidv4(),
        role: 'user',
        text: message,
        timestamp: new Date().toISOString()
    };
    db.addMessageToThread(threadId, userMsg);

    // 4. Get AI Response
    const aiText = await callLLM(message, history);

    // 5. Save AI Response
    const aiMsg = {
        id: uuidv4(),
        role: 'assistant',
        text: aiText,
        timestamp: new Date().toISOString()
    };
    db.addMessageToThread(threadId, aiMsg);

    // 6. Return response
    res.json({
        threadId,
        userMessage: userMsg,
        botMessage: aiMsg,
        newThread: isNewThread ? { id: thread.id, title: thread.title, updatedAt: thread.updatedAt } : null
    });
});

module.exports = router;
