export type RiskTier = 0 | 1 | 2;

export interface RiskProfile {
  tier: RiskTier;
  label: "Safe" | "Balanced" | "Aggressive";
  score: number;
  maxDrawdown: number;
  preferredStrategies: string[];
  stopLoss: number;
}

const QUESTIONS = [
  {
    id: "goal",
    question: "What's your primary goal?",
    options: [
      { value: "preserve", label: "Preserve capital, earn stable yield", tier: 0 },
      { value: "growth", label: "Balanced growth with some risk", tier: 1 },
      { value: "maximize", label: "Maximize returns, I can handle volatility", tier: 2 },
    ],
  },
  {
    id: "experience",
    question: "How experienced are you with DeFi?",
    options: [
      { value: "new", label: "Complete beginner", tier: 0 },
      { value: "intermediate", label: "I've used DeFi before", tier: 1 },
      { value: "expert", label: "I'm an experienced DeFi user", tier: 2 },
    ],
  },
  {
    id: "drawdown",
    question: "If your portfolio dropped 20% in a week, what would you do?",
    options: [
      { value: "panic", label: "Withdraw everything immediately", tier: 0 },
      { value: "wait", label: "Wait and see", tier: 1 },
      { value: "buy", label: "Buy more — it's a discount", tier: 2 },
    ],
  },
  {
    id: "timeline",
    question: "How long do you plan to keep funds invested?",
    options: [
      { value: "short", label: "Less than 1 month", tier: 0 },
      { value: "medium", label: "1-6 months", tier: 1 },
      { value: "long", label: "6+ months", tier: 2 },
    ],
  },
];

export { QUESTIONS };

export function assessRisk(answers: Record<string, string>): RiskProfile {
  let totalScore = 0;
  let count = 0;

  for (const q of QUESTIONS) {
    const answer = answers[q.id];
    if (answer) {
      const option = q.options.find((o) => o.value === answer.toLowerCase());
      if (option) {
        totalScore += option.tier;
        count++;
      }
    }
  }

  const avg = count > 0 ? totalScore / count : 1;
  let tier: RiskTier;
  if (avg <= 0.5) tier = 0;
  else if (avg <= 1.5) tier = 1;
  else tier = 2;

  const profiles: Record<RiskTier, RiskProfile> = {
    0: {
      tier: 0,
      label: "Safe",
      score: avg,
      maxDrawdown: 5,
      preferredStrategies: ["Stablecoin LP farming", "Idle yield", "USDC staking"],
      stopLoss: 5,
    },
    1: {
      tier: 1,
      label: "Balanced",
      score: avg,
      maxDrawdown: 20,
      preferredStrategies: ["CLMM positions", "Perps (30%)", "Stable farming (20%)"],
      stopLoss: 15,
    },
    2: {
      tier: 2,
      label: "Aggressive",
      score: avg,
      maxDrawdown: 40,
      preferredStrategies: ["Perps (60%)", "Copy farming (30%)", "Stable (10%)"],
      stopLoss: 30,
    },
  };

  return profiles[tier];
}
