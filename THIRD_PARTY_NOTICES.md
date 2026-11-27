# Third-party notices

`dist/` bundles the runtime dependencies recorded in `package-lock.json`. Preserve this file and the generated `dist/THIRD_PARTY_LICENSES.txt` and `dist/*.LEGAL.txt` notice files when redistributing the plugin.

- @modelcontextprotocol/sdk — MIT, Model Context Protocol contributors
- zod — MIT, Colin McDonnell and contributors
- yaml — ISC, Eemeli Aro and contributors
- Transitive runtime dependencies retain their respective licenses in the bundled notices.

Ant Design Vue is a **target design/component system**, not bundled UI code. Its component documentation is referenced to validate the connected project's version. No Ant Design Vue, Pixso, or OpenAI trademark ownership or official endorsement is claimed.

The vendored JSON schemas under `tests/schemas/` are from https://agent-plugins.org/schemas/1.0.0/ and are used only for package validation.

UI/UX Pro Max search scripts, catalogs and reference rules are included under `skills/hd-design/vendor/ui-ux-pro-max/`, MIT, Copyright (c) 2024 Next Level Builder. Preserve its LICENSE and PROVENANCE.md.

The metadata index in `assets/libraries/ant-design-vue.json` was read from the user-designated **Ant Design Vue (Community)** Pixso file, which declares version 4.2.3. Original UI-kit ownership remains with its author. The index contains component identities, property definitions, dimensions and page references; it does not redistribute full canvas geometry, rendered artwork or the Ant Design Vue JavaScript package. Actual component use requires Pixso access and, for cross-file import, publication of the library. The source file and its original notices remain authoritative; this is not an official Ant Design or Pixso distribution.
