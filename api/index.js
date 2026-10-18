import marketplace from '../server/marketplace.cjs';
const handle = marketplace.createMarketplaceHandler();
export default async function handler(request, response) {
  const url = new URL(request.url, `https://${request.headers.host || 'localhost'}`);
  // Explicit rewrite parameter works whether Vercel exposes the original or rewritten URL.
  const route = url.searchParams.get('__marketplace_path');
  if (route !== null) url.pathname = `/api/${route}`;
  url.searchParams.delete('__marketplace_path');
  if (!(await handle(request, response, url))) {
    response.statusCode = 404;
    response.end('Not found');
  }
}
