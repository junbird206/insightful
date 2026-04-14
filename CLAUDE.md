# CLAUDE.md

## Build Impact Rule

Every response that includes code changes MUST end with one of:

- **Xcode 재빌드 불필요** (reason) — JS/TS, React UI, styling, logic-only changes (Metro reload sufficient)
- **Xcode 재빌드 필요** (reason) — ios/, Swift/Obj-C, Share Extension, Info.plist, entitlements, App Groups, notifications, native modules, expo prebuild-affecting changes

## No `prebuild --clean`

Do NOT run `npx expo prebuild --clean` without explicit user approval. This project has a manually added iOS Share Extension target (InsightfulShare) and App Groups entitlements that Expo does not manage. A clean prebuild will destroy:
- InsightfulShare target + embed settings in project.pbxproj
- App Groups in insightful.entitlements
- Any other manual Xcode project modifications

If prebuild --clean is truly necessary, warn the user first and list exactly what will need to be re-added afterward.
