import { describe, it, expect } from 'vitest'
import { parseFrontmatter, stringifyFrontmatter, updateFrontmatter } from '../../ext/utils/frontmatterParser'

describe('parseFrontmatter', () => {
  it('returns empty object for no frontmatter', () => {
    expect(parseFrontmatter('Hello world')).toEqual({})
  })

  it('parses simple key-value pairs', () => {
    const content = `---
title: My Task
status: todo
priority: high
---
Body content`
    const result = parseFrontmatter(content)
    expect(result.title).toBe('My Task')
    expect(result.status).toBe('todo')
    expect(result.priority).toBe('high')
  })

  it('parses boolean values', () => {
    const content = `---
active: true
archived: false
---`
    const result = parseFrontmatter(content)
    expect(result.active).toBe(true)
    expect(result.archived).toBe(false)
  })

  it('parses numeric values', () => {
    const content = `---
year: 2026
count: 42
weight: 3.14
---`
    const result = parseFrontmatter(content)
    expect(result.year).toBe(2026)
    // Non-year numeric values are kept as strings to avoid corrupting IDs
    expect(result.count).toBe('42')
    expect(result.weight).toBe('3.14')
  })

  it('parses arrays', () => {
    const content = `---
tags: [feature, ui, urgent]
---`
    const result = parseFrontmatter(content)
    expect(result.tags).toEqual(['feature', 'ui', 'urgent'])
  })

  it('returns empty object for malformed frontmatter', () => {
    const content = `---
title: No closing`
    expect(parseFrontmatter(content)).toEqual({})
  })

  it('handles values containing colons (URLs)', () => {
    const content = `---
url: https://example.com/path
title: My Task
---`
    const result = parseFrontmatter(content)
    expect(result.url).toBe('https://example.com/path')
    expect(result.title).toBe('My Task')
  })

  it('preserves quoted string values without extra quotes', () => {
    const content = `---
id: "001"
name: "test value"
---`
    const result = parseFrontmatter(content)
    expect(result.id).toBe('001')
    expect(result.name).toBe('test value')
  })

  it('handles empty values', () => {
    const content = `---
assignee:
title: Test
---`
    const result = parseFrontmatter(content)
    expect(result.assignee).toBe('')
    expect(result.title).toBe('Test')
  })
})

describe('stringifyFrontmatter', () => {
  it('stringifies basic types', () => {
    const data = { title: 'Test', count: 5, active: true }
    const result = stringifyFrontmatter(data)
    expect(result).toContain('title: Test')
    expect(result).toContain('count: 5')
    expect(result).toContain('active: true')
  })

  it('stringifies arrays', () => {
    const data = { tags: ['a', 'b'] }
    const result = stringifyFrontmatter(data)
    expect(result).toContain('tags: ["a", "b"]')
  })

  it('escapes quotes in array elements', () => {
    const data = { tags: ['has "quotes"', 'normal'] }
    const result = stringifyFrontmatter(data)
    expect(result).toContain('has \\"quotes\\"')
  })

  it('roundtrips arrays through stringify → parse without quote leakage', () => {
    const original = { tags: ['feature', 'ui', 'urgent'] }
    const stringified = stringifyFrontmatter(original)
    const content = `---\n${stringified}---\nBody`
    const parsed = parseFrontmatter(content)
    expect(parsed.tags).toEqual(['feature', 'ui', 'urgent'])
    expect(parsed.tags[0]).not.toContain('"')
  })

  it('skips null/undefined values', () => {
    const data = { title: 'Test', removed: null, gone: undefined }
    const result = stringifyFrontmatter(data)
    expect(result).toContain('title: Test')
    expect(result).not.toContain('removed')
    expect(result).not.toContain('gone')
  })
})

describe('updateFrontmatter', () => {
  it('updates existing frontmatter fields', () => {
    const content = `---
title: Old Title
status: todo
---
Body here`
    const result = updateFrontmatter(content, { status: 'done' })
    expect(result).toContain('status: done')
    expect(result).toContain('title: Old Title')
    expect(result).toContain('Body here')
  })

  it('adds new fields to frontmatter', () => {
    const content = `---
title: Task
---
Body`
    const result = updateFrontmatter(content, { priority: 'high' })
    expect(result).toContain('title: Task')
    expect(result).toContain('priority: high')
  })
})
