// 实现 SDK 所需的 OAuth 凭据接口，将令牌保存在用户私有目录。
import { mkdir, readFile, writeFile, rename, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
export const AUTH_HELP =
  'REMOTE_AUTH_REQUIRED: run node <plugin-root>/dist/login.js to authorize Pixso, then retry; or set PIXSO_PERSONAL_TOKEN in the MCP server environment';
/** 适配 SDK 的 OAuthClientProvider；PKCE verifier 和随机 state 仅保留在本进程。 */
export class PixsoOAuthProvider {
  constructor({
    directory = process.env.HD_PIXSO_AUTH_DIR || join(homedir(), '.config', 'hd-design'),
    redirectUrl = 'http://127.0.0.1:9417/callback',
    onRedirect,
  } = {}) {
    this.directory = directory;
    this.file = join(directory, 'pixso-oauth.json');
    this._redirectUrl = redirectUrl;
    this.onRedirect = onRedirect;
    this.nonce = randomBytes(32).toString('base64url');
  }
  get redirectUrl() {
    return this._redirectUrl;
  }
  get clientMetadata() {
    return {
      client_name: 'HD Design',
      redirect_uris: [this.redirectUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: 'mcp:connect',
    };
  }
  state() {
    return this.nonce;
  }
  /** 凭据绑定官方 MCP endpoint；文件不存在视为未登录，损坏文件必须明确报错。 */
  async read() {
    try {
      const s = JSON.parse(await readFile(this.file, 'utf8'));
      return s.endpoint === 'https://pixso.cn/mcp' ? s : {};
    } catch (e) {
      if (e.code === 'ENOENT') return {};
      throw Error('OAUTH_STORE_UNREADABLE: repair the local credential store');
    }
  }
  /** 临时文件以 0600 写入后 rename；不将 token 写入项目、插件目录或 stdout。 */
  async save(key, value) {
    const data = await this.read();
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temp = join(this.directory, `oauth-${randomBytes(12).toString('hex')}.tmp`);
    await writeFile(
      temp,
      JSON.stringify({ ...data, endpoint: 'https://pixso.cn/mcp', [key]: value }),
      { mode: 0o600, flag: 'wx' },
    );
    await rename(temp, this.file);
    await chmod(this.file, 0o600);
  }
  async clientInformation() {
    return (await this.read()).client;
  }
  async saveClientInformation(value) {
    await this.save('client', value);
  }
  /** expiresAt 的单位为毫秒；过期后保留 refresh_token，交给 SDK 刷新。 */
  async tokens() {
    const d = await this.read();
    if (d.expiresAt && Date.now() >= d.expiresAt)
      return d.tokens ? { ...d.tokens, expires_in: 0 } : undefined;
    return d.tokens;
  }
  async saveTokens(value) {
    await this.save('tokens', value);
    await this.save('expiresAt', value.expires_in ? Date.now() + value.expires_in * 1000 : null);
  }
  async redirectToAuthorization(url) {
    if (!this.onRedirect) throw Error(AUTH_HELP);
    await this.onRedirect(url);
  }
  saveCodeVerifier(value) {
    this.verifier = value;
  }
  codeVerifier() {
    if (!this.verifier) throw Error('OAUTH_VERIFIER_MISSING');
    return this.verifier;
  }
  /** 按 SDK 指定范围失效凭据，清除 token 时保留仍有效的 client 注册信息。 */
  async invalidateCredentials(scope) {
    if (scope === 'verifier') {
      this.verifier = undefined;
      return;
    }
    if (scope === 'all' || scope === 'client') await this.save('client', undefined);
    if (scope === 'all' || scope === 'tokens') {
      await this.save('tokens', undefined);
      await this.save('expiresAt', null);
    }
  }
}
/** 校验一次登录的回调路径、state 和授权码；调用方另外负责只消费一次回调。 */
export function validateCallback(url, provider) {
  if (url.pathname !== '/callback' || url.searchParams.get('state') !== provider.nonce)
    throw Error('OAUTH_STATE_MISMATCH');
  if (url.searchParams.has('error')) throw Error('OAUTH_DENIED');
  const code = url.searchParams.get('code');
  if (!code) throw Error('OAUTH_CODE_MISSING');
  return code;
}
