import * as utils from './internal/utils';
import * as ROUTES from './internal/routes';
import * as HEADERS from './internal/headers';
import type { RequestID, ReplicaMessage, ReplicaID, Group, Socket, Gossip } from './types';

// ---

export interface State {
	group: string;
	socket: Set<WebSocket>;
}

type Pool = Map<RequestID, State>;

interface Dispatch {
	group: string;
	sender: string;
	target?: string;
	route: string;
	body: string;
}

// internal : send message to all websockets
function send(conns: Set<WebSocket>, msg: string) {
	for (let ws of conns) ws.send(msg);
}

export abstract class Replica<T> implements Replica<T> {
	public readonly uid: string;

	readonly #pool: Pool;
	readonly #neighbors: Set<ReplicaID>;
	readonly #parent: DurableObjectNamespace;
	readonly #self: DurableObjectNamespace;

	#gid?: string;

	constructor(state: DurableObjectState, env: T) {
		this.uid = state.id.toString();
		this.#neighbors = new Set;
		this.#pool = new Map;

		let refs = this.link(env);
		this.#parent = refs.parent;
		this.#self = refs.self;
	}

	/**
	 * Specify Durable Object relationships.
	 * @NOTE User-supplied logic/function.
	 */
	abstract link(bindings: T): {
		parent: DurableObjectNamespace & Group<T>;
		self: DurableObjectNamespace & Replica<T>;
	};

	/**
	 * Receive the HTTP request.
	 * @NOTE User must call `this.connect` for WS connection.
	 * @NOTE User-supplied logic/function.
	 */
	abstract receive(req: Request): Promise<Response> | Response;

	// This request has connected via WS
	onopen?(socket: Socket): Promise<void> | void;

	// A message was received
	onmessage?(socket: Socket, data: string): Promise<void> | void;

	// The connection was closed
	onclose?(socket: Socket): Promise<void> | void;

	// The connection closed due to error
	onerror?(socket: Socket): Promise<void> | void;

