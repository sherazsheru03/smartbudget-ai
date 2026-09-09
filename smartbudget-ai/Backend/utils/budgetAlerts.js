/**
 * Backend/utils/budgetAlerts.js
 *
 * Pure, deterministic budget alert classification.
 * No database access, no req/res, no AI/Gemini involvement.
 */

function toSafeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getBudgetAlerts({ percentageUsed, projectedPercentage, remainingAmount } = {}) {
  const safePercentageUsed = toSafeNumber(percentageUsed);
  const safeProjectedPercentage = toSafeNumber(projectedPercentage);
  const safeRemainingAmount = toSafeNumber(remainingAmount);

  const alerts = [];

  if (safePercentageUsed >= 100) {
    alerts.push("BUDGET_EXCEEDED");
  }

  if (safePercentageUsed >= 80) {
    alerts.push("BUDGET_NEAR_LIMIT");
  }

  if (safeProjectedPercentage >= 100) {
    alerts.push("PROJECTED_OVER_BUDGET");
  }

  if (safeRemainingAmount <= 0) {
    alerts.push("BUDGET_EXHAUSTED");
  }

  return alerts;
}

module.exports = { getBudgetAlerts };
