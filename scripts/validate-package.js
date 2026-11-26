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
const manifest = await readJson('plugin.json');
const pkg = await readJson('package.json');
if (manifest.version !== pkg.version) throw Error('Version mismatch');
const market = await readJson('.agents/plugins/marketplace.json');
if (!market.plugins.some(p => p.name === manifest.name && p.source.path === './')) throw Error('Marketplace entry is missing');
configSchema.parse(await readJson('pixso-codex.example.json'));
for (const file of ['dist/server.js','dist/doctor.js','dist/THIRD_PARTY_LICENSES.txt','skills/pixso-design/SKILL.md','assets/icon.svg']) await access(file);
if ((await stat('dist/server.js')).size < 1000) throw Error('Empty runtime bundle');
console.log('Plugin and MCP schemas, marketplace, config and bundled assets validated');
