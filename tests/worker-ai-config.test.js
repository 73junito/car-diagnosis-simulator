import { validateProviderConfig, isLocalOrLoopback, isPrivateRFC1918 } from '../worker/config/ai-config.js'

describe('AI config validation', () => {
  test('detects localhost and loopback', () => {
    expect(isLocalOrLoopback('localhost')).toBe(true)
    expect(isLocalOrLoopback('127.0.0.1')).toBe(true)
    expect(isLocalOrLoopback('0.0.0.0')).toBe(true)
    expect(isLocalOrLoopback('example.com')).toBe(false)
  })

  test('detects private RFC1918 ranges', () => {
    expect(isPrivateRFC1918('10.0.0.5')).toBe(true)
    expect(isPrivateRFC1918('192.168.1.1')).toBe(true)
    expect(isPrivateRFC1918('172.16.0.1')).toBe(true)
    expect(isPrivateRFC1918('8.8.8.8')).toBe(false)
  })

  test('throws in production when using localhost URL', () => {
    expect(() =>
      validateProviderConfig({
        provider: 'ollama',
        url: 'http://127.0.0.1:11434/api/chat',
        apiKey: '',
        env: { NODE_ENV: 'production', TORQUEMIND_AI_MODEL: 'm' },
      })
    ).toThrow(/Refusing to use localhost/)
  })

  test('requires api key for openai-compatible in production', () => {
    expect(() =>
      validateProviderConfig({
        provider: 'openai-compatible',
        url: 'https://api.example.com/v1',
        apiKey: '',
        env: { NODE_ENV: 'production', TORQUEMIND_AI_MODEL: 'm' },
      })
    ).toThrow(/Missing required API key/)
  })
})
