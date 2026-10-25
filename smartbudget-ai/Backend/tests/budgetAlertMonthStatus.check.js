/**
 * Backend/tests/budgetAlertMonthStatus.check.js
 *
 * Month-aware budget alert checks (past / current / future).
 *
 * Dependency-free: uses only Node's built-in "assert". Run with:
 *   node Backend/tests/budgetAlertMonthStatus.check.js
 *
 * - The real budgetAlerts.js and budgetProjection.js are used.
 * - The Budget and Notification models and the AI service are replaced with
 *   in-memory fakes, so no database, network or API key is needed.
 * - "Today" is frozen at 2026-10-10 so results never depend on the real date.
 *   Past = Sep 2026, current = Oct 2026, future = Nov 2026.
 */

const assert = require("node:assert/strict");
const path = require("path");
const Module = require("module");

const RealDate = Date;
const FIXED_NOW_MS = new RealDate(2026, 9, 10, 12, 0, 0).getTime();

class FakeDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) {
      super(FIXED_NOW_MS);
    } else {
      super(...args);
    }
  }

  static now() {
    return FIXED_NOW_MS;
  }
}

const injectFake = (relativePath, fakeExports) => {
  const resolved = require.resolve(path.join(__dirname, relativePath));
  const fakeModule = new Module(resolved);
  fakeModule.filename = resolved;
  fakeModule.exports = fakeExports;
  fakeModule.loaded = true;
  require.cache[resolved] = fakeModule;
};

const fakeBudget = { rows: [], requestedUserIds: [] };
fakeBudget.getBudgetsWithSpending = async function (userId) {
  fakeBudget.requestedUserIds.push(userId);
  return fakeBudget.rows;
};

const fakeNotification = { created: [] };
fakeNotification.create = async function (userId, budgetId, month, alertCode, message) {
  const record = { userId, budgetId, month, alertCode, message };
  fakeNotification.created.push(record);
  return { id: fakeNotification.created.length, ...record };
};

class FakeAIInsightServiceError extends Error {}

injectFake("../models/Budget", fakeBudget);
injectFake("../models/Notification", fakeNotification);
injectFake("../services/aiInsightService", {
  generateBudgetInsights: async () => ({ insights: [], summary: "" }),
  AIInsightServiceError: FakeAIInsightServiceError,
});

const { getBudgetAlerts } = require("../utils/budgetAlerts");
const {
  evaluateAndPersistBudgetNotifications,
} = require("../services/budgetNotificationService");
const { getBudgetInsights } = require("../controller/budgetController");

const EXCEEDED = "BUDGET_EXCEEDED";
const NEAR = "BUDGET_NEAR_LIMIT";
const PROJECTED = "PROJECTED_OVER_BUDGET";
const EXHAUSTED = "BUDGET_EXHAUSTED";

const budgetRow = (id, category, month, budgetAmount, actualSpending) => ({
  id,
  category,
  month,
  budgetAmount,
  actualSpending,
  remainingAmount: budgetAmount - actualSpending,
  percentageUsed: (actualSpending / budgetAmount) * 100,
});

