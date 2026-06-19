# Architecture Report

### Summary and Explanation

This code snippet is part of a GitHub client service that handles HTTP requests to the GitHub API. It uses a fetch implementation (either `globalThis.fetch` or a fallback from the `undici` library) for making requests, with retry logic based on error conditions like rate limits and network errors.

#### Key Components:

1. **Fetch Implementation:**
   - The function `getFetch()` checks if a global `fetch` is available. If not, it attempts to use `undici.fetch`. Throws an error if neither is found.

2. **Response Normalization:**
   - `_normalizeResponse(res)` normalizes the response object to include `ok`, `status`, `headers`, and methods for parsing `json`, `text`, and `arrayBuffer`.

3. **Retry Logic:**
   - The function `fetchWithRetry(url, options = {}, retryOpts = {})` handles retries based on HTTP status codes (429 for rate limits, 500-600 for server errors) or network issues.
   - It includes logic to handle timeouts and aborts by setting up a timeout with an AbortController.

4. **Logging:**
   - The function logs events like request start, retry, and failure using the `onEvent` callback if provided.

5. **Rate Limit Handling:**
   - If the response indicates a rate limit (HTTP 429), it calculates the delay based on the `retry-after` header or a default exponential backoff strategy.
   
6. **Error Handling:**
   - It handles various error scenarios, including network errors and aborts, by retrying with an increased delay.

7. **UUID Generation:**
   - Uses `crypto.randomUUID` if available for generating unique request IDs; otherwise, uses a simple timestamp-based ID.

#### Example Usage:

```javascript
const client = require('./services/githubClient');

async function main() {
  const result = await client.fetchWithRetry('https://api.github.com/user/repos', {
    headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}` },
    retryOpts: {
      retries: 5,
      timeout: 10000,
      backoffBase: 1000,
      onRetry: (retryInfo) => console.log(`Retrying due to ${retryInfo.reason} after ${retryInfo.delay}ms`),
      onEvent: (event) => console.log(event)
    }
  });

  if (result.ok) {
    console.log(result.json());
  } else {
    console.error('Request failed:', result.status, result.headers.get('Retry-After'));
  }
}

main();
```

This function can be used to make a request to the GitHub API with retries and proper logging. Adjustments can be made for specific use cases by changing the retry options or handling different HTTP statuses appropriately.

Would you like me to explain any part of this code in more detail?