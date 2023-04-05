import { Env } from "./env";

export class GameManager {
	constructor(
		private state: DurableObjectState,
		private env: Env
	) {}
}
