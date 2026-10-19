import marketplace from '../server/marketplace.cjs';
import pages from '../server/public-pages.cjs';
const handlePublic = pages.createPublicHandler();
const handle = marketplace.createMarketplaceHandler();
export default async function handler(request, response) {
  const url = new URL(request.url, `https://${request.headers.host || 'localhost'}`);
  // Explicit rewrite parameter works whether Vercel exposes the original or rewritten URL.
  const route = url.searchParams.get('__marketplace_path');
  if (route !== null) url.pathname = `/api/${route}`;
  url.searchParams.delete('__marketplace_path');
  const publicPath = url.searchParams.get('__public_path');
  if (publicPath !== null) url.pathname = '/' + publicPath;
  url.searchParams.delete('__public_path');
  if (!(await handlePublic(request, response, url)) && !(await handle(request, response, url))) {
    response.statusCode = 404;
    response.end('Not found');
  }
}
