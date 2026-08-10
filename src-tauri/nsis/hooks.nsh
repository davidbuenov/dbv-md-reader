; Macros de asociacion opcional de archivos .md, usadas por las secciones
; SEC_CONTEXTMENU / SEC_DEFAULTAPP definidas en src-tauri/nsis/installer.nsi.template
; (pagina de componentes del instalador, checkboxes marcados por defecto).
;
; Se apoyan en el mismo esquema de registro que APP_ASSOCIATE/APP_UNASSOCIATE
; de FileAssociation.nsh, pero separan "registrar la clase/ProgId" (visible
; en "Abrir con...") de "reclamar el puntero de extension por defecto"
; (aplicacion predeterminada) — algo que APP_ASSOCIATE siempre hace junto,
; por lo que no sirve para dejar ambas cosas como opt-in independientes.

!macro DBV_REGISTER_PROGID FILECLASS DESCRIPTION ICON COMMANDTEXT COMMAND
  WriteRegStr SHCTX "Software\Classes\${FILECLASS}" "" `${DESCRIPTION}`
  WriteRegStr SHCTX "Software\Classes\${FILECLASS}\DefaultIcon" "" `${ICON}`
  WriteRegStr SHCTX "Software\Classes\${FILECLASS}\shell" "" "open"
  WriteRegStr SHCTX "Software\Classes\${FILECLASS}\shell\open" "" `${COMMANDTEXT}`
  WriteRegStr SHCTX "Software\Classes\${FILECLASS}\shell\open\command" "" `${COMMAND}`
!macroend

!macro DBV_UNREGISTER_PROGID FILECLASS
  DeleteRegKey SHCTX "Software\Classes\${FILECLASS}"
!macroend

!macro DBV_SET_DEFAULT EXT FILECLASS
  ReadRegStr $R0 SHCTX "Software\Classes\.${EXT}" ""
  WriteRegStr SHCTX "Software\Classes\.${EXT}" "${FILECLASS}_backup" "$R0"
  WriteRegStr SHCTX "Software\Classes\.${EXT}" "" "${FILECLASS}"
!macroend

!macro DBV_RESTORE_DEFAULT EXT FILECLASS
  ReadRegStr $R0 SHCTX "Software\Classes\.${EXT}" "${FILECLASS}_backup"
  WriteRegStr SHCTX "Software\Classes\.${EXT}" "" "$R0"
  DeleteRegValue SHCTX "Software\Classes\.${EXT}" "${FILECLASS}_backup"
!macroend
