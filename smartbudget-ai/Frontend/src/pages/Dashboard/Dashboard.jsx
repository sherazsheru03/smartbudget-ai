import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import { getBudgetSpending, getBudgetInsights } from "../../services/budgetService";


const DATE_RANGE_OPTIONS = [
  "All Time",
  "This Month",
  "Last Month",
  "Last 3 Months",
];


const pad = (value) => String(value).padStart(2, "0");


const toDateOnlyString = (year, month, day) => {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
};


const getDateRangeBounds = (rangeLabel) => {
  if (rangeLabel === "All Time") {
    return { start: null, end: null };
  }


  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();


  if (rangeLabel === "This Month") {
    const start = toDateOnlyString(currentYear, currentMonth, 1);
    const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
    const end = toDateOnlyString(
      nextMonthDate.getFullYear(),
      nextMonthDate.getMonth(),
      1
    );


    return { start, end };
  }


  if (rangeLabel === "Last Month") {
    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const start = toDateOnlyString(
      lastMonthDate.getFullYear(),
      lastMonthDate.getMonth(),
      1
    );
    const end = toDateOnlyString(currentYear, currentMonth, 1);


    return { start, end };
  }


  if (rangeLabel === "Last 3 Months") {
    const threeMonthsAgoDate = new Date(currentYear, currentMonth - 2, 1);
    const start = toDateOnlyString(
      threeMonthsAgoDate.getFullYear(),
      threeMonthsAgoDate.getMonth(),
      1
    );
    const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
    const end = toDateOnlyString(
      nextMonthDate.getFullYear(),
      nextMonthDate.getMonth(),
      1
    );


    return { start, end };
  }


  return { start: null, end: null };
};


const getExpenseDateOnly = (dateValue) => {
  if (!dateValue) {
    return "";
  }


  return String(dateValue).slice(0, 10);
};


