import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const iconB64 = fs.readFileSync('google-play-assets/icon-512x512.png').toString('base64');

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
  
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    width: 1024px;
    height: 500px;
    overflow: hidden;
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #090d16;
    color: #f8fafc;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 60px;
  }

  /* Background ambient glow effects */
  .glow-1 {
    position: absolute;
    width: 600px;
    height: 600px;
    top: -200px;
    left: -150px;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, rgba(15, 23, 42, 0) 70%);
    pointer-events: none;
  }
  
  .glow-2 {
    position: absolute;
    width: 550px;
    height: 550px;
    bottom: -150px;
    right: 50px;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.16) 0%, rgba(15, 23, 42, 0) 70%);
    pointer-events: none;
  }

  .grid-pattern {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: radial-gradient(ellipse at center, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 80%);
    pointer-events: none;
  }

  /* Left column: Branding & Value */
  .brand-section {
    position: relative;
    z-index: 10;
    max-width: 500px;
  }

  .tag-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 9999px;
    background: rgba(59, 130, 246, 0.12);
    border: 1px solid rgba(96, 165, 250, 0.3);
    color: #93c5fd;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 18px;
  }

  .tag-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #38bdf8;
    box-shadow: 0 0 8px #38bdf8;
  }

  .app-title-wrap {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 14px;
  }

  .app-icon {
    width: 88px;
    height: 88px;
    border-radius: 22px;
    box-shadow: 0 12px 30px -4px rgba(0, 0, 0, 0.6),
                0 0 20px rgba(59, 130, 246, 0.3);
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    flex-shrink: 0;
  }

  .app-title {
    font-size: 42px;
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #ffffff 30%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .app-subtitle {
    font-size: 18px;
    line-height: 1.45;
    color: #94a3b8;
    font-weight: 400;
    margin-bottom: 24px;
  }

  .features-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 16px;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 14px;
    color: #e2e8f0;
    font-weight: 500;
  }

  .feature-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    font-size: 11px;
    color: #38bdf8;
  }

  /* Right column: Glassmorphic Mobile Card Preview */
  .preview-section {
    position: relative;
    z-index: 10;
    width: 370px;
    height: 380px;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7),
                0 0 35px rgba(56, 189, 248, 0.15);
    padding: 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 14px;
  }

  .preview-file {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .badge-readonly {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(14, 165, 233, 0.2);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }

  .preview-body {
    flex: 1;
    padding: 16px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .preview-h1 {
    font-size: 17px;
    font-weight: 700;
    color: #38bdf8;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .preview-text {
    font-size: 12px;
    line-height: 1.5;
    color: #94a3b8;
  }

  .preview-code {
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 10px 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #a5f3fc;
    line-height: 1.4;
  }

  .code-kw { color: #f472b6; }
  .code-fn { color: #60a5fa; }
  .code-str { color: #34d399; }

  .preview-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 11px;
    color: #64748b;
  }

  .footer-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #10b981;
    font-weight: 600;
  }
</style>
</head>
<body>
  <div class="glow-1"></div>
  <div class="glow-2"></div>
  <div class="grid-pattern"></div>

  <!-- Left: Brand info -->
  <div class="brand-section">
    <div class="tag-pill">
      <span class="tag-dot"></span>
      Lector Nativo · Ultra-Ligero
    </div>

    <div class="app-title-wrap">
      <img class="app-icon" src="data:image/png;base64,${iconB64}" alt="Icon">
      <div class="app-title">DBV Markdown<br>Reader</div>
    </div>

    <p class="app-subtitle">
      Visualiza tus documentos con apertura instantánea, diagramas Mermaid, fórmulas KaTeX y navegación fluida.
    </p>

    <div class="features-grid">
      <div class="feature-item">
        <span class="feature-icon">⚡</span>
        <span>Apertura instantánea (&lt;200 ms)</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">📁</span>
        <span>Storage Access Framework</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">💬</span>
        <span>Streaming directo WhatsApp</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">🔒</span>
        <span>100% Seguro y sin anuncios</span>
      </div>
    </div>
  </div>

  <!-- Right: Glassmorphic App Preview Card -->
  <div class="preview-section">
    <div class="preview-header">
      <div class="preview-file">
        <span>📄</span>
        <span>especificacion.md</span>
      </div>
      <span class="badge-readonly">LECTURA</span>
    </div>

    <div class="preview-body">
      <div class="preview-h1">
        <span>#</span> Arquitectura del Sistema
      </div>
      <p class="preview-text">
        Renderizado seguro con sanitización <strong>DOMPurify</strong> y soporte completo de <strong>GitHub Flavored Markdown</strong>.
      </p>
      <div class="preview-code">
        <span class="code-kw">fn</span> <span class="code-fn">render_markdown</span>(input: &amp;<span class="code-str">str</span>) -&gt; <span class="code-fn">Html</span> {<br>
        &nbsp;&nbsp;<span class="code-kw">let</span> doc = <span class="code-fn">parse</span>(input);<br>
        &nbsp;&nbsp;doc.<span class="code-fn">render_instant</span>()<br>
        }
      </div>
    </div>

    <div class="preview-footer">
      <span>Modo Claro · Oscuro · Sepia</span>
      <span class="footer-badge">✓ Verificado</span>
    </div>
  </div>
</body>
</html>`;

const tempHtml = path.join(os.tmpdir(), 'feature_graphic_preview.html');
const tempDir = path.join(os.tmpdir(), 'edge_render_feature');
const outPng = path.resolve('google-play-assets/feature-graphic-1024x500.png');

fs.writeFileSync(tempHtml, htmlContent, 'utf-8');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

console.log('Rendering 1024x500 Feature Graphic with Edge...');
execFileSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new',
  `--user-data-dir=${tempDir}`,
  '--window-size=1024,500',
  `--screenshot=${outPng}`,
  tempHtml
]);

console.log('Feature Graphic generated successfully at:', outPng);
