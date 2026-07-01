export function getSmtpPort(): number {
  return Number(process.env.SMTP_PORT) || 465
}

export function getSmtpSecure(port = getSmtpPort()): boolean {
  return port === 465
}

export function hasSmtpConfig(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
}
