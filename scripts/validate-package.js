import { readFile, access, stat } from 'node:fs/promises';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { configSchema } from '../src/project.js';
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv);
for (const [file, schema] of [['plugin.json','tests/schemas/plugin.schema.json'],['mcp.json','tests/schemas/mcp.schema.json']]) {
 const validate = ajv.compile(await readJson(schema));
 if (!validate(await readJson(file))) throw Error(`${file}: ${JSON.stringify(validate.errors)}`);
}
const lock = await readJson('package-lock.json');
for (const item of Object.values(lock.packages || {})) {
 if (item.resolved && !item.resolved.startsWith('https://registry.npmjs.org/')) throw Error('Dependency lock contains a non-public registry URL');
}
const manifest = await readJson('plugin.json');
const pkg = await readJson('package.json');
if (manifest.version !== pkg.version || (await readJson('.codex-plugin/plugin.json')).version!==pkg.version || lock.version!==pkg.version || lock.packages[''].version!==pkg.version) throw Error('Version mismatch');
const market = await readJson('.agents/plugins/marketplace.json');
if (!market.plugins.some(p => p.name === manifest.name && p.source.path === './')) throw Error('Marketplace entry is missing');
configSchema.parse(await readJson('pixso-codex.example.json'));
for (const file of ['dist/server.js','dist/doctor.js','dist/login.js','dist/THIRD_PARTY_LICENSES.txt','skills/hd-design/SKILL.md','assets/icon.svg']) await access(file);
if ((await stat('dist/server.js')).size < 1000) throw Error('Empty runtime bundle');
for(const file of ['skills/hd-design/vendor/ui-ux-pro-max/LICENSE','skills/hd-design/vendor/ui-ux-pro-max/scripts/search.py','skills/hd-design/vendor/ui-ux-pro-max/data/ux-guidelines.csv','skills/hd-design/references/connections.md','skills/hd-design/references/icon-states.md']) await access(file);
console.log('Plugin and MCP schemas, marketplace, config and bundled assets validated');
