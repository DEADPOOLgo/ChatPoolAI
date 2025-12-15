const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'storage.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure data file exists
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], threads: [] }, null, 2));
}

class JsonDataStore {
    read() {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            // Migration for old format if needed (simple check)
            if (!data.includes('"threads"')) {
                const oldData = JSON.parse(data);
                if (!oldData.threads) oldData.threads = [];
                return oldData;
            }
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading data store:', error);
            return { users: [], threads: [] };
        }
    }

    write(data) {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Error writing to data store:', error);
            return false;
        }
    }

    // User Methods
    addUser(user) {
        const data = this.read();
        data.users.push(user);
        this.write(data);
        return user;
    }

    findUserByEmail(email) {
        const data = this.read();
        return data.users.find(u => u.email === email);
    }

    findUserById(id) {
        const data = this.read();
        return data.users.find(u => u.id === id);
    }

    // Thread Methods
    createThread(thread) {
        const data = this.read();
        if (!data.threads) data.threads = []; // Safety
        data.threads.push(thread);
        this.write(data);
        return thread;
    }

    getThreadsByUserId(userId) {
        const data = this.read();
        return (data.threads || [])
            .filter(t => t.userId === userId)
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    getThreadById(threadId) {
        const data = this.read();
        return (data.threads || []).find(t => t.id === threadId);
    }

    updateThread(threadId, updates) {
        const data = this.read();
        const index = data.threads.findIndex(t => t.id === threadId);
        if (index !== -1) {
            data.threads[index] = { ...data.threads[index], ...updates };
            this.write(data);
            return data.threads[index];
        }
        return null;
    }

    addMessageToThread(threadId, message) {
        const data = this.read();
        const thread = data.threads.find(t => t.id === threadId);
        if (thread) {
            if (!thread.messages) thread.messages = [];
            thread.messages.push(message);
            thread.updatedAt = new Date().toISOString();
            this.write(data);
            return message;
        }
        return null;
    }
}

module.exports = new JsonDataStore();
