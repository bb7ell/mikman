/**
 * MikroTik Dashboard - Main Server
 * Handles HTTP requests and serves the web application
 */

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const iconv = require('iconv-lite');

// 🚀 RADICAL FIX: MikroTik library hardcodes 'win1252' which destroys Arabic bytes.
// We intercept this and force 'latin1' to preserve original bytes 1-to-1.
const originalDecode = iconv.decode;
iconv.decode = function(buf, encoding, options) {
  const targetEncoding = (encoding === 'win1252') ? 'latin1' : encoding;
  return originalDecode.call(iconv, buf, targetEncoding, options);
};

const authRoutes = require('./routes/auth');
const resourceRoutes = require('./routes/resources');
const healthRoutes = require('./routes/health');
const interfaceRoutes = require('./routes/interfaces');
const hotspotRoutes = require('./routes/hotspotUsers');
const userManagerRoutes = require('./routes/userManager');
const templatesRoutes = require('./routes/templates'); // Added
const printRoutes = require('./routes/print');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session management
app.use(session({
  secret: 'mikrotik-dashboard-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,        // set to true if using HTTPS
    httpOnly: true,
    maxAge: 30 * 60 * 1000 // 30 minutes
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/interfaces', interfaceRoutes);
app.use('/api/hotspot', hotspotRoutes);
app.use('/api/user-manager', userManagerRoutes);
app.use('/api/templates', templatesRoutes); 
app.use('/api/print', printRoutes);

console.log('✅ Hotspot routes registered at /api/hotspot');
console.log('✅ User Manager routes registered at /api/user-manager');
console.log('✅ Templates routes registered at /api/templates');
console.log('✅ Print engine registered at /api/print');

// ─── Page Routes ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/dashboard', (req, res) => {
  if (!req.session.connected) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// 📂 Native Directory Picker (Windows Only - Aggressive TopMost Version)
app.get('/api/utils/select-directory', (req, res) => {
    const { exec } = require('child_process');
    
    // This script creates a parent form, activates it, and forces the dialog to the absolute front
    const psCommand = `
        Add-Type -AssemblyName System.Windows.Forms;
        $f = New-Object System.Windows.Forms.FolderBrowserDialog;
        $f.Description = 'يرجى اختيار مجلد حفظ الكروت';
        $top = New-Object System.Windows.Forms.Form;
        $top.TopMost = $true;
        $top.Width = 1; $top.Height = 1; $top.Opacity = 0; $top.ShowInTaskbar = $false;
        $top.StartPosition = 'CenterScreen';
        $top.Show();
        $top.Activate();
        $res = $f.ShowDialog($top);
        if($res -eq 'OK'){ $f.SelectedPath } else { exit 1 }
        $top.Close();
    `.replace(/\n/g, ' ');

    console.log("📂 Opening Aggressive TopMost Picker...");
    exec(`powershell -WindowStyle Hidden -Command "${psCommand}"`, { windowsHide: true }, (err, stdout, stderr) => {
        if (err) {
            console.error("❌ Picker Error:", err);
            return res.json({ success: false, error: 'User cancelled or error' });
        }
        const path = stdout.trim();
        if (path) res.json({ success: true, path });
        else res.json({ success: false, error: 'No path selected' });
    });
});

// 📂 API: Open Local File Native (Bypass Browser Restriction)
app.post('/api/utils/open-file', (req, res) => {
    const { exec } = require('child_process');
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'No file path provided' });
    
    // Windows specifically uses 'start'
    const command = `start "" "${filePath}"`;
    exec(command, (err) => {
        if (err) {
            console.error("❌ Open File Error:", err);
            return res.json({ success: false, error: err.message });
        }
        res.json({ success: true });
    });
});

// 🚀 Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 MikroTik Dashboard running at http://localhost:${PORT}`);
  console.log(`📡 Waiting for router connections...\n`);

  // Start the persistent Global Tunnel
  try {
    const localtunnel = require('localtunnel');
    
    async function setupTunnel() {
      console.log('🔄 Initiating Enterprise Global Tunnel...');
      const tunnel = await localtunnel({ 
        port: PORT,
        subdomain: 'mikman-omar' // New Persistent URL to bypass zombie state
      });

      console.log(`\n===================================================`);
      console.log(`🌐 PERMANENT ONLINE LINK READY:`);
      console.log(`🔗 ${tunnel.url}`);
      console.log(`===================================================\n`);

      tunnel.on('close', () => {
        console.log('⚠️ Tunnel closed! Attempting to restart in 5 seconds...');
        setTimeout(setupTunnel, 5000);
      });

      tunnel.on('error', (err) => {
        console.error('❌ Tunnel Error:', err);
      });
    }

    await setupTunnel();
  } catch (err) {
    console.error('❌ Failed to start Global Tunnel:', err.message);
    console.log('⚠️ The dashboard is still accessible locally.');
  }
});
