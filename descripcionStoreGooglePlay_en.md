# Google Play Store Listing — English (United States)

> Copy each field directly into the corresponding section of Google Play Console ("Main store listing" and "Production / Testing release").

---

## 🏷️ Main App Details

### App name *
*(maximum 30 characters)*

```text
DBV Markdown Reader
```

---

### Short description *
*(maximum 80 characters — exactly 79 characters)*

```text
Fast, lightweight Markdown reader with Mermaid diagrams and KaTeX math support.
```

---

### Full description *
*(maximum 4000 characters — structured and optimized for Android)*

```text
DBV Markdown Reader is an ultra-lightweight, secure, and fast native Markdown (.md) reader designed to deliver a smooth reading experience on Android phones and tablets.

Built for developers, students, researchers, and note-taking enthusiasts who need to browse technical documentation, study notes, or personal wikis instantly, with zero ads and complete privacy.

⚡ NATIVE PERFORMANCE & TOTAL PRIVACY
• Instant Launch: opens documents in less than 200 ms.
• 100% Offline: all rendering and file processing happens locally on your device. Your notes never leave your phone.
• No Ads, No Trackers: no accounts required, no invasive permissions.

📁 SEAMLESS ANDROID INTEGRATION (STORAGE ACCESS FRAMEWORK)
• 1-Tap Quick Open: open and read any .md file immediately.
• Full Folder Explorer: grant access to your notes folder and browse subdirectories with ease.
• Local Relative Images: displays images referenced inside your documentation folders.
• Cross-Document Links: jump between linked Markdown files using relative paths.
• Open from WhatsApp, Telegram, or Gmail: view Markdown files shared directly from chat apps via in-memory streaming without duplicate downloads.

📊 RICH MARKDOWN SUPPORT (GFM)
• Embedded Mermaid Diagrams: render flowcharts, sequence diagrams, and architecture graphs in crisp vector format.
• Mathematical Formulas with KaTeX: fast and clean rendering of complex equations.
• Syntax Highlighting: code blocks for 20+ programming languages with line numbers.
• GitHub-style Callout Alerts: highlighted blocks for [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], and [!CAUTION].
• Tables, task lists, and blockquotes.

🎨 TAILORED MOBILE EXPERIENCE
• 3 Reading Themes: Light, Dark, and Sepia tailored for reading comfort.
• Interactive Table of Contents (TOC): jump across sections via the slide-over index drawer.
• Recent Files History: quickly reopen recently viewed documents.
• Floating Settings Menu (⚙️): instant theme switcher, language selector (Spanish / English), and clean app exit.
• Full Display Insets Respect: perfectly aligned with modern status bars, notches, and navigation bars.

DBV Markdown Reader is open-source software licensed under MIT and built with the dbv-specs-ops framework.
```

---

## 📢 Release Notes
*(Copy and paste directly into the release notes box in Google Play Console)*

```xml
<en-US>
Official launch of DBV Markdown Reader for Android (v0.15.0)!
• Ultra-fast, lightweight native reader for Markdown (.md) files.
• Full Storage Access Framework (SAF) integration: 1-tap open and folder browsing with relative images.
• Integrated Mermaid vector diagrams and KaTeX math formulas.
• Open shared notes directly from WhatsApp, Telegram, and Gmail.
• Light, Dark, and Sepia reading themes with Table of Contents (TOC).
• 100% private, offline, and ad-free.
</en-US>
```

---

## 🎨 Graphic Assets Ready to Upload

All files are pre-generated in the `google-play-assets/` directory matching Google Play technical specs:

### 1. App icon
* **Path:** `google-play-assets/icon-512x512.png`
* **Specs:** 512 x 512 px · 32-bit PNG · 26 KB.

### 2. Feature graphic
* **Path:** `google-play-assets/feature-graphic-1024x500.png`
* **Specs:** 1024 x 500 px · 24-bit PNG · 204 KB.

### 3. Phone screenshots (upload all 6)
Folder: `google-play-assets/phone-screenshots/` (1080 x 2400 px):
1. `01_document_reading.png` — Document reading view.
2. `02_mermaid_diagram.png` — Vector flowchart with Mermaid.
3. `03_settings_menu.png` — Floating settings menu (themes and language).
4. `04_toc_navigation.png` — Slide-over Table of Contents drawer.
5. `05_recent_files.png` — Persistent recent files panel.
6. `06_code_and_syntax.png` — Syntax-highlighted code block with line numbers.

### 4. Tablet screenshots
Folder: `google-play-assets/tablet-screenshots/`:
* **7-inch tablets:**
  - `tablet_7inch_01_reading.png` (1200 x 1920 px)
  - `tablet_7inch_02_mermaid.png` (1200 x 1920 px)
* **10-inch tablets:**
  - `tablet_10inch_01_landscape_doc.png` (2560 x 1600 px landscape)
  - `tablet_10inch_02_landscape_mermaid.png` (2560 x 1600 px landscape)

---

## 📦 Binary Release Bundle to Upload (AAB)

In Google Play Console under **Create new release**:

`src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`
