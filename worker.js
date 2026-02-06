/**
 * Cloudflare Worker for labs.srirams.me routing
 * Routes /project-name/* to respective Cloudflare Pages/Workers deployments
 */

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // Project routing configuration
        const routes = {
            '/timecapsule': 'https://timecapsule-d3y.pages.dev',
            '/aic': 'https://b625b9d0.atlasincontext.pages.dev',
            // Add more projects here as you build them
            // '/project-name': 'https://your-deployment.pages.dev',
        };

        // Check if path matches any project route
        for (const [route, target] of Object.entries(routes)) {
            if (pathname === route || pathname.startsWith(route + '/')) {
                // Remove the project prefix and proxy to the actual deployment
                const targetPath = pathname.slice(route.length) || '/';
                const targetUrl = new URL(targetPath, target);

                // Copy search params
                targetUrl.search = url.search;

                // Create new request with modified URL
                const modifiedRequest = new Request(targetUrl, {
                    method: request.method,
                    headers: request.headers,
                    body: request.body,
                    redirect: 'manual',
                });

                // Fetch from target and return response
                const response = await fetch(modifiedRequest);

                // Clone response to modify headers
                const modifiedResponse = new Response(response.body, response);

                // Add CORS headers if needed (optional, remove if not needed)
                modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');

                return modifiedResponse;
            }
        }

        // If no route matches, return 404
        return new Response(
            JSON.stringify({
                error: 'Project not found',
                availableProjects: Object.keys(routes),
                message: `Visit https://labs.srirams.me for a list of available projects`,
            }),
            {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    },
};