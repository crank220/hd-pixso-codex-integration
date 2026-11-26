// 从随插件分发的 package.json 读取版本，保持源码和 dist 入口的协议版本一致。
import { readFileSync } from 'node:fs';

// 本文件和构建后的 dist/*.js 都位于插件根目录的下一层；ZIP 必须包含 package.json。
const packageInfo = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const PLUGIN_NAME = 'hd-pixso-codex';
export const PLUGIN_VERSION = packageInfo.version;
