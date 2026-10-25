/**
 * Backend/utils/budgetAlerts.js
 *
 * Pure, deterministic budget alert classification.
 * No database access, no req/res, no AI/Gemini involvement.
 *
 * Month-aware rules (monthStatus and actualSpending are optional; when
 * monthStatus is omitted or unrecognised, the original behaviour applies):
 *  - PAST:    only actual-spending alerts are returned. PROJECTED_OVER_BUDGET
 *             is never returned because the month has ended and there is
 *             nothing left to project.
 *  - CURRENT: unchanged (actual-spending and projection alerts).
 *  - FUTURE:  no alerts without actual spending, and never a projection alert.
 */


function toSafeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}


function getBudgetAlerts({
  percentageUsed,
  projectedPercentage,
  remainingAmount,
  monthStatus,
  actualSpending,
} = {}) {
  const safePercentageUsed = toSafeNumber(percentageUsed);
  const safeProjectedPercentage = toSafeNumber(projectedPercentage);
  const safeRemainingAmount = toSafeNumber(remainingAmount);

  const status =
    typeof monthStatus === "string" ? monthStatus.toUpperCase() : "CURRENT";

  // A budget for a month that has not started cannot have spending-based
  // alerts unless real spending has been recorded against it.
  if (status === "FUTURE" && toSafeNumber(actualSpending) <= 0) {
    return [];
  }

  // Projections only make sense while the month is still in progress.
  const allowsProjectionAlert = status !== "PAST" && status !== "FUTURE";


  const alerts = [];


  if (safePercentageUsed >= 100) {
    alerts.push("BUDGET_EXCEEDED");
  }


  if (safePercentageUsed >= 80) {
    alerts.push("BUDGET_NEAR_LIMIT");
  }


  if (allowsProjectionAlert && safeProjectedPercentage >= 100) {
    alerts.push("PROJECTED_OVER_BUDGET");
  }


  if (safeRemainingAmount <= 0) {
    alerts.push("BUDGET_EXHAUSTED");
  }


  return alerts;
}


module.exports = { getBudgetAlerts };
