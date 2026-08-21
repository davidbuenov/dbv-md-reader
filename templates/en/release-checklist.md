# Release Checklist — [Project Name] v[X.Y.Z]

**Target date:** [mm/dd/yyyy] · **Release type:** Major / Minor / Patch

## Before the release
- [ ] All tests pass (`[test command]`)
- [ ] No critical issues open in the tracker
- [ ] `CHANGELOG.md` updated with this version's changes
- [ ] Version bumped in [`package.json`/`Cargo.toml`/others]
- [ ] Documentation (`README.md`) updated if there are user-facing changes
- [ ] Security review: no secrets or keys left in the code

## Build and publish
- [ ] [Platform 1] build generated and tested
- [ ] [Platform 2] build generated and tested
- [ ] Version bump committed
- [ ] Tag `v[X.Y.Z]` created
- [ ] Tag pushed to remote
- [ ] Release published with the corresponding assets

## After the release
- [ ] Announcement published (blog / social / public changelog)
- [ ] Issues/tasks closed and linked to this version
- [ ] Post-release verification (real download and install)

## Issues found during the process
[Notes on any problem that came up and how it was resolved]