function Dashboard() {
  const navigate = useNavigate();


  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");


  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");


  const [budgetOverview, setBudgetOverview] = useState([]);
  const [budgetOverviewLoading, setBudgetOverviewLoading] = useState(true);
  const [budgetOverviewError, setBudgetOverviewError] = useState("");


  const [aiInsight, setAiInsight] = useState(null);
  const [aiInsightLoading, setAiInsightLoading] = useState(true);
  const [aiInsightError, setAiInsightError] = useState("");


  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedDateRange, setSelectedDateRange] = useState("All Time");


  const fetchExpenses = async () => {
    setLoading(true);
    setError("");


    try {
      const response = await API.get("/expenses");


      const data = response.data;


      let expenseList = [];


      if (Array.isArray(data)) {
        expenseList = data;
      } else if (Array.isArray(data?.expenses)) {
        expenseList = data.expenses;
      } else if (Array.isArray(data?.data)) {
        expenseList = data.data;
      }


      setExpenses(expenseList);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to load expenses. Please try again.";


      setError(message);
    } finally {
      setLoading(false);
    }
  };


  const fetchSummary = async () => {
    setSummaryLoading(true);
    setSummaryError("");


    try {
      const response = await API.get("/expenses/summary");
      setSummary(response.data);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to load monthly summary.";


      setSummaryError(message);
    } finally {
      setSummaryLoading(false);
    }
  };


  const fetchBudgetOverview = async () => {
    setBudgetOverviewLoading(true);
    setBudgetOverviewError("");


    try {
      const response = await getBudgetSpending();
      const data = response.data?.budgets;


      setBudgetOverview(Array.isArray(data) ? data : []);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to load budget overview. Please try again.";


      setBudgetOverviewError(message);
    } finally {
      setBudgetOverviewLoading(false);
    }
  };


  const fetchAIInsight = async () => {
    setAiInsightLoading(true);
    setAiInsightError("");


    try {
      const response = await getBudgetInsights();
      setAiInsight(response.data);
    } catch (err) {
      setAiInsightError("AI insights are temporarily unavailable.");
    } finally {
      setAiInsightLoading(false);
    }
  };


  useEffect(() => {
    fetchExpenses();
    fetchSummary();
    fetchBudgetOverview();
    fetchAIInsight();
  }, []);


  const handleDelete = async (id) => {
    if (deletingId) {
      return;
    }


    const confirmed = window.confirm(
      "Are you sure you want to delete this expense?"
    );


    if (!confirmed) {
      return;
    }


    setDeletingId(id);
    setDeleteError("");


    try {
      await API.delete(`/expenses/${id}`);
      await fetchExpenses();
      await fetchSummary();
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to delete expense. Please try again.";


      setDeleteError(message);
    } finally {
      setDeletingId(null);
    }
  };


  const handleEdit = (expense) => {
    navigate(`/expenses/edit/${expense.id}`, { state: expense });
  };


  const handleCategorySelect = (category) => {
    setSelectedCategory((previous) =>
      previous === category ? "All" : category
    );
  };


  const handleClearFilters = () => {
    setSelectedCategory("All");
    setSelectedDateRange("All Time");
  };


  const formatCurrency = (value) => {
    const number = Number(value) || 0;


    return `₹${number.toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    })}`;
  };


  const formatDate = (dateString) => {
    const date = new Date(dateString);


    if (Number.isNaN(date.getTime())) {
      return "";
    }


    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };


  const totalSpending = expenses.reduce(
    (sum, expense) => sum + (parseFloat(expense.amount) || 0),
    0
  );


  const transactionCount = expenses.length;


  const categoryTotals = expenses.reduce((acc, expense) => {
    const category = expense.category || "Uncategorized";
    const amount = parseFloat(expense.amount) || 0;


    acc[category] = (acc[category] || 0) + amount;


    return acc;
  }, {});


  const categoryEntries = Object.entries(categoryTotals).sort(
    (a, b) => b[1] - a[1]
  );


  const topCategory =
    categoryEntries.length > 0 ? categoryEntries[0][0] : null;


  const { start: rangeStart, end: rangeEnd } =
    getDateRangeBounds(selectedDateRange);


  const filteredExpenses = expenses.filter((expense) => {
    const matchesCategory =
      selectedCategory === "All" ||
      (expense.category || "Uncategorized") === selectedCategory;


    if (!matchesCategory) {
      return false;
    }


    if (rangeStart === null || rangeEnd === null) {
      return true;
    }


    const expenseDateOnly = getExpenseDateOnly(expense.date);


    return expenseDateOnly >= rangeStart && expenseDateOnly < rangeEnd;
  });


  const recentExpenses = [...filteredExpenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);


  const hasActiveFilters =
    selectedCategory !== "All" || selectedDateRange !== "All Time";


  const getBudgetProgressColor = (percentageUsed) => {
    if (percentageUsed >= 100) {
      return "#f0576b";
    }


    if (percentageUsed >= 80) {
      return "#f0b429";
    }


    return "#6366f1";
  };


  if (loading) {
    return (
      <div style={styles.page}>
        <p style={styles.statusText}>Loading your dashboard...</p>
      </div>
    );
  }


  if (error) {
    return (
      <div style={styles.page}>
        <p style={{ ...styles.statusText, color: "#fca5a5" }}>{error}</p>
      </div>
    );
  }


  return (
    <div style={styles.page}>
      {/* HEADER */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>Welcome back 👋</h1>
          <p style={styles.headerSubtitle}>
            Here's your financial overview.
          </p>
        </div>


        <div style={styles.headerActions}>
          <button
            type="button"
            onClick={() => navigate("/analytics")}
            style={styles.analyticsButton}
          >
            View Analytics
          </button>

          <button
            type="button"
            onClick={() => navigate("/budgets")}
            style={styles.analyticsButton}
          >
            Budgets
          </button>


          <button
            type="button"
            onClick={() => navigate("/expenses/add")}
            style={styles.addExpenseButton}
          >
            + Add Expense
          </button>
        </div>
      </header>


      {deleteError && (
        <div style={styles.deleteErrorBanner}>{deleteError}</div>
      )}


      {/* MONTHLY SUMMARY */}
      <section style={styles.summarySection}>
        <h2 style={styles.panelTitle}>Monthly Summary</h2>


        {summaryLoading ? (
          <p style={styles.statusTextInline}>Loading summary...</p>
        ) : summaryError ? (
          <p style={{ ...styles.statusTextInline, color: "#fca5a5" }}>
            {summaryError}
          </p>
        ) : (
          <div style={styles.summaryGrid}>
            <div style={styles.card}>
              <p style={styles.cardLabel}>This Month</p>
              <p style={styles.cardValue}>
                {formatCurrency(summary.currentMonthTotal)}
              </p>
            </div>


            <div style={styles.card}>
              <p style={styles.cardLabel}>vs Last Month</p>
              {summary.percentageChange === null ? (
                <p style={styles.cardValue}>—</p>
              ) : (
                <p
                  style={{
                    ...styles.cardValue,
                    color:
                      summary.percentageChange <= 0 ? "#22d3a8" : "#f0576b",
                  }}
                >
                  {summary.percentageChange <= 0 ? "↓" : "↑"}{" "}
                  {Math.abs(summary.percentageChange)}%
                </p>
              )}
            </div>


            <div style={styles.card}>
              <p style={styles.cardLabel}>Top Category</p>
              <p style={styles.cardValue}>{summary.topCategory || "—"}</p>
            </div>


            <div style={styles.card}>
              <p style={styles.cardLabel}>Daily Average</p>
              <p style={styles.cardValue}>
                {formatCurrency(summary.dailyAverage)}
              </p>
            </div>
          </div>
        )}
      </section>


      {/* SUMMARY CARDS */}
      <section style={styles.summaryGrid}>
        <div style={styles.card}>
          <p style={styles.cardLabel}>Total Spending</p>
          <p style={styles.cardValue}>{formatCurrency(totalSpending)}</p>
        </div>


        <div style={styles.card}>
          <p style={styles.cardLabel}>Transactions</p>
          <p style={styles.cardValue}>{transactionCount}</p>
        </div>


        <div style={styles.card}>
          <p style={styles.cardLabel}>Top Spending Category</p>
          <p style={styles.cardValue}>{topCategory || "—"}</p>
        </div>
      </section>


      {/* BUDGET OVERVIEW */}
      <section style={styles.summarySection}>
        <div style={styles.panelHeaderRow}>
          <h2 style={styles.panelTitle}>Budget Overview</h2>


          <button
            type="button"
            onClick={() => navigate("/budgets")}
            style={styles.clearFilterButton}
          >
            Manage Budgets
          </button>
        </div>


        {budgetOverviewLoading ? (
          <p style={styles.statusTextInline}>Loading budget overview...</p>
        ) : budgetOverviewError ? (
          <p style={{ ...styles.statusTextInline, color: "#fca5a5" }}>
            {budgetOverviewError}
          </p>
        ) : budgetOverview.length === 0 ? (
          <p style={styles.statusTextInline}>
            No budgets set yet. Create a budget to see your overview here.
          </p>
        ) : (
          <div style={styles.budgetOverviewGrid}>
            {budgetOverview.map((budget) => {
              const progressColor = getBudgetProgressColor(
                budget.percentageUsed
              );
              const visualWidth = Math.min(budget.percentageUsed, 100);
              const isOverBudget = budget.remainingAmount < 0;


              return (
                <div key={budget.id} style={styles.card}>
                  <div style={styles.budgetCardHeader}>
                    <p style={styles.cardLabel}>{budget.category}</p>
                    <p style={styles.budgetCardMonth}>{budget.month}</p>
                  </div>


                  <p style={styles.cardValue}>
                    {formatCurrency(budget.actualSpending)} /{" "}
                    {formatCurrency(budget.budgetAmount)}
                  </p>


                  <div style={styles.barTrack}>
                    <div
                      style={{
                        ...styles.barFill,
                        width: `${visualWidth}%`,
                        backgroundColor: progressColor,
                      }}
                    />
                  </div>


                  <div style={styles.budgetCardFooter}>
                    <span style={{ color: progressColor, fontWeight: 600 }}>
                      {Math.round(budget.percentageUsed * 100) / 100}%
                    </span>


                    <span
                      style={{
                        ...styles.expenseMeta,
                        marginTop: 0,
                        color: isOverBudget ? "#f0576b" : "#9a9aa5",
                      }}
                    >
                      {isOverBudget
                        ? `${formatCurrency(
                            Math.abs(budget.remainingAmount)
                          )} over budget`
                        : `${formatCurrency(
                            budget.remainingAmount
                          )} remaining`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>


      {transactionCount === 0 ? (
        <section style={styles.emptyState}>
          <p style={styles.emptyTitle}>No expenses yet</p>


          <p style={styles.emptyText}>
            Add your first expense to start seeing your financial overview
            here.
          </p>


          <button
            type="button"
            onClick={() => navigate("/expenses/add")}
            style={styles.emptyStateButton}
          >
            Add Your First Expense
          </button>
        </section>
      ) : (
        <div style={styles.contentGrid}>
          {/* RECENT EXPENSES */}
          <section style={styles.panel}>
            <div style={styles.panelHeaderRow}>
              <h2 style={styles.panelTitle}>
                Recent Expenses
                {hasActiveFilters && (
                  <span style={styles.panelTitleFilter}>
                    {" "}
                    —{" "}
                    {[
                      selectedCategory !== "All" ? selectedCategory : null,
                      selectedDateRange !== "All Time"
                        ? selectedDateRange
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </h2>


              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  style={styles.clearFilterButton}
                >
                  Clear Filters
                </button>
              )}
            </div>


            <div style={styles.dateRangePillRow}>
              {DATE_RANGE_OPTIONS.map((rangeLabel) => {
                const isActive = selectedDateRange === rangeLabel;


                return (
                  <button
                    key={rangeLabel}
                    type="button"
                    onClick={() => setSelectedDateRange(rangeLabel)}
                    style={{
                      ...styles.categoryPill,
                      ...(isActive ? styles.categoryPillActive : {}),
                    }}
                    aria-pressed={isActive}
                  >
                    {rangeLabel}
                  </button>
                );
              })}
            </div>


            {recentExpenses.length === 0 ? (
              <p style={styles.statusTextInline}>
                No expenses found for the selected filters.
              </p>
            ) : (
              <div style={styles.expenseList}>
                {recentExpenses.map((expense) => (
                  <div key={expense.id} style={styles.expenseRow}>
                    <div>
                      <p style={styles.expenseTitle}>{expense.title}</p>


                      <p style={styles.expenseMeta}>
                        {expense.category} · {formatDate(expense.date)}
                      </p>
                    </div>


                    <div style={styles.expenseRight}>
                      <p style={styles.expenseAmount}>
                        {formatCurrency(expense.amount)}
                      </p>


                      <button
                        type="button"
                        onClick={() => handleEdit(expense)}
                        disabled={deletingId === expense.id}
                        style={styles.editButton}
                        aria-label={`Edit ${expense.title}`}
                        title="Edit expense"
                      >
                        ✎
                      </button>


                      <button
                        type="button"
                        onClick={() => handleDelete(expense.id)}
                        disabled={deletingId === expense.id}
                        style={styles.deleteButton}
                        aria-label={`Delete ${expense.title}`}
                        title="Delete expense"
                      >
                        {deletingId === expense.id ? "..." : "🗑"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>


          {/* SPENDING OVERVIEW */}
          <section style={styles.panel}>
            <div style={styles.panelHeaderRow}>
              <h2 style={styles.panelTitle}>Spending Overview</h2>


              <button
                type="button"
                onClick={() => setSelectedCategory("All")}
                style={{
                  ...styles.categoryPill,
                  ...(selectedCategory === "All"
                    ? styles.categoryPillActive
                    : {}),
                }}
              >
                All Categories
              </button>
            </div>


            <div style={styles.categoryList}>
              {categoryEntries.map(([category, amount]) => {
                const percentage =
                  totalSpending > 0 ? (amount / totalSpending) * 100 : 0;


                const isSelected = selectedCategory === category;


                return (
                  <div
                    key={category}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleCategorySelect(category)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleCategorySelect(category);
                      }
                    }}
                    style={{
                      ...styles.categoryRow,
                      ...(isSelected ? styles.categoryRowSelected : {}),
                    }}
                    aria-pressed={isSelected}
                    aria-label={`Filter recent expenses by ${category}`}
                  >
                    <div style={styles.categoryHeader}>
                      <span
                        style={{
                          ...styles.categoryName,
                          ...(isSelected ? styles.categoryNameSelected : {}),
                        }}
                      >
                        {category}
                      </span>


                      <span style={styles.categoryAmount}>
                        {formatCurrency(amount)}
                      </span>
                    </div>


                    <div style={styles.barTrack}>
                      <div
                        style={{
                          ...styles.barFill,
                          width: `${percentage}%`,
                          ...(isSelected ? styles.barFillSelected : {}),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}


      {/* AI INSIGHT CARD */}
      <section style={styles.insightCard}>
        <p style={styles.insightLabel}>AI Insight</p>
        <p style={styles.insightText}>
          {aiInsightLoading
            ? "Analyzing your spending..."
            : aiInsightError
            ? aiInsightError
            : aiInsight?.summary || "No insights available yet."}
        </p>
      </section>
    </div>
  );
}


const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#0f0f14",
    color: "#ffffff",
    padding: "32px 24px",
    boxSizing: "border-box",
  },


  statusText: {
    color: "#9a9aa5",
    fontSize: "1rem",
    textAlign: "center",
    marginTop: "48px",
  },


  statusTextInline: {
    color: "#9a9aa5",
    fontSize: "0.9rem",
  },


  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "32px",
  },


  headerTitle: {
    fontSize: "1.75rem",
    fontWeight: 700,
    margin: 0,
  },


  headerSubtitle: {
    color: "#9a9aa5",
    fontSize: "1rem",
    marginTop: "6px",
  },


  headerActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },


  addExpenseButton: {
    padding: "12px 20px",
    background: "linear-gradient(135deg, #3b6ff2, #2952e0)",
    color: "#ffffff",
    border: "1px solid transparent",
    borderRadius: "10px",
    fontSize: "0.875rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
  },


  analyticsButton: {
    padding: "12px 20px",
    backgroundColor: "transparent",
    color: "#818cf8",
    border: "1px solid #6366f1",
    borderRadius: "10px",
    fontSize: "0.875rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: "pointer",
  },


  deleteErrorBanner: {
    backgroundColor: "rgba(240, 87, 107, 0.12)",
    border: "1px solid #f0576b",
    color: "#f0576b",
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "0.875rem",
    marginBottom: "20px",
  },


  summarySection: {
    marginBottom: "32px",
  },


  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    marginTop: "16px",
    marginBottom: "32px",
  },


  budgetOverviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
    marginTop: "16px",
  },


  budgetCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },


  budgetCardMonth: {
    color: "#9a9aa5",
    fontSize: "0.75rem",
    margin: 0,
  },


  budgetCardFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "10px",
    fontSize: "0.8rem",
  },


  card: {
    backgroundColor: "#1a1a22",
    border: "1px solid #2a2a35",
    borderRadius: "12px",
    padding: "20px",
  },


  cardLabel: {
    color: "#9a9aa5",
    fontSize: "0.875rem",
    margin: 0,
  },


  cardValue: {
    fontSize: "1.5rem",
    fontWeight: 700,
    marginTop: "8px",
    margin: 0,
  },


  emptyState: {
    backgroundColor: "#1a1a22",
    border: "1px solid #2a2a35",
    borderRadius: "12px",
    padding: "48px 24px",
    textAlign: "center",
    marginBottom: "32px",
  },


  emptyTitle: {
    fontSize: "1.25rem",
    fontWeight: 600,
    margin: 0,
  },


  emptyText: {
    color: "#9a9aa5",
    fontSize: "0.95rem",
    marginTop: "8px",
  },


  emptyStateButton: {
    marginTop: "20px",
    padding: "11px 18px",
    backgroundColor: "transparent",
    color: "#818cf8",
    border: "1px solid #6366f1",
    borderRadius: "10px",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
  },


  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "20px",
    marginBottom: "32px",
  },


  panel: {
    backgroundColor: "#1a1a22",
    border: "1px solid #2a2a35",
    borderRadius: "12px",
    padding: "20px",
  },


  panelHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "16px",
  },


  panelTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    margin: 0,
  },


  panelTitleFilter: {
    color: "#818cf8",
    fontWeight: 600,
  },


  clearFilterButton: {
    padding: "6px 12px",
    backgroundColor: "transparent",
    color: "#818cf8",
    border: "1px solid #6366f1",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },


  dateRangePillRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "16px",
  },


  categoryPill: {
    padding: "6px 12px",
    backgroundColor: "transparent",
    color: "#9a9aa5",
    border: "1px solid #2a2a35",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },


  categoryPillActive: {
    color: "#818cf8",
    borderColor: "#6366f1",
    backgroundColor: "rgba(99, 102, 241, 0.1)",
  },


  expenseList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },


  expenseRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    borderBottom: "1px solid #2a2a35",
    paddingBottom: "12px",
  },


  expenseTitle: {
    fontSize: "0.95rem",
    fontWeight: 500,
    margin: 0,
  },


  expenseMeta: {
    color: "#9a9aa5",
    fontSize: "0.8rem",
    marginTop: "4px",
  },


  expenseRight: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },


  expenseAmount: {
    fontSize: "0.95rem",
    fontWeight: 600,
    margin: 0,
    whiteSpace: "nowrap",
  },


  editButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    backgroundColor: "transparent",
    border: "1px solid #2a2a35",
    borderRadius: "8px",
    color: "#818cf8",
    fontSize: "0.9rem",
    cursor: "pointer",
    flexShrink: 0,
  },


  deleteButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    backgroundColor: "transparent",
    border: "1px solid #2a2a35",
    borderRadius: "8px",
    color: "#f0576b",
    fontSize: "0.9rem",
    cursor: "pointer",
    flexShrink: 0,
  },


  categoryList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },


  categoryRow: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid transparent",
    cursor: "pointer",
    transition: "background-color 0.15s ease, border-color 0.15s ease",
  },


  categoryRowSelected: {
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    border: "1px solid #6366f1",
  },


  categoryHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    fontSize: "0.875rem",
  },


  categoryName: {
    color: "#cfcfd8",
  },


  categoryNameSelected: {
    color: "#ffffff",
    fontWeight: 600,
  },


  categoryAmount: {
    color: "#ffffff",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },


  barTrack: {
    width: "100%",
    height: "8px",
    backgroundColor: "#24242e",
    borderRadius: "999px",
    overflow: "hidden",
    marginTop: "12px",
  },


  barFill: {
    height: "100%",
    backgroundColor: "#6366f1",
    borderRadius: "999px",
  },


  barFillSelected: {
    backgroundColor: "#818cf8",
  },


  insightCard: {
    backgroundColor: "#1a1a22",
    border: "1px solid #6366f1",
    borderRadius: "12px",
    padding: "20px",
  },


  insightLabel: {
    color: "#818cf8",
    fontSize: "0.8rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: 0,
  },


  insightText: {
    fontSize: "1rem",
    marginTop: "8px",
    margin: 0,
  },
};


export default Dashboard;
