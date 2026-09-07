import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import API from "../../services/api";
import styles from "./Analytics.module.css";

const CATEGORY_COLORS = [
  "#3b6ff2",
  "#22d3a8",
  "#f5a623",
  "#f0576b",
  "#38bdf8",
  "#818cf8",
  "#2952e0",
  "#17b691",
];

const formatCurrency = (value) => {
  const number = Number(value) || 0;

  return `₹${number.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
};

const formatMonthLabel = (monthString) => {
  if (!monthString) {
    return "";
  }

  const [year, month] = monthString.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
};

function Analytics() {
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await API.get("/expenses/analytics");
        setAnalytics(response.data);
      } catch (err) {
        const message =
          err.response?.data?.message ||
          "Failed to load analytics. Please try again.";

        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const getSpendingInsight = () => {
    if (!analytics || analytics.totalTransactions === 0) {
      return "Add a few expenses to start seeing spending trends and insights here.";
    }

    if (
      analytics.highestSpendingMonth &&
      analytics.averageMonthlySpending > 0
    ) {
      const diff =
        analytics.highestSpendingMonth.total -
        analytics.averageMonthlySpending;

      const percentAboveAverage =
        Math.round((diff / analytics.averageMonthlySpending) * 100 * 10) /
        10;

      if (percentAboveAverage > 5) {
        return `Your spending peaked in ${formatMonthLabel(
          analytics.highestSpendingMonth.month
        )} at ${formatCurrency(
          analytics.highestSpendingMonth.total
        )}, ${percentAboveAverage}% above your monthly average.`;
      }
    }

    if (analytics.categoryBreakdown.length > 0) {
      const topCategory = analytics.categoryBreakdown[0];

      return `${topCategory.category} accounts for ${topCategory.percentage}% of your total spending — your largest category overall.`;
    }

    return "Keep tracking your expenses to unlock deeper spending insights.";
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.statusText}>Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.statusTextError}>{error}</p>
      </div>
    );
  }

  const chartData = analytics.monthlyTrend.map((entry) => ({
    month: formatMonthLabel(entry.month),
    total: entry.total,
  }));

  const pieData = analytics.categoryBreakdown.map((entry) => ({
    name: entry.category,
    value: entry.total,
  }));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Insights</p>
          <h1 className={styles.title}>Spending Analytics</h1>
          <p className={styles.subtitle}>
            A deeper look at your spending patterns over time.
          </p>
        </div>

        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate("/dashboard")}
        >
          Back to Dashboard
        </button>
      </header>

      <section className={styles.statsGrid}>
        <div className={styles.card}>
          <p className={styles.cardLabel}>Average Monthly Spending</p>
          <p className={styles.cardValue}>
            {formatCurrency(analytics.averageMonthlySpending)}
          </p>
        </div>

        <div className={styles.card}>
          <p className={styles.cardLabel}>Total Transactions</p>
          <p className={styles.cardValue}>{analytics.totalTransactions}</p>
        </div>

        <div className={styles.card}>
          <p className={styles.cardLabel}>Highest Spending Month</p>
          <p className={styles.cardValue}>
            {analytics.highestSpendingMonth
              ? formatMonthLabel(analytics.highestSpendingMonth.month)
              : "—"}
          </p>
        </div>

        <div className={styles.card}>
          <p className={styles.cardLabel}>Highest Single Expense</p>
          <p className={styles.cardValue}>
            {analytics.highestExpense
              ? formatCurrency(analytics.highestExpense.amount)
              : "—"}
          </p>
          {analytics.highestExpense && (
            <p className={styles.cardSubtext}>
              {analytics.highestExpense.title}
            </p>
          )}
        </div>
      </section>

      <div className={styles.chartsGrid}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Monthly Spending Trend</h2>

          {chartData.every((entry) => entry.total === 0) ? (
            <p className={styles.statusTextInline}>
              No spending recorded in the last 6 months.
            </p>
          ) : (
            <div className={styles.chartWrapper}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#262c38" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    stroke="#6b7385"
                    fontSize={12}
                  />
                  <YAxis stroke="#6b7385" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#171b24",
                      border: "1px solid #262c38",
                      borderRadius: "10px",
                      color: "#f4f6fb",
                    }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#3b6ff2"
                    strokeWidth={2}
                    dot={{ fill: "#3b6ff2", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Category Breakdown</h2>

          {pieData.length === 0 ? (
            <p className={styles.statusTextInline}>
              No category data available yet.
            </p>
          ) : (
            <div className={styles.chartWrapper}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#171b24",
                      border: "1px solid #262c38",
                      borderRadius: "10px",
                      color: "#f4f6fb",
                    }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "0.8rem", color: "#a7afc0" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className={styles.insightCard}>
        <p className={styles.insightLabel}>Spending Insight</p>
        <p className={styles.insightText}>{getSpendingInsight()}</p>
      </section>
    </div>
  );
}

export default Analytics;