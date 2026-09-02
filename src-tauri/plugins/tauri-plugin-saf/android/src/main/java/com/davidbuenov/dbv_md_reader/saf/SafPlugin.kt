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
import android.os.Build
import android.provider.DocumentsContract
import android.util.Base64
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.IOException

/**
 * Extensiones tratadas como documento abierto por la app — mismo criterio que
 * `MARKDOWN_EXTENSIONS` en el `lib.rs` de la app principal (filtro del árbol
 * RF-25, criterio de "es clicable").
 */
private val MARKDOWN_EXTENSIONS = arrayOf(".md", ".markdown", ".txt")

private fun isMarkdownName(name: String): Boolean =
    MARKDOWN_EXTENSIONS.any { name.endsWith(it, ignoreCase = true) }

/** Una entrada de un nivel del árbol — mismo shape que `DirEntryInfo` en `lib.rs`
 * (`name`, `path`, `is_dir`, `is_markdown`), para que `filetree.js` no necesite
 * saber que viene de SAF en vez de `std::fs`. */
private class ChildEntry(val name: String, val uri: Uri, val isDir: Boolean) {
    fun toJson(): JSObject {
        val o = JSObject()
        o.put("name", name)
        o.put("path", uri.toString())
        o.put("is_dir", isDir)
        o.put("is_markdown", !isDir && isMarkdownName(name))
        return o
    }
}

@InvokeArg
class UriArgs {
    lateinit var uri: String
}

