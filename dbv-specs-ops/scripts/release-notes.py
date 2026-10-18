#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
release-notes.py — Notas de release de GitHub desde CHANGELOG.md (dbv-specs-ops).

Extrae la sección `## [X.Y.Z]` del CHANGELOG (inglés primero si existe CHANGELOG.en.md junto a él,
y el español debajo) y, opcionalmente, crea el Release de GitHub
con `gh`. Solo librería estándar (Python 3.8+). Un tag de git NO es un Release: este script
cubre ese paso de la fase Ship.

Uso (desde la raíz del repositorio):
  python scripts/release-notes.py v3.1.0                 # imprime las notas
  python scripts/release-notes.py v3.1.0 --create        # crea el Release (el tag debe estar subido)
  python scripts/release-notes.py --all --create         # releases de todos los tags que falten
  python scripts/release-notes.py v3.1.0 --changelog dbv-specs-ops/CHANGELOG.md   # proyecto consumidor

Códigos de salida: 0 correcto · 1 error (sin sección, sin gh, tag no subido…).
"""
import argparse
import os
import re
import subprocess
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

SEMVER = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)$")


def run(args, input_bytes=None):
    """Ejecuta un comando y devuelve (código, stdout, stderr) sin lanzar si falta el binario."""
    result = (127, "", f"no se encuentra «{args[0]}»")
    try:
        p = subprocess.run(args, input=input_bytes, capture_output=True)
        result = (p.returncode, p.stdout.decode("utf-8", "replace"), p.stderr.decode("utf-8", "replace"))
    except FileNotFoundError:
        pass
    return result


def section(changelog_text, version):
    """Devuelve el cuerpo de `## [version]` hasta el siguiente `## ` o separador `---`."""
    lines = changelog_text.splitlines()
    head = re.compile(r"^##\s*\[" + re.escape(version) + r"\]")
    start = next((i for i, l in enumerate(lines) if head.match(l)), None)
    if start is None:
        return None
    body = []
    for l in lines[start + 1:]:
        if l.startswith("## ") or l.strip() == "---":
            break
        body.append(l)
    return "\n".join(body).strip() or None


def repo_url():
    code, out, _ = run(["git", "remote", "get-url", "origin"])
    if code != 0:
        return None
    url = out.strip()
    url = re.sub(r"^git@github\.com:", "https://github.com/", url)
    return re.sub(r"\.git$", "", url)


def git_root_rel(path):
    """Ruta del fichero relativa a la raíz del repo (para el enlace al CHANGELOG)."""
    code, out, _ = run(["git", "rev-parse", "--show-toplevel"])
    if code != 0:
        return path.replace(os.sep, "/")
    return os.path.relpath(os.path.abspath(path), out.strip()).replace(os.sep, "/")


def one_notes(tag, changelog, english):
    """Notas de un solo idioma a partir de un CHANGELOG, con enlace a ese fichero en el tag."""
    with open(changelog, encoding="utf-8") as f:
        body = section(f.read(), tag.lstrip("v"))
    url = repo_url()
    if body and url:
        link = f"{url}/blob/{tag}/{git_root_rel(changelog)}"
        label = "Full details in the" if english else "Detalle completo en el"
        body += "\n\n" + f"{label} [CHANGELOG]({link})."
    return body


def notes_for(tag, changelog):
    """Inglés primero (si existe CHANGELOG.en.md con la sección) y el español debajo."""
    es = one_notes(tag, changelog, english=False)
    en_path = changelog[:-3] + ".en.md" if changelog.endswith(".md") else changelog + ".en"
    en = one_notes(tag, en_path, english=True) if os.path.isfile(en_path) else None
    body = en or es
    if en and es:
        body = en + "\n\n---\n\n## Versión en español\n\n" + es
    return body + "\n" if body else None


def remote_tags():
    code, out, err = run(["git", "ls-remote", "--tags", "origin"])
    if code != 0:
        return None
    return {m.group(1) for l in out.splitlines() if (m := re.search(r"refs/tags/([^\^]+)$", l))}


def existing_releases():
    code, out, _ = run(["gh", "release", "list", "--limit", "500", "--json", "tagName", "--jq", ".[].tagName"])
    return set(out.split()) if code == 0 else set()


def create(tag, notes, latest):
    flag = "--latest" if latest else "--latest=false"
    code, out, err = run(["gh", "release", "create", tag, "--title", tag, "--notes-file", "-", flag],
                         notes.encode("utf-8"))
    print(("OK    " if code == 0 else "ERROR ") + tag + ("" if code == 0 else f" — {err.strip()}"))
    return code == 0


def semver_key(tag):
    m = SEMVER.match(tag)
    return tuple(int(x) for x in m.groups()) if m else None


def release_one(a):
    """Imprime o crea el Release de una versión. Devuelve el código de salida."""
    tag = a.tag if a.tag.startswith("v") else "v" + a.tag
    notes = notes_for(tag, a.changelog)
    if notes is None:
        print(f"ERROR: {a.changelog} no tiene la sección [{tag.lstrip('v')}]", file=sys.stderr)
        return 1
    if not a.create:
        print(notes)
        return 0
    pushed = remote_tags()
    if pushed is None or tag not in pushed:
        print(f"ERROR: el tag {tag} no está en el remoto; haz `git push origin {tag}` antes "
              "(gh lo crearía en la cabeza de la rama por defecto).", file=sys.stderr)
        return 1
    if tag in existing_releases():
        print(f"SKIP  {tag} (ya tiene Release)")
        return 0
    highest = max((semver_key(t) for t in pushed if semver_key(t)), default=None)
    return 0 if create(tag, notes, semver_key(tag) == highest) else 1


def release_all(a):
    """Recorre los tags semver sin Release, del más antiguo al más reciente."""
    pushed = remote_tags() or set()
    tags = sorted((t for t in pushed if semver_key(t)), key=semver_key)
    have = existing_releases()
    ok = True
    for tag in (t for t in tags if t not in have):
        notes = notes_for(tag, a.changelog)
        if notes is None:
            print(f"SKIP  {tag} (sin sección en el CHANGELOG)")
        elif not a.create:
            print(f"PEND  {tag}")
        else:
            ok = create(tag, notes, tag == tags[-1]) and ok
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("tag", nargs="?", help="Versión (v3.1.0 o 3.1.0)")
    ap.add_argument("--all", action="store_true", help="Todos los tags semver sin Release")
    ap.add_argument("--create", action="store_true", help="Crea el Release con gh (si no, solo imprime)")
    ap.add_argument("--changelog", default="CHANGELOG.md", help="Ruta del CHANGELOG (por defecto CHANGELOG.md)")
    a = ap.parse_args()
    if not a.tag and not a.all:
        print("ERROR: indica una versión o --all", file=sys.stderr)
        return 2
    if not os.path.isfile(a.changelog):
        print(f"ERROR: no existe {a.changelog}", file=sys.stderr)
        return 1
    return release_all(a) if a.all else release_one(a)


if __name__ == "__main__":
    sys.exit(main())