	/**
	 * Handle the WS connection upgrade
	 * @todo maybe can only be 400 code?
	 * @modified worktop/ws
	 */
	async connect(req: Request): Promise<Response> {
		return utils.handleConnection(
			req,
			this.uid,
			async ({ server, rid, gid }) => {
				let socket: Socket = {
					rid: rid,
					send: server.send.bind(server),
					close: server.close.bind(server),
					broadcast: this.#broadcast.bind(this, gid, rid),
					whisper: this.#whisper.bind(this, gid, rid),
					emit: this.#emit.bind(this, rid),
				};

				let closer = async (evt: Event) => {
					try {
						if (evt.type === 'error' && this.onerror) await this.onerror(socket);
						else if (this.onclose) await this.onclose(socket);
					} finally {
						let state = this.#pool.get(rid);
						let isEmpty: boolean;

						if (!state || state.socket.size < 2) {
							this.#pool.delete(rid);
							isEmpty = true;
						} else {
							state.socket.delete(server);
							this.#pool.set(rid, state);
							isEmpty = false;
						}

						await this.#close(rid, gid, isEmpty);

						try {
							server.close();
						} catch (e) {
							// already closed
						}
					}
				}

				server.addEventListener('close', closer);
				server.addEventListener('error', closer);

				if (this.onmessage) {
					server.addEventListener('message', evt => {
						this.onmessage!(socket, evt.data);
					});
				}

				if (this.onopen) {
					await this.onopen(socket);
				}

				let state: State = this.#pool.get(rid) || {
					group: gid,
					socket: new Set,
				};

				state.socket.add(server);
				this.#pool.set(rid, state);
			}
		);
	}

	// Gossip handler; respond to Gossip from another REPLICA instance.
	ongossip?(msg: Gossip.Message): Promise<Gossip.Payload> | Gossip.Payload

	/**
	 * Share some Gossip to REPLICA's neighbors.
	 * Neighboring REPLICAs respond to gossip directly; via `ongossip`.
	 * AKA, REPLICA to REPLICA communication.
	 */
	async gossip(msg: Gossip.Message): Promise<Gossip.Payload[]> {
		if (this.#neighbors.size < 1) return [];

		let list = await this.#dispatch({
			group: this.#gid!,
			sender: this.uid, // this replica
			route: ROUTES.GOSSIP,
			body: msg == null ? msg : JSON.stringify(msg)
		});

		// TS enforce `JSON` payloads
		return Promise.all(list!.map(r => r.json())) as Promise<Gossip.Payload[]>;
	}

	/**
	 * Receive a request from Group node
	 */
	async fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
		let request = new Request(input, init);

		try {
			var { pathname } = new URL(request.url, 'foo://');
			var { rid, gid, tid } = utils.validate(request, this.uid);
		} catch (err) {
			return utils.abort(400, (err as Error).message);
		}

		if (pathname === ROUTES.NEIGHBOR) {
			this.#gid = this.#gid || gid; // save
			// rid === HEADERS.NEIGHBORID
			this.#neighbors.add(rid);
			return new Response;
		}

		if (pathname === ROUTES.BROADCAST) {
			try {
				this.#emit(rid, await request.text());
				return new Response;
			} catch (err) {
				let msg = (err as Error).stack;
				return utils.abort(400, msg || 'Error parsing broadcast message');
			}
		}

		if (pathname === ROUTES.WHISPER) {
			try {
				if (!tid) throw new Error('Missing: Target ID');

				let state = this.#pool.get(tid);
				if (state) send(state.socket, await request.text());

				return new Response;
			} catch (err) {
				let msg = (err as Error).stack;
				return utils.abort(400, msg || 'Error parsing whisper message');
			}
		}

		if (pathname === ROUTES.GOSSIP) {
			try {
				if (!this.ongossip) throw new Error('Missing: `ongossip` handler');
				let payload = await this.ongossip(await request.json());
				let body = payload == null ? null : JSON.stringify(payload);
				let headers = { 'Content-Type': 'application/json' };
				return new Response(body, { headers });
			} catch (err) {
				let msg = (err as Error).stack;
				return utils.abort(400, msg || 'Error while gossiping');
			}
		}

		let res: Response;

		try {
			return res = await this.receive(request);
		} catch (err) {
			let stack = (err as Error).stack;
			return res = utils.abort(400, stack || 'Error in `receive` method');
		} finally {
			if (res!.status !== 101) {
				await this.#close(rid, gid, true);
			}
		}
	}

	emit(msg: ReplicaMessage): void {
		this.#emit(this.#gid!, msg, true);
	}

	broadcast(msg: ReplicaMessage): Promise<void> {
		return this.#broadcast(this.#gid!, this.uid, msg, true);
	}

	whisper(target: string, msg: ReplicaMessage): Promise<void> {
		return this.#whisper(this.#gid!, this.uid, target, msg);
	}

	/**
	 * Share a message ONLY with this REPLICA's connections
	 */
	#emit(sender: RequestID, msg: ReplicaMessage | string, self?: boolean): void {
		let res = typeof msg === 'object' ? JSON.stringify(msg) : msg;

		for (let [rid, state] of this.#pool) {
			if (self || rid !== sender) send(state.socket, res);
		}
	}

	/**
	 * Share a message across ALL replicas within group
	 */
	async #broadcast(group: string, sender: RequestID, msg: ReplicaMessage, self?: boolean): Promise<void> {
		let body = typeof msg === 'object'
			? JSON.stringify(msg)
			: msg;

		this.#emit(sender, body, self);

		await this.#dispatch({
			group, sender, body,
			route: ROUTES.BROADCAST,
		});
	}

	/**
	 * Construct & send a message to REPLICA neighbors.
	 */
	async #dispatch(params: Dispatch): Promise<Response[] | void> {
		let list = [...this.#neighbors];
		if (list.length < 1) return;

		let commons: HeadersInit = {
			[HEADERS.NEIGHBORID]: this.uid,
			[HEADERS.GROUPID]: params.group,
			[HEADERS.CLIENTID]: params.sender,
		};

		if (params.target) {
			commons[HEADERS.TARGETID] = params.target;
		}

		let url = new URL(params.route, 'http://dog');

		return Promise.all(
			list.map(sid => {
				let stub = utils.load(this.#self, sid);
				let headers = new Headers(commons);
				headers.set(HEADERS.OBJECTID, sid);
				return stub.fetch(url.href, {
					method: 'POST',
					headers: headers,
					body: params.body,
				});
			})
		);
	}

	/**
	 * Send a Message to a specific Socket within a REPLICA.
	 */
	async #whisper(group: string, sender: RequestID, target: RequestID, msg: ReplicaMessage): Promise<void> {
		if (sender === target) return;

		let body = typeof msg === 'object'
			? JSON.stringify(msg)
			: msg;

		let state = this.#pool.get(target);
		if (state) return send(state.socket, body);

		await this.#dispatch({
			group, sender, target, body,
			route: ROUTES.WHISPER
		});
	}

	/**
	 * Tell relevant Group object to -1 its count
	 */
	async #close(rid: RequestID, gid: string, isEmpty: boolean) {
		let headers = new Headers;
		headers.set(HEADERS.GROUPID, gid);
		headers.set(HEADERS.OBJECTID, this.uid);
		headers.set(HEADERS.CLIENTID, rid);
		headers.set(HEADERS.ISEMPTY, isEmpty ? '1' : '0');

		// Prepare internal request
		// ~> notify Group of -1 count
		let url = new URL(ROUTES.CLOSE, 'http://dog');
		let group = utils.load(this.#parent, gid);
		await group.fetch(url.href, { headers });
	}
}
