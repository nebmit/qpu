import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ fetch }) => {
    const response = await fetch("/slides.html");

    if (!response.ok) {
        return new Response("Slide deck not found", { status: 404 });
    }

    return new Response(await response.text(), {
        headers: {
            "content-type": "text/html; charset=utf-8",
        },
    });
};
