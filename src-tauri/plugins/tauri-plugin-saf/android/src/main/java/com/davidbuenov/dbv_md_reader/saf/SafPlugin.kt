// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

package com.davidbuenov.dbv_md_reader.saf

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.IOException

/**
 * Extensiones tratadas como documento Markdown — mismo criterio que
 * `MARKDOWN_EXTENSIONS` en el `lib.rs` de la app principal (sin `.txt` aquí:
 * la Slice 1 solo necesita encontrar el primer documento real de la carpeta
 * concedida, no replicar el filtro completo del árbol de RF-25/Slice 2).
 */
private val MARKDOWN_EXTENSIONS = arrayOf(".md", ".markdown")

@TauriPlugin
class SafPlugin(private val activity: Activity) : Plugin(activity) {

    /**
     * Sonda de disponibilidad (ver `commands::ping` en el lado Rust) — no abre
     * ningún selector, solo confirma que el plugin está registrado.
     */
    @Command
    fun ping(invoke: Invoke) {
        val result = JSObject()
        result.put("available", true)
        invoke.resolve(result)
    }

    /**
     * Punto de entrada único de la Slice 1: lanza el selector de árbol de SAF.
     * El resto del flujo (persistir permiso, listar hijos, leer contenido)
     * ocurre en [handleFolderPicked] una vez el usuario responde, porque
     * `ACTION_OPEN_DOCUMENT_TREE` solo puede resolverse vía `ActivityResult`.
     */
    @Command
    fun pickFolderAndReadFirstMarkdown(invoke: Invoke) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        startActivityForResult(invoke, intent, "handleFolderPicked")
    }

    @ActivityCallback
    fun handleFolderPicked(invoke: Invoke, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            // Usuario canceló el selector — no es un error real (mismo criterio de
            // autocuración de RF-11: el frontend no debe mostrar una alerta por esto).
            invoke.reject("cancelled")
            return
        }

        val treeUri: Uri? = result.data?.data
        if (treeUri == null) {
            invoke.reject("cancelled")
            return
        }

        try {
            // El sistema concede FLAG_GRANT_READ/WRITE_URI_PERMISSION sobre el Intent de
            // respuesta para ACTION_OPEN_DOCUMENT_TREE; solo se persiste lo realmente
            // concedido (RNF de solo lectura: MVP Android no escribe, pero persistir
            // también write no cuesta nada y evita tener que volver a pedirlo si RF-20
            // se activa en Android en el futuro).
            val grantedFlags = (result.data?.flags ?: 0) and
                (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            activity.contentResolver.takePersistableUriPermission(treeUri, grantedFlags)
        } catch (e: SecurityException) {
            invoke.reject("permission_denied: ${e.message}")
            return
        }

        val firstMarkdown = try {
            findFirstMarkdownChild(treeUri)
        } catch (e: SecurityException) {
            invoke.reject("permission_denied: ${e.message}")
            return
        }

        if (firstMarkdown == null) {
            invoke.reject("no_markdown_found")
            return
        }
        val (documentUri, documentName) = firstMarkdown

        val content = try {
            activity.contentResolver.openInputStream(documentUri)?.use { input ->
                input.bufferedReader(Charsets.UTF_8).readText()
            }
        } catch (e: SecurityException) {
            invoke.reject("permission_denied: ${e.message}")
            return
        } catch (e: IOException) {
            invoke.reject("read_failed: ${e.message}")
            return
        }

        if (content == null) {
            invoke.reject("read_failed: contentResolver.openInputStream returned null")
            return
        }

        val payload = JSObject()
        payload.put("path", documentUri.toString())
        payload.put("dir_path", treeUri.toString())
        payload.put("file_name", documentName)
        payload.put("content", content)
        invoke.resolve(payload)
    }

    /**
     * Lee un único nivel (no recursivo — el árbol completo llega en la Slice 2,
     * ver `implementation_plan.md`) de la carpeta concedida y devuelve el primer
     * hijo cuyo nombre termine en `.md`/`.markdown`, o `null` si no hay ninguno.
     */
    private fun findFirstMarkdownChild(treeUri: Uri): Pair<Uri, String>? {
        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
            treeUri,
            DocumentsContract.getTreeDocumentId(treeUri)
        )
        val projection = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME
        )

        activity.contentResolver.query(childrenUri, projection, null, null, null)?.use { cursor ->
            val idIdx = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
            val nameIdx = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
            while (cursor.moveToNext()) {
                val name = cursor.getString(nameIdx) ?: continue
                if (MARKDOWN_EXTENSIONS.any { name.endsWith(it, ignoreCase = true) }) {
                    val docId = cursor.getString(idIdx)
                    return DocumentsContract.buildDocumentUriUsingTree(treeUri, docId) to name
                }
            }
        }
        return null
    }
}
