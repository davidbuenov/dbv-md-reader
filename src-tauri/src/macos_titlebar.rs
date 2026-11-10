// =============================================================================
// dbv-md-reader — Cabecera nativa de macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// @spec RF-14
use objc2::MainThreadOnly;
use objc2_app_kit::{
    NSAutoresizingMaskOptions, NSColor, NSFont, NSLayoutAttribute, NSTextField,
    NSTitlebarAccessoryViewController, NSView, NSWindow, NSWindowTitleVisibility,
};
use objc2_foundation::{NSPoint, NSSize, NSString};
use tauri::Manager;

/// La cabecera muestra la marca, pero el título documental sigue identificando el
/// archivo para las pestañas, el Dock y accesibilidad. Se instala una vez por ventana.
pub fn install(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    let brand = window
        .app_handle()
        .config()
        .app
        .windows
        .iter()
        .find(|config| config.label == "main")
        .map(|config| config.title.clone())
        .unwrap_or_else(|| "DBV Markdown Reader".to_string());
    window.with_webview(move |webview| {
        // SAFETY: Tauri ejecuta este callback en el hilo principal y mantiene vivos
        // el WebView y su NSWindow durante la llamada. No se guarda el puntero.
        let native = unsafe { &*webview.ns_window().cast::<NSWindow>() };
        let label = NSTextField::labelWithString(&NSString::from_str(&brand), native.mtm());
        label.setFont(Some(&NSFont::systemFontOfSize(12.0)));
        label.setTextColor(Some(&NSColor::secondaryLabelColor()));
        label.sizeToFit();
        let size = label.frame().size;
        label.setFrameOrigin(NSPoint::new(0.0, (22.0 - size.height) / 2.0));
        label.setAutoresizingMask(
            NSAutoresizingMaskOptions::ViewMinYMargin | NSAutoresizingMaskOptions::ViewMaxYMargin,
        );
        let holder = NSView::new(native.mtm());
        holder.setFrameSize(NSSize::new(size.width + 12.0, 22.0));
        holder.addSubview(&label);

        let accessory = NSTitlebarAccessoryViewController::new(native.mtm());
        accessory.setView(&holder);
        accessory.setLayoutAttribute(NSLayoutAttribute::Left);
        native.setTitleVisibility(NSWindowTitleVisibility::Hidden);
        native.addTitlebarAccessoryViewController(&accessory);
    })
}
