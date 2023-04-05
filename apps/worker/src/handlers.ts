const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function handleResponse(
  request: Request,
  func: () => Promise<Response>
) {
  try {
    const response = await func();

    if (request.headers.get('Upgrade') !== 'websocket') {
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }

    return response;
  } catch (err) {
    const error = err as Error;
    console.error('handleResponse error', error);
    if (request.headers.get('Upgrade') == 'websocket') {
      // Annoyingly, if we return an HTTP error in response to a WebSocket request, Chrome devtools
      // won't show us the response body! So... let's send a WebSocket response with an error
      // frame instead.
      let pair = new WebSocketPair();
      pair[1].accept();
      pair[1].send(JSON.stringify({ error: error.stack }));
      pair[1].close(1011, 'Uncaught exception during session setup');
      return new Response(null, { status: 101, webSocket: pair[0] });
    } else {
      return new Response(error.stack, { status: 500 });
    }
  }
}
