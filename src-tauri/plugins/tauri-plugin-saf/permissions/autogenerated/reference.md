## Default Permission

Permite las operaciones de Storage Access Framework (SAF) usadas por la
versión Android de dbv-md-reader: la sonda de disponibilidad (`ping`),
conceder una carpeta + leer su primer documento (`pick_folder_and_read_first_markdown`,
Slice 1), y la navegación del árbol completo — listar una carpeta, leer un
documento arbitrario, resolver rutas relativas e imágenes (`list_children`,
`read_document`, `resolve_relative`, `read_image_data_uri`, Slice 2).

#### This default permission set includes the following:

- `allow-ping`
- `allow-pick-folder-and-read-first-markdown`
- `allow-list-children`
- `allow-read-document`
- `allow-resolve-relative`
- `allow-read-image-data-uri`

## Permission Table

<table>
<tr>
<th>Identifier</th>
<th>Description</th>
</tr>


<tr>
<td>

`saf:allow-list-children`

</td>
<td>

Enables the list_children command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`saf:deny-list-children`

</td>
<td>

Denies the list_children command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`saf:allow-pick-folder-and-read-first-markdown`

</td>
<td>

Enables the pick_folder_and_read_first_markdown command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`saf:deny-pick-folder-and-read-first-markdown`

</td>
<td>

Denies the pick_folder_and_read_first_markdown command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`saf:allow-ping`

</td>
<td>

Enables the ping command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`saf:deny-ping`

</td>
<td>

Denies the ping command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`saf:allow-read-document`

</td>
<td>

Enables the read_document command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`saf:deny-read-document`

</td>
<td>

Denies the read_document command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`saf:allow-read-image-data-uri`

</td>
<td>

Enables the read_image_data_uri command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`saf:deny-read-image-data-uri`

</td>
<td>

Denies the read_image_data_uri command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`saf:allow-resolve-relative`

</td>
<td>

Enables the resolve_relative command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`saf:deny-resolve-relative`

</td>
<td>

Denies the resolve_relative command without any pre-configured scope.

</td>
</tr>
</table>
