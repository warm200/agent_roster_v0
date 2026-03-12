import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

import { HttpError } from './http'

export class EncryptedSecretStore {
  private readonly key: Buffer

  constructor(
    secretSeed: string,
    private readonly invalidSecretMessage: string,
  ) {
    this.key = createHash('sha256').update(secretSeed).digest()
  }

  async write(value: string) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()

    return ['enc', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':')
  }

  async read(ref: string) {
    const [prefix, ivPart, tagPart, dataPart] = ref.split(':')

    if (prefix !== 'enc' || !ivPart || !tagPart || !dataPart) {
      throw new HttpError(500, 'Stored secret is invalid.')
    }

    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivPart, 'base64url'))
      decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))

      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataPart, 'base64url')),
        decipher.final(),
      ])

      return decrypted.toString('utf8')
    } catch {
      throw new HttpError(409, this.invalidSecretMessage)
    }
  }
}
