const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
// Set a high payload limit as we process images in base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// DB Setup
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database opening error: ', err);
});

// Init Tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        data TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS blogs (
        id INTEGER PRIMARY KEY,
        data TEXT NOT NULL
    )`);
});

/* ─── USERS API ──────────────────────────────────────────────────────────── */

app.get('/api/users', (req, res) => {
    db.all('SELECT data FROM users', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => JSON.parse(r.data)));
    });
});

app.get('/api/users/:username', (req, res) => {
    const { username } = req.params;
    db.get('SELECT data FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row ? JSON.parse(row.data) : null);
    });
});

app.post('/api/users', (req, res) => {
    const user = req.body;
    db.run('INSERT OR REPLACE INTO users (username, data) VALUES (?, ?)', 
        [user.username, JSON.stringify(user)], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/users/bulk', (req, res) => {
    const users = req.body;
    db.serialize(() => {
        const stmt = db.prepare('INSERT OR REPLACE INTO users (username, data) VALUES (?, ?)');
        for (let u of users) {
            stmt.run(u.username, JSON.stringify(u));
        }
        stmt.finalize();
        res.json({ success: true });
    });
});

/* ─── BLOGS API ──────────────────────────────────────────────────────────── */

app.get('/api/blogs', (req, res) => {
    db.all('SELECT data FROM blogs', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => JSON.parse(r.data)));
    });
});

app.post('/api/blogs', (req, res) => {
    const blog = req.body;
    db.run('INSERT OR REPLACE INTO blogs (id, data) VALUES (?, ?)', 
        [blog.id, JSON.stringify(blog)], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/blogs/bulk', (req, res) => {
    const blogs = req.body;
    db.serialize(() => {
        db.run('DELETE FROM blogs', (err) => {
            if (err) return res.status(500).json({ error: err.message });
            const stmt = db.prepare('INSERT OR REPLACE INTO blogs (id, data) VALUES (?, ?)');
            for (let b of blogs) {
                stmt.run(b.id, JSON.stringify(b));
            }
            stmt.finalize();
            res.json({ success: true });
        });
    });
});

app.delete('/api/blogs/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM blogs WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Start
app.listen(PORT, () => {
    console.log(`✅ Hearts of Minecraft API Server running on http://localhost:${PORT}`);
});
