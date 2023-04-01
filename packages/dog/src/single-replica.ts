import * as utils from './internal/utils';
import type { RequestID, SingleSocket, SingleSocketEvent, ReplicaMessage } from './types';

type SingleState = {
	uid: string;
	socket: Set<WebSocket>;
};

type Pool = Map<RequestID, SingleState>;

// internal : send message to all websockets
function send(conns: Set<WebSocket>, msg: string) {
	for (let ws of conns) ws.send(msg);
}

export abstract class SingleReplica implements SingleReplica {
	public abstract maxUsers: number;
	public maxSockets: number = 5;

	public readonly uid: string;

	readonly pool: Pool;

	constructor(state: DurableObjectState) {
		this.uid = state.id.toString();
		this.pool = new Map;
	}

	/**
	 * Receive the HTTP request.
	 * @NOTE User must call `this.connect` for WS connection.
	 * @NOTE User-supplied logic/function.
	 */
	abstract receive(req: Request): Promise<Response> | Response;

	// This request has connected via WS
	onopen?(state: SingleSocketEvent): Promise<void> | void;

	// A message was received
	onmessage?(state: SingleSocketEvent, data: string): Promise<void> | void;

	// The connection was closed
	onclose?(state: SingleSocketEvent): Promise<void> | void;

	// The connection closed due to error
	onerror?(state: SingleSocketEvent): Promise<void> | void;

	/**
	 * Handle the WS connection upgrade
	 * @todo maybe can only be 400 code?
	 * @modified worktop/ws
	 */
	async connect(req: Request): Promise<Response> {
		return utils.handleConnection(
			req,
			this.uid,
			async ({ server, rid }) => {
				let state: SingleState = this.pool.get(rid) || {
					uid: this.uid,
					socket: new Set,
				};

				const isNew = !this.pool.has(rid);
				if (isNew && this.pool.size >= this.maxUsers || state.socket.size >= this.maxSockets) {
					server.close(4001, `Too many connections`);
					return;
				}

				const socket: SingleSocket = {
					rid: rid,
					send: server.send.bind(server),
					close: server.close.bind(server),
					broadcast: this.#broadcast.bind(this, rid),
					whisper: this.#whisper.bind(this, rid),
				};

				const event: SingleSocketEvent = {
					rid,
					socket
				};

				let closer = async (evt: Event) => {
					try {
						if (evt.type === 'error' && this.onerror) await this.onerror(event);
						else if (this.onclose) await this.onclose(event);
					} finally {
						let state = this.pool.get(rid);

						if (!state || state.socket.size < 2) {
							this.pool.delete(rid);
						} else {
							state.socket.delete(server);
							this.pool.set(rid, state);
						}

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
						this.onmessage!(event, evt.data);
					});
				}

				state.socket.add(server);
				this.pool.set(rid, state);

				if (this.onopen) {
					await this.onopen(event);
				}
			}
		);
	}

	/**
	 * Receive a request from Group node
	 */
	async fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
		let request = new Request(input, init);

		try {
			return await this.receive(request);
		} catch (err) {
			let stack = (err as Error).stack;
			return utils.abort(400, stack || 'Error in `receive` method');
		}
	}

	broadcast(msg: ReplicaMessage): Promise<void> {
		return this.#broadcast(this.uid, msg, true);
	}

	whisper(target: string, msg: ReplicaMessage): Promise<void> {
		return this.#whisper(this.uid, target, msg);
	}

	/**
	 * Share a message across ALL replicas within group
	 */
	async #broadcast(sender: RequestID, msg: ReplicaMessage, self?: boolean): Promise<void> {
		let res = typeof msg === 'object' ? JSON.stringify(msg) : msg;

		for (let [rid, state] of this.pool) {
			if (self || rid !== sender) send(state.socket, res);
		}
	}

	/**
	 * Send a Message to a specific Socket within a REPLICA.
	 */
	async #whisper(sender: RequestID, target: RequestID, msg: ReplicaMessage): Promise<void> {
		if (sender === target) return;

		let body = typeof msg === 'object'
			? JSON.stringify(msg)
			: msg;

		let state = this.pool.get(target);
		if (state) return send(state.socket, body);
	}
}
