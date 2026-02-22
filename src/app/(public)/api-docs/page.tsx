export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        API Documentation
      </h1>
      <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
        Programmatic access to your SEO data.
      </p>

      {/* ---- Authentication ---- */}
      <section id="authentication" className="mt-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Authentication
        </h2>
        <p className="mt-3 text-gray-700 dark:text-gray-300">
          All API requests require a valid API key. You can generate keys from your account
          settings. Include the key in every request using one of these methods:
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
          <pre>{`# Header approach (recommended)
curl -H "X-API-Key: dsk_your_key_here" \\
  https://app.doseo.io/api/v1/domains

# Bearer token approach
curl -H "Authorization: Bearer dsk_your_key_here" \\
  https://app.doseo.io/api/v1/domains`}</pre>
        </div>
        <p className="mt-3 text-gray-700 dark:text-gray-300">
          Keys use the <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm dark:bg-gray-800">dsk_</code> prefix.
          Treat them as secrets and never commit them to version control.
        </p>
      </section>

      {/* ---- Endpoints ---- */}
      <section id="endpoints" className="mt-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Endpoints
        </h2>

        {/* Domains */}
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            List domains
          </h3>
          <div className="mt-2 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
            <pre>{`GET /api/v1/domains?page=1&limit=20`}</pre>
          </div>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            Returns a paginated list of domains in your organization. Requires the{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm dark:bg-gray-800">domains:read</code> scope.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
            <pre>{`{
  "data": [
    { "id": "d_1", "domain": "example.com", "createdAt": "2025-01-15T10:00:00Z", "keywordCount": 42 }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20 }
}`}</pre>
          </div>
        </div>

        {/* Keywords */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            List keywords for a domain
          </h3>
          <div className="mt-2 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
            <pre>{`GET /api/v1/domains/:domainId/keywords?page=1&limit=20`}</pre>
          </div>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            Returns keywords tracked under a specific domain. Requires{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm dark:bg-gray-800">keywords:read</code>.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
            <pre>{`{
  "data": [
    {
      "id": "kw_1",
      "phrase": "best seo tools",
      "currentPosition": 5,
      "previousPosition": 8,
      "change": 3,
      "url": "https://example.com/seo-tools",
      "updatedAt": "2025-03-01T12:00:00Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20 }
}`}</pre>
          </div>
        </div>

        {/* Positions */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            List positions for a domain
          </h3>
          <div className="mt-2 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
            <pre>{`GET /api/v1/domains/:domainId/positions?page=1&limit=20`}</pre>
          </div>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            Returns position check results for a domain. Requires{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm dark:bg-gray-800">positions:read</code>.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
            <pre>{`{
  "data": [
    {
      "id": "pos_1",
      "keyword": "best seo tools",
      "position": 5,
      "url": "https://example.com/seo-tools",
      "checkedAt": "2025-03-01T12:00:00Z",
      "searchEngine": "google",
      "location": "United States"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20 }
}`}</pre>
          </div>
        </div>
      </section>

      {/* ---- Rate Limits ---- */}
      <section id="rate-limits" className="mt-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Rate Limits
        </h2>
        <p className="mt-3 text-gray-700 dark:text-gray-300">
          Each API key is limited to 100 requests per minute. When you exceed the limit
          you will receive a <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm dark:bg-gray-800">429</code> response.
          Wait until the current window expires and retry.
        </p>
      </section>

      {/* ---- Error Format ---- */}
      <section id="error-format" className="mt-12 pb-16">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Error Format
        </h2>
        <p className="mt-3 text-gray-700 dark:text-gray-300">
          All errors are returned as JSON with a consistent structure:
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
          <pre>{`{
  "error": {
    "code": "MISSING_API_KEY",
    "message": "Provide an API key via the X-API-Key header or Authorization: Bearer header."
  }
}`}</pre>
        </div>
        <p className="mt-3 text-gray-700 dark:text-gray-300">
          Common error codes:
        </p>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-4 font-medium text-gray-900 dark:text-white">HTTP Status</th>
              <th className="py-2 pr-4 font-medium text-gray-900 dark:text-white">Code</th>
              <th className="py-2 font-medium text-gray-900 dark:text-white">Description</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 dark:text-gray-300">
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2 pr-4">401</td>
              <td className="py-2 pr-4"><code>MISSING_API_KEY</code></td>
              <td className="py-2">No API key provided</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2 pr-4">401</td>
              <td className="py-2 pr-4"><code>INVALID_API_KEY</code></td>
              <td className="py-2">Key format is wrong or key not found</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2 pr-4">403</td>
              <td className="py-2 pr-4"><code>INSUFFICIENT_SCOPE</code></td>
              <td className="py-2">Key lacks the required scope</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">429</td>
              <td className="py-2 pr-4"><code>RATE_LIMIT_EXCEEDED</code></td>
              <td className="py-2">Too many requests in the current window</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
