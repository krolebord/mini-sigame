declare namespace JSON {
	type Value = Date | RegExp | string | number | boolean | null | JSON.Object;
	type Object = JSON.Value[] | { [key: string]: JSON.Value };
}

export type ReplicaMessage = JSON.Object | string;

export type RequestID = string;
export type GroupID = string;
export type ReplicaID = string;

export namespace Gossip {
	export type Message = {
		[key: string]: JSON.Value;
	};
	export type Payload = JSON.Object | JSON.Value;
}

export interface BaseSocket {
	/**
	 * The request identifier.
	 * @see {Group.identify}
	 */
	rid: string;
	/**
	 * Send the WebSocket client a string-serializable message.
	 */
	send: WebSocket['send'];
	/**
	 * Close the WebSocket connection.
	 */
	close: WebSocket['close'];

}

export interface SingleSocket extends BaseSocket {
	/**
	 * Send a message to ALL WebSockets within the CLUSTER.
	 * @param {boolean} [self] Send the message to the sender?
	 */
	broadcast(msg: ReplicaMessage, self?: boolean): Promise<void>;
	/**
	 * Send a message to a specific WebSocket target.
	 */
	whisper(target: string, msg: ReplicaMessage): Promise<void>;
}

export interface SingleSocketEvent {
	rid: string;
	socket: SingleSocket;
}

export interface Socket extends BaseSocket {
	/**
	 * Send a message to other WebSockets owned by the Replica.
	 * @param {boolean} [self] Send the message to the sender?
	 */
	emit(msg: ReplicaMessage, self?: boolean): void;
	/**
	 * Send a message to ALL WebSockets within the CLUSTER.
	 * @param {boolean} [self] Send the message to the sender?
	 */
	broadcast(msg: ReplicaMessage, self?: boolean): Promise<void>;
	/**
	 * Send a message to a specific WebSocket target.
	 */
	whisper(target: string, msg: ReplicaMessage): Promise<void>;
}

export interface ReplicaBase {
	readonly uid: string;

	receive(req: Request): Promise<Response> | Response;

	/**
	 * Handle the WS connection upgrade.
	 */
	connect(req: Request): Promise<Response>;

	/**
	 * Receives a request from a Group object.
	 * @IMPORTANT Do NOT define your own `fetch` method!
	 */
	fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
}

export interface SingleReplica extends ReplicaBase {
	maxUsers: number;
	maxSockets: number;

	/** The WebSocket client connection was established. */
	onopen?(state: SingleSocketEvent): Promise<void> | void;
	/** The WebSocket client was closed. */
	onclose?(state: SingleSocketEvent): Promise<void> | void;
	/** The WebSocket client was closed due to an error. */
	onerror?(state: SingleSocketEvent): Promise<void> | void;
	/** The WebSocket client sent the Replica a message. */
	onmessage?(state: SingleSocketEvent, data: string): Promise<void> | void;

	/**
	 * Send a message to ALL WebSockets within the replica.
	 */
	broadcast(msg: ReplicaMessage): Promise<void>;

	/**
	 * Send a message to a specific WebSocket target.
	 */
	whisper(target: string, msg: ReplicaMessage): Promise<void>;
}

export interface Replica<T> extends ReplicaBase {
	/**
	 * Specify which `Group` class is the target.
	 * @NOTE User-supplied logic/function.
	 */
	link(bindings: T): {
		parent: DurableObjectNamespace & Group<T>;
		self: DurableObjectNamespace & Replica<T>;
	};

	/** The WebSocket client connection was established. */
	onopen?(socket: Socket): Promise<void> | void;
	/** The WebSocket client was closed. */
	onclose?(socket: Socket): Promise<void> | void;
	/** The WebSocket client was closed due to an error. */
	onerror?(socket: Socket): Promise<void> | void;
	/** The WebSocket client sent the Replica a message. */
	onmessage?(socket: Socket, data: string): Promise<void> | void;

	/**
	 * Send a message (via HTTP) to ALL WebSockets within the CLUSTER.
	 * @NOTE This is the HTTP-accessible version of `Socket.broadcast`
	 */
	broadcast(msg: ReplicaMessage): Promise<void>;

	/**
	 * Send a message (via HTTP) to a specific WebSocket target.
	 * @NOTE This is the HTTP-accessible version of `Socket.whisper`
	 */
	whisper(target: string, msg: ReplicaMessage): Promise<void>;

	/**
	 * Send a message (via HTTP) to WebSockets owned by the Replica
	 * @NOTE This is the HTTP-accessible version of `Socket.emit`
	 */
	emit(msg: ReplicaMessage): void;

	/**
	 * Respond to another Replica's gossip.
	 * @NOTE Must return a JSON-serializable value.
	 */
	ongossip?(msg: Gossip.Message): Promise<Gossip.Payload> | Gossip.Payload;

	/**
	 * Send a message directly to other Replicas.
	 * A `Gossip.Message` must be a JSON object.
	 * Returns a list of `Gossip.Payload`s, one from each Replica sibling.
	 * @NOTE Peer-to-peer communication; does not involve client connections.
	 */
	gossip<M extends Gossip.Message>(msg: M): Promise<Gossip.Payload[]>;
}

export interface Group<T> {
	limit: number;
	readonly uid: string;

	/**
	 * Generate a `DurableObjectId` for the Replica cluster.
	 * @default target.newUniqueId()
	 */
	clusterize(req: Request, target: DurableObjectNamespace): Promise<DurableObjectId> | DurableObjectId;

	/**
	 * Receive the HTTP request if not an internal route.
	 * @NOTE Unlike `Replica.receive`, this is optionally defined.
	 *       Useful for supply custom routing/handler logic if the
	 *       incoming `Request` was not significant to the DOG.
	 * @default utils.abort(404)
	 */
	receive(req: Request): Promise<Response> | Response;

	/**
	 * Receives the initial request & figures out where to send it.
	 * @NOTE User should NOT redeclare/override this method.
	 */
	fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
}

export interface Family<T> {
	parent: DurableObjectNamespace & Group<T>;
	child: DurableObjectNamespace & Replica<T>;
}
