import * as HEADERS from './headers';

export const Encoder = /* @__PURE__ */ new TextEncoder();
export const Decoder = /* @__PURE__ */ new TextDecoder();

// Common error codes' status text
export const STATUS_CODES: Record<string|number, string> = {
	"400": "Bad Request",
	"401": "Unauthorized",
	"403": "Forbidden",
	"404": "Not Found",
	"405": "Method Not Allowed",
	"411": "Length Required",
	"413": "Payload Too Large",
	"422": "Unprocessable Entity",
	"426": "Upgrade Required",
} as const;

/**
 * @see https://github.com/lukeed/worktop/blob/3187246b95d50c7b34f987b95e734a1dbcf2d778/src/internal/ws.ts#L4
 */
export function abort(code: number, message?: string) {
	message = message || STATUS_CODES[code];
	let length = Encoder.encode(message).byteLength;
	return new Response(message, {
		status: code,
		statusText: STATUS_CODES[code],
		headers: {
			'Connection': 'close',
			'Content-Type': 'text/plain',
			'Content-Length': String(length)
		}
	});
}

/**
 * Ensure the request HEADER values exist & match
 */
export function validate(req: Request, replicaid?: string) {
	let oid = req.headers.get(HEADERS.OBJECTID);
	if (oid == null) throw new Error('Missing: Replica ID');
	if (replicaid && oid !== replicaid) throw new Error('Mismatch: Replica ID');

	let gid = req.headers.get(HEADERS.GROUPID);
	if (gid == null) throw new Error('Missing: Group ID');

	let nid = req.headers.get(HEADERS.NEIGHBORID);
	let rid = req.headers.get(HEADERS.CLIENTID) || nid;
	if (rid == null) throw new Error('Missing: Request ID');

	let tid = req.headers.get(HEADERS.TARGETID);

	return { gid, rid, oid, tid };
}

export function setHeaders(request: Request, { objectId, requestId, groupId }: { objectId: DurableObjectId, requestId: string, groupId?: string }) {
	const replicaRequest = new Request(request);
	replicaRequest.headers.append(HEADERS.CLIENTID, requestId);
	replicaRequest.headers.append(HEADERS.OBJECTID, objectId.toString());
	replicaRequest.headers.append(HEADERS.GROUPID, groupId?.toString() ?? 'single');

	return replicaRequest;
}

/**
 * Helper to load a `DurableObjectId` & then get the Stub
 */
export function load(ns: DurableObjectNamespace, uid: string): DurableObjectStub {
	let doid = ns.idFromString(uid);
	return ns.get(doid);
}

type SocketHandler = (opts: { server: WebSocket, rid: string, gid: string }) => Promise<void>;
export async function handleConnection(req: Request, uid: string, handler: SocketHandler) {
		// @see https://datatracker.ietf.org/doc/rfc6455/?include_text=1
		// @see https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers
		if (req.method !== 'GET') return abort(405);

		let value = req.headers.get('upgrade');
		if (value !== 'websocket') return abort(426);

		value = (req.headers.get('sec-websocket-key') || '').trim();
		if (!/^[+/0-9A-Za-z]{22}==$/.test(value)) return abort(400);

		value = req.headers.get('sec-websocket-version');
		if (value !== '13') return abort(400);

		try {
			var { rid, gid } = validate(req, uid);
		} catch (err) {
			return abort(400, (err as Error).message);
		}

		const webSocketPair = new WebSocketPair();
  	const [client, server] = Object.values(webSocketPair);

  	(server as any).accept();

		try {
			await handler({ server, rid, gid });
		} catch (err) {
			console.error('ws connection handler', err);
			server.close(1011, 'Internal Server Error');
		}

		return new Response(null, {
			status: 101,
			statusText: 'Switching Protocols',
			webSocket: client,
		});
}