const callInsights = async (rows) => {
  fakeBudget.rows = rows;
  const response = { statusCode: null, body: null };
  const res = {
    status(code) {
      response.statusCode = code;
      return res;
    },
    json(body) {
      response.body = body;
      return res;
    },
  };
  await getBudgetInsights({ user: { id: 7 } }, res);
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  return response.body;
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ---------- getBudgetAlerts (pure rules) ----------

test("past month, overspent: keeps actual alerts, no projection alert", () => {
  assert.deepEqual(
    getBudgetAlerts({
      percentageUsed: 120,
      projectedPercentage: 120,
      remainingAmount: -100,
      actualSpending: 600,
      monthStatus: "PAST",
    }),
    [EXCEEDED, NEAR, EXHAUSTED]
  );
});

test("past month, exactly used up: keeps actual alerts, no projection alert", () => {
  assert.deepEqual(
    getBudgetAlerts({ percentageUsed: 100, projectedPercentage: 100, remainingAmount: 0, actualSpending: 500, monthStatus: "PAST" }),
    [EXCEEDED, NEAR, EXHAUSTED]
  );
});

test("past month, near limit only", () => {
  assert.deepEqual(
    getBudgetAlerts({ percentageUsed: 85, projectedPercentage: 85, remainingAmount: 75, actualSpending: 425, monthStatus: "PAST" }),
    [NEAR]
  );
});

test("past month, within budget: no alerts", () => {
  assert.deepEqual(
    getBudgetAlerts({ percentageUsed: 30, projectedPercentage: 30, remainingAmount: 700, actualSpending: 300, monthStatus: "PAST" }),
    []
  );
});

test("past month never returns a projection alert, whatever the projection says", () => {
  assert.ok(
    !getBudgetAlerts({ percentageUsed: 10, projectedPercentage: 500, remainingAmount: 900, actualSpending: 100, monthStatus: "PAST" }).includes(PROJECTED)
  );
});

test("current month, projected over but not yet near limit: projection alert only", () => {
  assert.deepEqual(
    getBudgetAlerts({ percentageUsed: 50, projectedPercentage: 155, remainingAmount: 500, actualSpending: 500, monthStatus: "CURRENT" }),
    [PROJECTED]
  );
});

test("current month, overspent: all four alerts in the original order", () => {
  assert.deepEqual(
    getBudgetAlerts({ percentageUsed: 120, projectedPercentage: 360, remainingAmount: -100, actualSpending: 600, monthStatus: "CURRENT" }),
    [EXCEEDED, NEAR, PROJECTED, EXHAUSTED]
  );
});

test("callers that omit monthStatus keep the original behaviour", () => {
  const input = { percentageUsed: 120, projectedPercentage: 120, remainingAmount: -100 };
  assert.deepEqual(getBudgetAlerts(input), [EXCEEDED, NEAR, PROJECTED, EXHAUSTED]);
  assert.deepEqual(getBudgetAlerts({ ...input, monthStatus: "current" }), [EXCEEDED, NEAR, PROJECTED, EXHAUSTED]);
  assert.deepEqual(getBudgetAlerts({ ...input, monthStatus: "SOMETHING_ELSE" }), [EXCEEDED, NEAR, PROJECTED, EXHAUSTED]);
  assert.deepEqual(getBudgetAlerts(), [EXHAUSTED]);
});

test("future month with no spending: no alerts, even with missing or odd numbers", () => {
  assert.deepEqual(
    getBudgetAlerts({ percentageUsed: 0, projectedPercentage: 0, remainingAmount: 800, actualSpending: 0, monthStatus: "FUTURE" }),
    []
  );
  assert.deepEqual(getBudgetAlerts({ monthStatus: "FUTURE" }), []);
  assert.deepEqual(
    getBudgetAlerts({ percentageUsed: 0, projectedPercentage: 300, remainingAmount: 0, actualSpending: 0, monthStatus: "FUTURE" }),
    []
  );
});

test("future month with real recorded spending: actual alerts only, no projection alert", () => {
  assert.deepEqual(
    getBudgetAlerts({ percentageUsed: 150, projectedPercentage: 150, remainingAmount: -50, actualSpending: 150, monthStatus: "FUTURE" }),
    [EXCEEDED, NEAR, EXHAUSTED]
  );
});

// ---------- notification service (real projection + alert code) ----------

const runService = async (rows, category, month) => {
  fakeBudget.rows = rows;
  fakeBudget.requestedUserIds = [];
  fakeNotification.created = [];
  const result = await evaluateAndPersistBudgetNotifications(7, category, month);
  return result;
};

test("service, past overspent budget: persists actual alerts only, month stored as DATE string", async () => {
  const result = await runService([budgetRow(11, "Food", "2026-09", 500, 600)], "Food", "2026-09");
  assert.equal(result.evaluated, true);
  assert.deepEqual(result.alerts, [EXCEEDED, NEAR, EXHAUSTED]);
  assert.deepEqual(fakeNotification.created.map((n) => n.alertCode), [EXCEEDED, NEAR, EXHAUSTED]);
  assert.ok(fakeNotification.created.every((n) => n.userId === 7 && n.budgetId === 11 && n.month === "2026-09-01"));
  assert.deepEqual(fakeBudget.requestedUserIds, [7]);
});

test("service, current month: projection alert is still raised", async () => {
  let result = await runService([budgetRow(12, "Food", "2026-10", 1000, 500)], "Food", "2026-10");
  assert.deepEqual(result.alerts, [PROJECTED]);

  result = await runService([budgetRow(13, "Travel", "2026-10", 500, 600)], "Travel", "2026-10");
  assert.deepEqual(result.alerts, [EXCEEDED, NEAR, PROJECTED, EXHAUSTED]);
});

test("service, future month with no spending: nothing is persisted", async () => {
  const result = await runService([budgetRow(14, "Shopping", "2026-11", 800, 0)], "Shopping", "2026-11");
  assert.equal(result.evaluated, true);
  assert.deepEqual(result.alerts, []);
  assert.deepEqual(fakeNotification.created, []);
});

test("service, unknown category/month: unchanged not-found result", async () => {
  const result = await runService([budgetRow(11, "Food", "2026-09", 500, 600)], "Food", "2026-08");
  assert.deepEqual(result, { evaluated: false, budgetId: null, alerts: [], createdNotifications: [] });
  assert.deepEqual(fakeNotification.created, []);
});

// ---------- insights controller (same rules on the Dashboard path) ----------

test("controller: past, current and future budgets get the right alerts; formulas unchanged", async () => {
  const body = await callInsights([
    budgetRow(11, "Food", "2026-09", 500, 600),
    budgetRow(12, "Food", "2026-10", 500, 600),
    budgetRow(13, "Travel", "2026-10", 1000, 500),
    budgetRow(14, "Shopping", "2026-11", 800, 0),
  ]);

  const byId = (id) => body.insights.find((insight) => insight.budgetId === id);

  assert.equal(byId(11).monthStatus, "PAST");
  assert.deepEqual(byId(11).alerts, [EXCEEDED, NEAR, EXHAUSTED]);
  assert.equal(byId(11).daysRemaining, 0);
  assert.equal(byId(11).projectedTotal, 600);
  assert.equal(byId(11).riskLevel, "HIGH");

  assert.equal(byId(12).monthStatus, "CURRENT");
  assert.deepEqual(byId(12).alerts, [EXCEEDED, NEAR, PROJECTED, EXHAUSTED]);
  assert.equal(byId(12).daysRemaining, 21);

  assert.deepEqual(byId(13).alerts, [PROJECTED]);

  assert.equal(byId(14).monthStatus, "FUTURE");
  assert.deepEqual(byId(14).alerts, []);

  assert.deepEqual(Object.keys(body), ["message", "insights", "summary"]);
});

// ---------- runner ----------

(async () => {
  let failed = 0;

  for (const { name, fn } of tests) {
    global.Date = FakeDate;

    try {
      await fn();
      global.Date = RealDate;
      console.log(`PASS  ${name}`);
    } catch (error) {
      global.Date = RealDate;
      failed += 1;
      console.log(`FAIL  ${name}\n      ${String(error.message).split("\n")[0]}`);
    }
  }

  global.Date = RealDate;
  console.log(`\n${tests.length - failed} passed, ${failed} failed`);
  process.exitCode = failed === 0 ? 0 : 1;
})();
