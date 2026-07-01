import { describe, expect, it } from 'vitest'
import { __private__ } from '../env.js'

describe('server env loader', () => {
  it('parses simple env lines', () => {
    expect(__private__.parseEnvLine('SMTP_USER=test@example.com')).toEqual(['SMTP_USER', 'test@example.com'])
    expect(__private__.parseEnvLine('SMTP_PASS="abc123"')).toEqual(['SMTP_PASS', 'abc123'])
  })

  it('ignores comments and invalid lines', () => {
    expect(__private__.parseEnvLine('# comment')).toBeNull()
    expect(__private__.parseEnvLine('')).toBeNull()
    expect(__private__.parseEnvLine('NO_EQUALS')).toBeNull()
  })
})
