const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, 'mikman.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database', err.message);
    } else {
        console.log('✅ Connected to SQLite database.');

        db.serialize(() => {
            // Saved routers
            db.run(`CREATE TABLE IF NOT EXISTS saved_routers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT NOT NULL,
                password TEXT
            )`);

            // Card Print Templates — full schema
            db.run(`CREATE TABLE IF NOT EXISTS card_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                profile_name TEXT,
                bg_image TEXT,
                pdf_save_path TEXT,
                text_x REAL DEFAULT 50,
                text_y REAL DEFAULT 50,
                pass_x REAL DEFAULT 50,
                pass_y REAL DEFAULT 65,
                show_pass BOOLEAN DEFAULT 1,
                font_family TEXT DEFAULT 'Helvetica',
                font_size INTEGER DEFAULT 24,
                font_color TEXT DEFAULT '#000000',
                font_bold BOOLEAN DEFAULT 0,
                font_italic BOOLEAN DEFAULT 0,
                letter_spacing INTEGER DEFAULT 0,
                stroke_color TEXT DEFAULT '#ffffff',
                stroke_width INTEGER DEFAULT 0,
                group_spacing_every INTEGER DEFAULT 0,
                group_spacing_size INTEGER DEFAULT 1,
                columns INTEGER DEFAULT 3
            )`);

            // ALTER TABLE: add missing columns if upgrading an existing DB
            const alterCols = [
                "ALTER TABLE card_templates ADD COLUMN group_spacing_every INTEGER DEFAULT 0",
                "ALTER TABLE card_templates ADD COLUMN group_spacing_size INTEGER DEFAULT 1",
                "ALTER TABLE card_templates ADD COLUMN columns INTEGER DEFAULT 3",
                "ALTER TABLE card_templates ADD COLUMN border_width INTEGER DEFAULT 0",
                "ALTER TABLE card_templates ADD COLUMN border_color TEXT DEFAULT '#000000'",
                "ALTER TABLE card_templates ADD COLUMN card_padding INTEGER DEFAULT 0",
                "ALTER TABLE card_templates ADD COLUMN pass_x REAL DEFAULT 50",
                "ALTER TABLE card_templates ADD COLUMN pass_y REAL DEFAULT 65",
                "ALTER TABLE card_templates ADD COLUMN show_pass BOOLEAN DEFAULT 1"
            ];
            alterCols.forEach(sql => {
                db.run(sql, [], (err) => {
                    // Ignore "duplicate column" error — it means column already exists
                    if (err && !err.message.includes('duplicate column')) {
                        console.error('DB alter error:', err.message);
                    }
                });
            });
        });
    }
});

module.exports = db;
