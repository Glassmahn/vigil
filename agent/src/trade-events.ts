import { EventEmitter } from "events";

export const tradeEvents = new EventEmitter();
tradeEvents.setMaxListeners(50);

export interface TradeEvent {
  action: string;
  success: boolean;
  pnl: number;
  value: number;
  userAddress?: string;
  timestamp: number;
  pool: string;
}
