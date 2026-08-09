; Mensajes personalizados del instalador NSIS de dbv-md-reader.
; Ver bundle.windows.nsis.installerHooks en tauri.conf.json.

!macro NSIS_HOOK_POSTINSTALL
  ${IfNot} ${Silent}
  ${AndIfNot} $PassiveMode = 1
    MessageBox MB_OK|MB_ICONINFORMATION "Los archivos .md ya estan asociados con ${PRODUCTNAME}.$\n$\nA partir de ahora, haz doble clic sobre cualquier documento Markdown para abrirlo directamente."
  ${EndIf}
!macroend
