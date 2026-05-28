import { z } from "zod";

export const chatBodySchema = z.object({
  sessionId: z.string().min(1).max(200),
  message: z.string().min(1).max(10000),
  userAddress: z.string().min(1).max(200).optional(),
});

export const configureBodySchema = z.object({
  sessionId: z.string().min(1).max(200),
  riskTier: z.number().int().min(0).max(2),
});

export const pauseBodySchema = z.object({
  sessionId: z.string().min(1).max(200),
});

export const closePositionBodySchema = z.object({
  userAddress: z.string().optional(),
  position: z.string().min(1).max(200),
});

export const closePerpBodySchema = z.object({
  userAddress: z.string().optional(),
  coin: z.string().min(1).max(50),
});

export const statusQuerySchema = z.object({
  sessionId: z.string().min(1).max(200),
  userAddress: z.string().optional(),
});

export const walletQuerySchema = z.object({
  userAddress: z.string().optional(),
});

export const portfolioQuerySchema = z.object({
  userAddress: z.string().optional(),
});

// --- LLM Tool Argument Schemas ---

export const toolPoolsListSchema = z.object({});

export const toolPoolInfoSchema = z.object({
  poolAddress: z.string().min(1, "poolAddress is required"),
});

export const toolCheckBalanceSchema = z.object({});

export const toolExecuteSwapSchema = z.object({
  inputMint: z.string().min(1, "inputMint is required"),
  outputMint: z.string().min(1, "outputMint is required"),
  amount: z.union([z.string(), z.number()]).refine((v) => Number(v) > 0, "amount must be positive"),
  dryRun: z.boolean().optional(),
});

export const toolOpenPositionSchema = z.object({
  pool: z.string().min(1, "pool is required"),
  priceLower: z.union([z.string(), z.number()]).refine((v) => Number(v) > 0, "priceLower must be positive"),
  priceUpper: z.union([z.string(), z.number()]).refine((v) => Number(v) > 0, "priceUpper must be positive"),
  amount: z.union([z.string(), z.number()]).refine((v) => Number(v) > 0, "amount must be positive"),
});

export const toolOpenPerpSchema = z.object({
  side: z.enum(["buy", "sell"], { message: "side must be 'buy' or 'sell'" }),
  size: z.union([z.string(), z.number()]).refine((v) => Number(v) > 0, "size must be positive"),
  coin: z.string().min(1, "coin is required"),
  tp: z.union([z.string(), z.number()]).optional(),
  sl: z.union([z.string(), z.number()]).optional(),
});

export const toolClosePositionSchema = z.object({
  position: z.string().min(1, "position is required"),
});

export const toolClosePerpSchema = z.object({
  coin: z.string().min(1, "coin is required"),
});

export const toolListPositionsSchema = z.object({});

export const toolGetPortfolioSchema = z.object({});

export const toolGetWalletAddressSchema = z.object({
  userAddress: z.string().optional(),
});

export const toolSchemas: Record<string, z.ZodTypeAny> = {
  pools_list: toolPoolsListSchema,
  pool_info: toolPoolInfoSchema,
  check_balance: toolCheckBalanceSchema,
  execute_swap: toolExecuteSwapSchema,
  open_position: toolOpenPositionSchema,
  open_perp: toolOpenPerpSchema,
  close_position: toolClosePositionSchema,
  close_perp: toolClosePerpSchema,
  list_positions: toolListPositionsSchema,
  get_portfolio: toolGetPortfolioSchema,
  get_wallet_address: toolGetWalletAddressSchema,
};
