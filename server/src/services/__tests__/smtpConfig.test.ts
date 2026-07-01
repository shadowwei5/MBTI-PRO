import { afterEach, describe, expect, it } from 'vitest'
import { getSmtpPort, getSmtpSecure, hasSmtpConfig } from '../smtpConfig.js'

const OLD_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...OLD_ENV }
})

describe('smtp config', () => {
  it('uses SSL only for port 465', () => {
    process.env.SMTP_PORT = '465'
    expect(getSmtpPort()).toBe(465)
    expect(getSmtpSecure()).toBe(true)

    process.env.SMTP_PORT = '587'
    expect(getSmtpPort()).toBe(587)
    expect(getSmtpSecure()).toBe(false)
  })

  it('requires both SMTP user and password', () => {
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
    expect(hasSmtpConfig()).toBe(false)

    process.env.SMTP_USER = 'sender@example.com'
    expect(hasSmtpConfig()).toBe(false)

    process.env.SMTP_PASS = 'secret'
    expect(hasSmtpConfig()).toBe(true)
  })
})
