const DEFAULT_SECRET_PATH = '/sistema'
const SECRET_PATH_KEY = 'secretPath'

export class ConfigService {
  private kv: KVNamespace

  constructor(kv: KVNamespace) {
    this.kv = kv
  }

  async getSecretPath(): Promise<string> {
    const value = await this.kv.get(SECRET_PATH_KEY)
    return value || DEFAULT_SECRET_PATH
  }

  async setSecretPath(path: string): Promise<string> {
    const normalized = normalizePath(path)
    if (!/^\/[A-Za-z0-9_\-\/]{3,60}$/.test(normalized)) {
      throw new Error('Ruta inválida: use 3-60 letras, números, guion o guion bajo.')
    }
    await this.kv.put(SECRET_PATH_KEY, normalized)
    return normalized
  }
}

function normalizePath(p: string): string {
  return '/' + String(p || '').trim().replace(/^\/+|\/+$/g, '')
}

export async function initConfig(config: ConfigService): Promise<void> {
  const path = await config.getSecretPath()
  if (!path) {
    await config.setSecretPath(DEFAULT_SECRET_PATH)
  }
}
