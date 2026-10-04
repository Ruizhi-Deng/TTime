# Repository instructions

## Releases

- Build and publish every release from a commit on `main`.
- Merge intended changes into `main` before publishing. Never publish a release from a development branch or its build artifacts.
- Keep the app version, release tag, and downloadable filenames consistent.
- When explicitly updating an existing release, rebuild from `main`, replace its assets and checksums, and point its tag at the commit used for that build.
