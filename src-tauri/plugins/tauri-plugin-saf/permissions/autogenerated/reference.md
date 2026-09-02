## Default Permission

Permite las operaciones mínimas de Storage Access Framework (SAF) usadas por
la versión Android de dbv-md-reader en la Slice 1: la sonda de disponibilidad
(`ping`) y conceder una carpeta + leer su primer documento `.md`
(`pick_folder_and_read_first_markdown`).

#### This default permission set includes the following:

- `allow-ping`
- `allow-pick-folder-and-read-first-markdown`

## Permission Table

<table>
<tr>
<th>Identifier</th>
<th>Description</th>
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
</table>
