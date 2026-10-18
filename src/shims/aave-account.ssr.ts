/**
 * Server-only stand-in for `@aave/account` (pulled in by ConnectKit).
 * The real package bundles post-robot, which starts timers at module load —
 * forbidden in the Worker's global scope and crashes every SSR request.
 * Wallet connectors only run in the browser, so the server never calls these.
 */
const unavailable = () => {
  throw new Error("Aave account connector is only available in the browser.");
};

export const aaveAccountConnector = (..._args: unknown[]) => unavailable;
export const aaveAccountCustomActions = {};
export const createAaveAccountClient = unavailable;
export const AaveAccountSdk = class {};
export const EthereumProvider = class {};
export class EthereumProviderConnectionTimeoutError extends Error {}
export const CommunicationTypes = {};
export const SessionCreateResult = {};
export const SessionStatus = {};
export const UsernameType = {};
export const production = {};
export default {};
