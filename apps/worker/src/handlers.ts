export async function handleErrors(request: Request, func: () => Promise<Response>) {
  try {
    return await func();
  } catch (err) {
    const error = err as Error;
    if (request.headers.get("Upgrade") == "websocket") {
      // Annoyingly, if we return an HTTP error in response to a WebSocket request, Chrome devtools
      // won't show us the response body! So... let's send a WebSocket response with an error
      // frame instead.
      let pair = new WebSocketPair();
      pair[1].accept();
      pair[1].send(JSON.stringify({ error: error.stack }));
      pair[1].close(1011, "Uncaught exception during session setup");
      console.error(error.stack);
      return new Response(null, { status: 101, webSocket: pair[0] });
    } else {
      return new Response(error.stack, {status: 500});
    }
  }
}
