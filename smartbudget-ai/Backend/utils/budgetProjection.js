/**
 * budgetProjection.js
 *
 * Pure, deterministic budget projection calculations.
 *
 * This module performs ONLY arithmetic. It does not access the database,
 * does not touch req/res, does not know about users, auth, or AI providers.
 * It is safe to call from anywhere (controllers, tests, scripts) with plain
 * numbers and will never throw, and never return NaN or Infinity.
 */

const RISK_LEVEL = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
};

const toSafeNumber = (value, fallback = 0) => {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue) || !Number.isFinite(numericValue)) {
    return fallback;
  }

  return numericValue;
};

/**
 * Classifies risk level from the projected percentage using fixed thresholds:
 *  - >= 100  -> HIGH
 *  - >= 80   -> MEDIUM
 *  - < 80    -> LOW
 *
 * No days-remaining weighting or additional scoring is applied, by design.
 *
 * @param {number} projectedPercentage
 * @returns {"LOW"|"MEDIUM"|"HIGH"}
 */
const classifyRiskLevel = (projectedPercentage) => {
  const safeProjectedPercentage = toSafeNumber(projectedPercentage, 0);

  if (safeProjectedPercentage >= 100) {
    return RISK_LEVEL.HIGH;
  }

  if (safeProjectedPercentage >= 80) {
    return RISK_LEVEL.MEDIUM;
  }

  return RISK_LEVEL.LOW;
};

/**
 * Calculates a deterministic month-end spending projection for a single budget.
 *
 * @param {number} budgetAmount - The budgeted amount for the category/month.
 * @param {number} actualSpending - The amount actually spent so far.
 * @param {number} daysElapsed - Number of days elapsed in the budget's month so far.
 * @param {number} daysInMonth - Total number of days in the budget's month.
 * @returns {{
 *   dailyBurnRate: number,
 *   projectedTotal: number,
 *   projectedOverage: number,
 *   projectedPercentage: number,
 *   daysRemaining: number,
 *   recommendedDailySpend: number,
 *   riskLevel: "LOW"|"MEDIUM"|"HIGH"
 * }}
 */
const calculateBudgetProjection = (
  budgetAmount,
  actualSpending,
  daysElapsed,
  daysInMonth
) => {
  const safeBudgetAmount = toSafeNumber(budgetAmount, 0);
  const safeActualSpending = toSafeNumber(actualSpending, 0);
  const safeDaysElapsed = Math.max(toSafeNumber(daysElapsed, 0), 0);
  const safeDaysInMonth = Math.max(toSafeNumber(daysInMonth, 0), 0);

  const daysRemainingRaw = safeDaysInMonth - safeDaysElapsed;
  const daysRemaining = daysRemainingRaw > 0 ? daysRemainingRaw : 0;

  const dailyBurnRate =
    safeDaysElapsed > 0 ? safeActualSpending / safeDaysElapsed : 0;

  const projectedTotal = dailyBurnRate * safeDaysInMonth;

  const projectedOverage = projectedTotal - safeBudgetAmount;

  const projectedPercentage =
    safeBudgetAmount > 0 ? (projectedTotal / safeBudgetAmount) * 100 : 0;

  const remainingAmount = safeBudgetAmount - safeActualSpending;

  const recommendedDailySpend =
    daysRemaining > 0 ? remainingAmount / daysRemaining : 0;

  const riskLevel = classifyRiskLevel(projectedPercentage);

  return {
    dailyBurnRate,
    projectedTotal,
    projectedOverage,
    projectedPercentage,
    daysRemaining,
    recommendedDailySpend,
    riskLevel,
  };
};

module.exports = {
  calculateBudgetProjection,
};
