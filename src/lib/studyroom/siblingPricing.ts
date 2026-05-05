import { CASUAL_RATES, type CasualRateType } from "./billing";

export type SessionForPricing = {
  id: string;
  startMs: number;
  endMs: number;
  planType: string | null;
};

export type PricedSession = SessionForPricing & {
  rateType: CasualRateType;
  rateCents: number;
  isCasual: boolean;
};

/**
 * Classify and price sessions for a single family on a single day.
 * Only casual sessions are auto-priced. Package sessions are returned
 * with rateType "standard" and rateCents 0 (invoiced manually).
 */
export function classifyAndPriceSessions(sessions: SessionForPricing[]): PricedSession[] {
  return sessions.map((session) => {
    const isCasual =
      !session.planType ||
      session.planType === "CASUAL" ||
      session.planType === "casual";

    if (!isCasual) {
      return { ...session, isCasual: false, rateType: "standard", rateCents: 0 };
    }

    const others = sessions.filter((s) => s.id !== session.id);

    const hasSameTime = others.some(
      (o) => session.startMs < o.endMs && o.startMs < session.endMs
    );

    if (hasSameTime) {
      return { ...session, isCasual: true, rateType: "sameTime", rateCents: CASUAL_RATES.sameTime };
    }

    const hasBackToBack = others.some((o) => {
      const gapMs = Math.max(
        session.startMs - o.endMs,
        o.startMs - session.endMs
      );
      return gapMs >= 0 && gapMs <= 15 * 60 * 1000;
    });

    if (hasBackToBack) {
      return { ...session, isCasual: true, rateType: "backToBack", rateCents: CASUAL_RATES.backToBack };
    }

    return { ...session, isCasual: true, rateType: "standard", rateCents: CASUAL_RATES.standard };
  });
}