@InvokeArg
class ResolveRelativeArgs {
    lateinit var baseDirUri: String
    lateinit var relativePath: String
}

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

        // URI del documento RAÍZ bajo el árbol (no la URI de árbol "pelada" que
        // devuelve el selector) — la única forma autocontenida de que el resto de
        // comandos (listChildren/readDocument/resolveRelative) puedan derivar tanto
        // el árbol como el documento con un solo parámetro (ver rootDirUriOf).
        val rootDirUri = rootDirUriOf(treeUri)

        val firstMarkdown = try {
            findFirstMarkdownChild(rootDirUri)
        } catch (e: SecurityException) {
            invoke.reject("permission_denied: ${e.message}")
            return
        }

        if (firstMarkdown == null) {
            invoke.reject("no_markdown_found")
            return
        }

        val content = try {
            readTextDocument(firstMarkdown.uri)
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
        payload.put("path", firstMarkdown.uri.toString())
        payload.put("dir_path", rootDirUri.toString())
        payload.put("file_name", firstMarkdown.name)
        payload.put("content", content)
        invoke.resolve(payload)
    }

    /**
     * Lista un único nivel (no recursivo, leído bajo demanda al expandir en
     * `filetree.js` — RF-25) de la carpeta identificada por `uri`. Mismo shape
     * de entrada/salida que el `list_directory` de escritorio.
     */
    @Command
    fun listChildren(invoke: Invoke) {
        val args = invoke.parseArgs(UriArgs::class.java)
        val dirUri = Uri.parse(args.uri)
        val entries = try {
            queryChildren(dirUri)
        } catch (e: SecurityException) {
            invoke.reject("permission_denied: ${e.message}")
            return
        }
        val result = JSObject()
        result.put("entries", JSArray.from(entries.map { it.toJson() }.toTypedArray()))
        invoke.resolve(result)
    }

    /**
     * Lee un documento por su URI completa. `dir_path` se calcula con
     * `DocumentsContract.findDocumentPath` (API 26+) para que RF-07/RF-08A
     * puedan resolver rutas relativas desde la carpeta real que contiene este
     * documento, no solo desde la raíz concedida — con degradación
     * silenciosa (`dir_path` cae a la propia carpeta raíz del árbol) si el
     * proveedor no implementa esa consulta o el dispositivo es API < 26.
     */
    @Command
    fun readDocument(invoke: Invoke) {
        val args = invoke.parseArgs(UriArgs::class.java)
        val docUri = Uri.parse(args.uri)

        val content = try {
            readTextDocument(docUri)
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

        val name = queryDisplayName(docUri) ?: docUri.lastPathSegment ?: "documento.md"
        val parent = findParent(docUri) ?: rootDirUriOf(docUri)

        val payload = JSObject()
        payload.put("path", docUri.toString())
        payload.put("dir_path", parent.toString())
        payload.put("file_name", name)
        payload.put("content", content)
        invoke.resolve(payload)
    }

    /**
     * Resuelve `relativePath` (p. ej. `./img/foo.png`, `../notas.md`) contra
     * `baseDirUri`, caminando el árbol segmento a segmento — `..` sube al
     * padre real (ver [findParent]), cualquier otro segmento baja al hijo con
     * ese nombre exacto (ver [queryChildren]). Sin caché: cada segmento es una
     * consulta a `ContentResolver`, pero un enlace/imagen típico solo tiene 1-2
     * segmentos (mismo criterio de "árbol ya cargado en memoria" del plan —
     * el `implementation_plan.md` prevé este coste, ver Slice 2).
     */
    @Command
    fun resolveRelative(invoke: Invoke) {
        val args = invoke.parseArgs(ResolveRelativeArgs::class.java)
        var current = Uri.parse(args.baseDirUri)
        val segments = args.relativePath.split('/', '\\').filter { it.isNotEmpty() && it != "." }

        try {
            for (segment in segments) {
                current = if (segment == "..") {
                    findParent(current) ?: run {
                        invoke.reject("resolve_failed: no hay carpeta padre para '..'")
                        return
                    }
                } else {
                    val child = queryChildren(current).firstOrNull { it.name == segment }
                    if (child == null) {
                        invoke.reject("resolve_failed: no se encontró '$segment'")
                        return
                    }
                    child.uri
                }
            }
        } catch (e: SecurityException) {
            invoke.reject("permission_denied: ${e.message}")
            return
        }

        val result = JSObject()
        result.put("uri", current.toString())
        invoke.resolve(result)
    }

    /**
     * Lee `uri` como imagen y la devuelve como `data:` URI (base64) — el
     * WebView de Android no puede cargar `content://` directamente en
     * `<img src>` como sí hace `convertFileSrc()` con rutas de fichero reales
     * en escritorio (ver `resolveImages()` en `app.js`, rama Android).
     */
    @Command
    fun readImageDataUri(invoke: Invoke) {
        val args = invoke.parseArgs(UriArgs::class.java)
        val uri = Uri.parse(args.uri)
        val mimeType = activity.contentResolver.getType(uri) ?: "application/octet-stream"

        val bytes = try {
            activity.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        } catch (e: SecurityException) {
            invoke.reject("permission_denied: ${e.message}")
            return
        } catch (e: IOException) {
            invoke.reject("read_failed: ${e.message}")
            return
        }
        if (bytes == null) {
            invoke.reject("read_failed: contentResolver.openInputStream returned null")
            return
        }

        val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
        val result = JSObject()
        result.put("dataUri", "data:$mimeType;base64,$base64")
        invoke.resolve(result)
    }

    // ── Helpers compartidos ────────────────────────────────────────────────

    /** URI del documento raíz de un árbol, autocontenida (embebe tree+docId) —
     * a diferencia de la URI "pelada" que devuelve `ACTION_OPEN_DOCUMENT_TREE`,
     * esta sirve directamente como `uri` de entrada de `listChildren`. */
    private fun rootDirUriOf(treeOrDocUri: Uri): Uri {
        val treeId = DocumentsContract.getTreeDocumentId(treeOrDocUri)
        return DocumentsContract.buildDocumentUriUsingTree(treeOrDocUri, treeId)
    }

    private fun readTextDocument(uri: Uri): String? =
        activity.contentResolver.openInputStream(uri)?.use { input ->
            input.bufferedReader(Charsets.UTF_8).readText()
        }

    private fun queryDisplayName(uri: Uri): String? {
        val projection = arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
        activity.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
            val nameIdx = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
            if (cursor.moveToFirst()) return cursor.getString(nameIdx)
        }
        return null
    }

    /** Un único nivel de hijos de `dirUri` — carpetas primero, alfabético
     * insensible a mayúsculas, mismo orden que `list_directory_entries` en
     * `lib.rs` (RF-25). */
    private fun queryChildren(dirUri: Uri): List<ChildEntry> {
        val treeUri = DocumentsContract.buildTreeDocumentUri(dirUri.authority, DocumentsContract.getTreeDocumentId(dirUri))
        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
            treeUri,
            DocumentsContract.getDocumentId(dirUri)
        )
        val projection = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE
        )
        val entries = mutableListOf<ChildEntry>()
        activity.contentResolver.query(childrenUri, projection, null, null, null)?.use { cursor ->
            val idIdx = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
            val nameIdx = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
            val mimeIdx = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
            while (cursor.moveToNext()) {
                val name = cursor.getString(nameIdx) ?: continue
                val docId = cursor.getString(idIdx)
                val isDir = cursor.getString(mimeIdx) == DocumentsContract.Document.MIME_TYPE_DIR
                entries.add(ChildEntry(name, DocumentsContract.buildDocumentUriUsingTree(treeUri, docId), isDir))
            }
        }
        entries.sortWith(compareByDescending<ChildEntry> { it.isDir }.thenBy { it.name.lowercase() })
        return entries
    }

    private fun findFirstMarkdownChild(rootDirUri: Uri): ChildEntry? {
        val direct = queryChildren(rootDirUri)
        val firstDirect = direct.firstOrNull { !it.isDir && isMarkdownName(it.name) }
        if (firstDirect != null) return firstDirect

        // Búsqueda en subcarpetas inmediatas si la raíz no tiene archivos .md directos
        for (sub in direct.filter { it.isDir }) {
            val subChildren = queryChildren(sub.uri)
            val firstInSub = subChildren.firstOrNull { !it.isDir && isMarkdownName(it.name) }
            if (firstInSub != null) return firstInSub
        }
        return null
    }

    /** Padre real de `uri` vía `DocumentsContract.findDocumentPath` (API 26+,
     * `Path#getPath()` incluye el propio documento como último elemento — el
     * penúltimo es el padre). `null` si `uri` ya es la raíz del árbol, si el
     * proveedor no soporta la consulta (algunos no implementan
     * `findDocumentPath`, lanza excepción) o si el dispositivo es API < 26 —
     * en cualquiera de esos casos el llamante degrada a la raíz del árbol. */
    private fun findParent(uri: Uri): Uri? {
        if (Build.VERSION.SDK_INT < 26) return null
        val treeUri = DocumentsContract.buildTreeDocumentUri(uri.authority, DocumentsContract.getTreeDocumentId(uri))
        return try {
            val path = DocumentsContract.findDocumentPath(activity.contentResolver, uri) ?: return null
            val ids = path.path
            if (ids.size < 2) null else DocumentsContract.buildDocumentUriUsingTree(treeUri, ids[ids.size - 2])
        } catch (e: Exception) {
            // FileNotFoundException (declarada) o UnsupportedOperationException
            // (proveedor sin soporte) — ambas degradan igual, sin propagar el error.
            null
        }
    }
}
