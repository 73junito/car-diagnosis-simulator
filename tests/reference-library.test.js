const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'curriculum-references.js'), 'utf8')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const html = fs.readFileSync(path.join(root, 'reference-library', 'index.html'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'reference-library', 'library.js'), 'utf8')
const student = fs.readFileSync(path.join(root, 'dashboard', 'student', 'index.html'), 'utf8')
const instructor = fs.readFileSync(path.join(root, 'dashboard', 'instructor', 'index.html'), 'utf8')

describe('G14 governed Reference Library', () => {
  test('reuses the production curriculum references boundary', () => {
    expect(worker).toContain("app.get('/api/curriculum/references', handleCurriculumReferences)")
    expect(ui).toContain('/api/curriculum/references')
  })

  test('default learner audience remains student-only', () => {
    expect(route).toContain("const audience = cleanQuery(c.req.query('audience'), 20) || 'student'")
    expect(route).toContain("sourceQuery.eq('audience', 'student')")
  })

  test('instructor audience is server-authorized before internal guidance is visible', () => {
    expect(route).toContain("if (audience === 'instructor')")
    expect(route).toContain('authorizeInstructorAudience')
    expect(route).toContain('verifySupabaseToken')
    expect(route).toContain('resolveTrustedRole')
    expect(route).toContain('isInstructorOrAdminRole')
    expect(route).toContain("sourceQuery.in('audience', ['student', 'internal'])")
    expect(route).toContain("Instructor access required")
  })

  test('mapped learning-path behavior remains distinct from full library mode', () => {
    expect(route).toContain("const view = cleanQuery(c.req.query('view'), 20) || 'mapped'")
    expect(route).toContain("const libraryMode = view === 'library'")
    expect(route).toContain("if (!libraryMode)")
    expect(route).toContain("sourceQuery = sourceQuery.in('id', mappedReferenceIds)")
  })

  test('rights filters use explicit recorded permissions', () => {
    expect(route).toContain("rights === 'link-only'")
    expect(route).toContain(".eq('citation_link_allowed', true)")
    expect(route).toContain(".eq('direct_reproduction_allowed', false)")
    expect(route).toContain(".eq('database_storage_allowed', false)")
    expect(route).toContain(".eq('ai_rag_ingestion_allowed', false)")
    expect(route).toContain("rights === 'rag-allowed'")
    expect(route).toContain("rights === 'storage-allowed'")
    expect(route).toContain("rights === 'reproduction-allowed'")
  })

  test('reference API is read-only and does not perform RAG or content storage', () => {
    expect(route).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/)
    expect(route).not.toContain('source_chunks')
    expect(route).not.toContain('embedding')
    expect(route).not.toContain('vector')
  })

  test('library UI renders rights rather than inferring reuse permission', () => {
    expect(ui).toContain("['Citation/link', r.citationLinkAllowed]")
    expect(ui).toContain("['Direct reproduction', r.directReproductionAllowed]")
    expect(ui).toContain("['Database storage', r.databaseStorageAllowed]")
    expect(ui).toContain("['AI/RAG ingestion', r.aiRagIngestionAllowed]")
    expect(ui).toContain("source.rights?.citationLinkAllowed===true")
    expect(ui).toContain('Link-only: do not store or ingest into AI/RAG.')
  })

  test('library never downloads or displays source body content', () => {
    expect(ui).not.toContain('innerHTML')
    expect(ui).not.toContain('fetch(source.canonicalUrl')
    expect(ui).not.toContain('source.content')
    expect(html).toContain('a link being available does not mean the platform may store, reproduce, or ingest that source into AI systems')
  })

  test('search input is sanitized before PostgREST OR filter construction', () => {
    expect(route).toContain('function cleanSearchTerm')
    expect(route).toContain("return cleanQuery(value).replace(/[^A-Za-z0-9\\s\\-.:/]/g, '').trim()")
  })

  test('curriculum CORS allows Authorization without widening origin allowlist', () => {
    const block = worker.match(/app\.use\('\/api\/curriculum\/\*'[\s\S]{0,420}/)
    expect(block).not.toBeNull()
    expect(block[0]).toContain("'https://app.autolearnpro.com'")
    expect(block[0]).toContain("'https://exam.autolearnpro.com'")
    expect(block[0]).toContain("allowHeaders: ['Content-Type', 'Authorization']")
    expect(block[0]).not.toContain("origin: '*'")
  })

  test('student and instructor workspaces link to the shared library', () => {
    expect(student).toContain('href="/reference-library/"')
    expect(instructor).toContain('href="/reference-library/?audience=instructor"')
    expect(ui).toContain("requestedAudience==='instructor'")
  })

  test('governance response explicitly preserves storage/RAG boundaries', () => {
    expect(route).toContain('linkOnlySourcesRemainLinkOnly: true')
    expect(route).toContain('databaseStorageRequiresExplicitRight: true')
    expect(route).toContain('aiRagIngestionRequiresExplicitRight: true')
  })
})
