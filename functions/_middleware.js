/**
 * Cloudflare Pages Function for routing lab projects
 * Place this file at: functions/_middleware.js
 * 
 * This intercepts ALL requests to labs.srirams.me and routes accordingly
 * Routes are dynamically fetched from srirams.me/labs-projects.json
 */

// Cache the routes in memory for 5 minutes to avoid fetching on every request
let routesCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

async function getRoutes() {
    const now = Date.now();

    // Return cached routes if still valid
    if (routesCache && (now - cacheTimestamp) < CACHE_DURATION) {
        return routesCache;
    }

    try {
        // Fetch the labs projects JSON
        const response = await fetch('https://srirams.me/labs-projects.json');

        if (!response.ok) {
            console.error('Failed to fetch labs-projects.json:', response.status);
            return routesCache || {}; // Return old cache or empty object
        }

        const projects = await response.json();

        // Build routes object from projects
        // We need pagesWorkerUrl field in the JSON for this to work
        const routes = {};
        for (const project of projects) {
            if (project.labUrl && project.pagesWorkerUrl) {
                routes[project.labUrl] = project.pagesWorkerUrl;
            }
        }

        // Update cache
        routesCache = routes;
        cacheTimestamp = now;

        return routes;
    } catch (error) {
        console.error('Error fetching routes:', error);
        return routesCache || {}; // Return old cache or empty object
    }
}

export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Get routes (from cache or fetch)
    const routes = await getRoutes();

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

            // Clone response to modify headers if needed
            return new Response(response.body, response);
        }
    }

    // If no route matches, continue to next middleware/page
    // This allows index.html to be served normally
    return context.next();
}