const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── Upload Setup ──────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../../public/uploads/templates');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, 'card_' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ── All template columns (for DRY SQL) ────────────────────────────────────
const TPL_FIELDS = [
    'name', 'profile_name', 'bg_image', 'pdf_save_path',
    'text_x', 'text_y', 'pass_x', 'pass_y', 'show_pass',
    'font_family', 'font_size',
    'font_color', 'font_bold', 'font_italic', 'letter_spacing',
    'stroke_color', 'stroke_width',
    'border_color', 'border_width', 'card_padding',
    'group_spacing_every', 'group_spacing_size', 'columns'
];

function extractFields(body) {
    return {
        name: body.name || '',
        profile_name: body.profile_name || '',
        bg_image: body.bg_image || '',
        pdf_save_path: body.pdf_save_path || '',
        text_x: parseFloat(body.text_x) || 50,
        text_y: parseFloat(body.text_y) || 50,
        pass_x: parseFloat(body.pass_x) || 50,
        pass_y: parseFloat(body.pass_y) || 65,
        show_pass: body.show_pass === undefined ? 1 : (body.show_pass ? 1 : 0),
        font_family: body.font_family || 'Helvetica',
        font_size: parseInt(body.font_size) || 24,
        font_color: body.font_color || '#000000',
        font_bold: body.font_bold ? 1 : 0,
        font_italic: body.font_italic ? 1 : 0,
        letter_spacing: parseInt(body.letter_spacing) || 0,
        stroke_color: body.stroke_color || '#ffffff',
        stroke_width: parseInt(body.stroke_width) || 0,
        border_color: body.border_color || '#000000',
        border_width: parseInt(body.border_width) || 0,
        card_padding: parseInt(body.card_padding) || 0,
        group_spacing_every: parseInt(body.group_spacing_every) || 0,
        group_spacing_size: parseInt(body.group_spacing_size) || 1,
        columns: parseInt(body.columns) || 3
    };
}

// ── POST /api/templates/upload ──────────────────────────────────────────
router.post('/upload', upload.single('bg_image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No image uploaded' });
    res.json({ success: true, path: '/uploads/templates/' + req.file.filename });
});

// ── GET /api/templates ──────────────────────────────────────────────────
router.get('/', (req, res) => {
    db.all('SELECT * FROM card_templates ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        // Parse boolean fields
        const templates = rows.map(r => ({
            ...r,
            font_bold: !!r.font_bold,
            font_italic: !!r.font_italic,
            show_pass: !!r.show_pass
        }));
        res.json({ success: true, templates });
    });
});

// ── POST /api/templates (Create or Update) ──────────────────────────────
router.post('/', (req, res) => {
    const { id } = req.body;
    const fields = extractFields(req.body);

    if (!fields.name) return res.status(400).json({ success: false, error: 'Template name is required' });

    if (id) {
        // UPDATE
        const sets = TPL_FIELDS.map(f => `${f}=?`).join(', ');
        const vals = TPL_FIELDS.map(f => fields[f]);
        vals.push(id);
        db.run(`UPDATE card_templates SET ${sets} WHERE id=?`, vals, function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, id: parseInt(id) });
        });
    } else {
        // INSERT
        const cols = TPL_FIELDS.join(', ');
        const placeholders = TPL_FIELDS.map(() => '?').join(', ');
        const vals = TPL_FIELDS.map(f => fields[f]);
        db.run(`INSERT INTO card_templates (${cols}) VALUES (${placeholders})`, vals, function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, id: this.lastID });
        });
    }
});

// ── DELETE /api/templates/:id ───────────────────────────────────────────
router.delete('/:id', (req, res) => {
    db.run('DELETE FROM card_templates WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (this.changes === 0) return res.status(404).json({ success: false, error: 'Template not found' });
        res.json({ success: true });
    });
});

// ── GET /api/templates/by-profile/:profileName ─────────────────────────
router.get('/by-profile/:profileName', (req, res) => {
    db.get('SELECT * FROM card_templates WHERE profile_name = ? LIMIT 1', [req.params.profileName], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!row) return res.json({ success: false, template: null });
        res.json({
            success: true,
            template: { ...row, font_bold: !!row.font_bold, font_italic: !!row.font_italic }
        });
    });
});

module.exports = router;
