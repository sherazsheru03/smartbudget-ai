const Budget = require("../models/Budget");
const Notification = require("../models/Notification");
const { calculateBudgetProjection } = require("../utils/budgetProjection");
const { getBudgetAlerts } = require("../utils/budgetAlerts");

const getDayInfoForTargetMonth = (month) => {
    const [targetYearString, targetMonthString] = month.split("-");

    const targetYear = Number(targetYearString);
    const targetMonthIndex = Number(targetMonthString) - 1;

    const daysInMonth = new Date(
        targetYear,
        targetMonthIndex + 1,
        0
    ).getDate();

    const today = new Date();

    const isCurrentMonth =
        today.getFullYear() === targetYear &&
        today.getMonth() === targetMonthIndex;

    if (isCurrentMonth) {
        return {
            daysElapsed: today.getDate(),
            daysInMonth,
            monthStatus: "CURRENT"
        };
    }

    const targetMonthStart = new Date(
        targetYear,
        targetMonthIndex,
        1
    );

    const currentMonthStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
    );

    const isPastMonth = targetMonthStart < currentMonthStart;

    if (isPastMonth) {
        return {
            daysElapsed: daysInMonth,
            daysInMonth,
            monthStatus: "PAST"
        };
    }

    return {
        daysElapsed: 0,
        daysInMonth,
        monthStatus: "FUTURE"
    };
};

const buildAlertMessage = (alertCode, budgetDataItem) => {
    const { category } = budgetDataItem;

    switch (alertCode) {
        case "BUDGET_EXCEEDED":
            return `Your ${category} budget has been exceeded.`;

        case "BUDGET_NEAR_LIMIT":
            return `Your ${category} budget is nearing its limit.`;

        case "PROJECTED_OVER_BUDGET":
            return `Your ${category} spending is projected to go over budget by month end.`;

        case "BUDGET_EXHAUSTED":
            return `You have no remaining budget left for ${category}.`;

        default:
            return `A budget alert was triggered for ${category}.`;
    }
};

/**
 * Evaluates deterministic budget alerts for a single user/category/month
 * and persists any triggered alerts as notifications.
 *
 * Past months generate actual-spending alerts only.
 * Current months retain the existing projection and alert behavior.
 * Future months do not generate projection alerts.
 *
 * Duplicate notifications are ignored by the existing database
 * uniqueness constraint through Notification.create().
 *
 * @param {number} user_id
 * @param {string} category
 * @param {string} month - "YYYY-MM" format.
 * @returns {Promise<{
 *   evaluated: boolean,
 *   budgetId: number|null,
 *   alerts: string[],
 *   createdNotifications: object[]
 * }>}
 */
const evaluateAndPersistBudgetNotifications = async (
    user_id,
    category,
    month
) => {
    const budgets = await Budget.getBudgetsWithSpending(user_id);

    const matchingBudget = budgets.find(
        (budget) =>
            budget.category === category &&
            budget.month === month
    );

    if (!matchingBudget) {
        return {
            evaluated: false,
            budgetId: null,
            alerts: [],
            createdNotifications: []
        };
    }

    const {
        daysElapsed,
        daysInMonth,
        monthStatus
    } = getDayInfoForTargetMonth(month);

    const projection = calculateBudgetProjection(
        matchingBudget.budgetAmount,
        matchingBudget.actualSpending,
        daysElapsed,
        daysInMonth
    );

    const alerts = getBudgetAlerts({
        percentageUsed: matchingBudget.percentageUsed,
        projectedPercentage: projection.projectedPercentage,
        remainingAmount: matchingBudget.remainingAmount,
        monthStatus,
        actualSpending: matchingBudget.actualSpending
    });

    // PostgreSQL DATE columns require a complete date.
    // Keep YYYY-MM for matching and use YYYY-MM-01 for persistence.
    const notificationMonth = `${month}-01`;

    const createdNotifications = [];

    for (const alertCode of alerts) {
        const message = buildAlertMessage(
            alertCode,
            matchingBudget
        );

        const notification = await Notification.create(
            user_id,
            matchingBudget.id,
            notificationMonth,
            alertCode,
            message
        );

        if (notification) {
            createdNotifications.push(notification);
        }
    }

    return {
        evaluated: true,
        budgetId: matchingBudget.id,
        alerts,
        createdNotifications
    };
};

module.exports = {
    evaluateAndPersistBudgetNotifications
};