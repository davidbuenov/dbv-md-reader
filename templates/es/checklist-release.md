# Checklist de release — [Nombre del proyecto] v[X.Y.Z]

**Fecha prevista:** [dd/mm/aaaa] · **Tipo de versión:** Major / Minor / Patch

## Antes de la release
- [ ] Todos los tests pasan (`[comando de test]`)
- [ ] Sin issues críticos abiertos en el tracker
- [ ] `CHANGELOG.md` actualizado con los cambios de esta versión
- [ ] Versión incrementada en [`package.json`/`Cargo.toml`/otros]
- [ ] Documentación (`README.md`) actualizada si hubo cambios visibles
- [ ] Revisión de seguridad: sin secretos ni claves en el código

## Build y publicación
- [ ] Build de [plataforma 1] generado y probado
- [ ] Build de [plataforma 2] generado y probado
- [ ] Commit de versión creado
- [ ] Tag `v[X.Y.Z]` creado
- [ ] Push del tag al remoto
- [ ] Release publicada con los assets correspondientes

## Después de la release
- [ ] Anuncio publicado (blog / redes / changelog público)
- [ ] Issues/tareas cerrados y vinculados a esta versión
- [ ] Verificación post-publicación (descarga e instalación real)

## Incidencias encontradas durante el proceso
[Notas de cualquier problema surgido y cómo se resolvió]
