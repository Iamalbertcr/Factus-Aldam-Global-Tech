const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)

export class UploadService {
  private bucket: R2Bucket

  constructor(bucket: R2Bucket) {
    this.bucket = bucket
  }

  async upload(dataUrl: string): Promise<{ url: string }> {
    const m = /^data:image\/(png|jpeg|webp|gif);base64,(.+)$/.exec(dataUrl || '')
    if (!m) throw new Error('Imagen inválida (use PNG, JPG, WEBP o GIF)')

    const format = m[1] === 'jpeg' ? 'jpg' : m[1]
    const name = uid() + '.' + format
    const binary = atob(m[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    await this.bucket.put(name, bytes, {
      httpMetadata: { contentType: `image/${m[1]}` },
    })

    return { url: 'uploads/' + name }
  }

  async serve(key: string): Promise<Response> {
    const object = await this.bucket.get(key)
    if (!object) return new Response('Not Found', { status: 404 })

    const headers: Record<string, string> = {}
    if (object.httpMetadata?.contentType) {
      headers['Content-Type'] = object.httpMetadata.contentType
    }
    if (object.etag) {
      headers['ETag'] = object.etag
    }

    return new Response(object.body, { headers, status: 200 })
  }

  async list(): Promise<Array<{ key: string; url: string }>> {
    const { objects } = await this.bucket.list()
    return objects.map(obj => ({ key: obj.key, url: 'uploads/' + obj.key }))
  }

  async getObject(key: string): Promise<R2ObjectBody | null> {
    return await this.bucket.get(key)
  }

  async putObject(key: string, dataUrl: string): Promise<void> {
    const m = /^data:image\/(png|jpeg|webp|gif);base64,(.+)$/.exec(dataUrl || '')
    if (!m) throw new Error('Formato de imagen inválido')
    const format = m[1] === 'jpeg' ? 'jpg' : m[1]
    const binary = atob(m[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    await this.bucket.put(key, bytes, {
      httpMetadata: { contentType: `image/${m[1]}` },
    })
  }
}

export async function initUploads(service: UploadService): Promise<void> {
  // R2 buckets are created externally; nothing to initialize here.
  return
}
