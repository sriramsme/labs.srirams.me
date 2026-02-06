/**
 * DEBUG VERSION of Cloudflare Pages Function for routing lab projects
 * Place this file at: functions/_middleware.js
 * 
 * This version includes detailed logging to help diagnose routing issues
 */

// Cache the routes in memory for 5 minutes to avoid fetching on every request
let routesCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

async function getRoutes() {
    const now = Date.now();

    // Return cached routes if still valid
    if (routesCache && (now - cacheTimestamp) < CACHE_DURATION) {
        console.log('Using cached routes:', routesCache);
        return routesCache;
    }

    try {
        console.log('Fetching routes from https://srirams.me/labs-projects.json');

        // Fetch the labs projects JSON
        const response = await fetch('https://srirams.me/labs-projects.json');

        if (!response.ok) {
            console.error('Failed to fetch labs-projects.json:', response.status);
            return routesCache || {}; // Return old cache or empty object
        }

        const projects = await response.json();
        console.log('Fetched projects:', JSON.stringify(projects, null, 2));

        // Build routes object from projects
        const routes = {};
        for (const project of projects) {
            if (project.labUrl && project.pagesWorkerUrl) {
                routes[project.labUrl] = project.pagesWorkerUrl;
                console.log(`Added route: ${project.labUrl} -> ${project.pagesWorkerUrl}`);
            } else {
                console.warn('Skipping project (missing labUrl or pagesWorkerUrl):', project.title);
            }
        }

        console.log('Final routes object:', routes);

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

    console.log(`Incoming request: ${pathname}`);

    // Get routes (from cache or fetch)
    const routes = await getRoutes();

    console.log('Available routes:', Object.keys(routes));

    // Check if path matches any project route
    for (const [route, target] of Object.entries(routes)) {
        if (pathname === route || pathname.startsWith(route + '/')) {
            console.log(`Route matched! ${route} -> ${target}`);

            // Remove the project prefix and proxy to the actual deployment
            const targetPath = pathname.slice(route.length) || '/';
            const targetUrl = new URL(targetPath, target);

            // Copy search params
            targetUrl.search = url.search;

            console.log(`Proxying to: ${targetUrl.toString()}`);

            // Create new request with modified URL
            const modifiedRequest = new Request(targetUrl, {
                method: request.method,
                headers: request.headers,
                body: request.body,
                redirect: 'manual',
            });

            // Fetch from target and return response
            const response = await fetch(modifiedRequest);

            console.log(`Response status: ${response.status}`);

            // Clone response to modify headers if needed
            return new Response(response.body, response);
        }
    }

    console.log('No route matched, continuing to static assets');

    // If no route matches, continue to next middleware/page
    // This allows index.html to be served normally
    return context.next();
}