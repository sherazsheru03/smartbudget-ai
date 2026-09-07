import { useState, useEffect } from "react";
import {
  getBudgetSpending,
  createBudget,
  updateBudget,
  deleteBudget,
} from "../../services/budgetService";
import styles from "./Budgets.module.css";

const CATEGORIES = [
  "Food",
  "Transportation",
  "Shopping",
  "Entertainment",
  "Bills",
  "Healthcare",
  "Education",
  "Travel",
  "Other",
];

const getCurrentMonthValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
};

const formatCurrency = (value) => {
  const number = Number(value) || 0;

  return `₹${number.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
};

const emptyForm = {
  category: "",
  amount: "",
  month: getCurrentMonthValue(),
};

function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [formApiError, setFormApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const fetchBudgets = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getBudgetSpending();
      const data = response.data?.budgets;

      setBudgets(Array.isArray(data) ? data : []);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to load budgets. Please try again.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const openAddForm = () => {
    setEditingBudgetId(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormApiError("");
    setIsFormOpen(true);
  };

  const openEditForm = (budget) => {
    setEditingBudgetId(budget.id);
    setForm({
      category: budget.category,
      amount: String(budget.budgetAmount),
      month: budget.month,
    });
    setFormErrors({});
    setFormApiError("");
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSubmitting) {
      return;
    }

    setIsFormOpen(false);
    setEditingBudgetId(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormApiError("");
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({ ...previous, [name]: value }));
    setFormErrors((previous) => ({ ...previous, [name]: "" }));
    setFormApiError("");
  };

  const validateForm = () => {
    const nextErrors = {};
    const numericAmount = Number(form.amount);

    if (!form.category) {
      nextErrors.category = "Category is required.";
    }

    if (!form.amount) {
      nextErrors.amount = "Amount is required.";
    } else if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      nextErrors.amount = "Amount must be greater than 0.";
    }

    if (!form.month) {
      nextErrors.month = "Month is required.";
    }

    return nextErrors;
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const validationErrors = validateForm();

    setFormErrors(validationErrors);
    setFormApiError("");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        category: form.category,
        amount: Number(form.amount),
        month: form.month,
      };

      if (editingBudgetId) {
        await updateBudget(editingBudgetId, payload);
        setSuccessMessage("Budget updated successfully.");
      } else {
        await createBudget(payload);
        setSuccessMessage("Budget added successfully.");
      }

      setIsFormOpen(false);
      setEditingBudgetId(null);
      setForm(emptyForm);
      await fetchBudgets();

      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to save budget. Please try again.";

      setFormApiError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (budget) => {
    if (deletingId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete the budget for ${budget.category}?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(budget.id);
    setActionError("");

    try {
      await deleteBudget(budget.id);
      await fetchBudgets();
      setSuccessMessage("Budget deleted successfully.");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to delete budget. Please try again.";

      setActionError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const getProgressState = (percentageUsed) => {
    if (percentageUsed >= 100) {
      return "exceeded";
    }

    if (percentageUsed >= 80) {
      return "warning";
    }

    return "normal";
  };

  const progressColor = {
    normal: "var(--color-primary-500)",
    warning: "var(--color-warning-500)",
    exceeded: "var(--color-danger-500)",
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.statusText}>Loading your budgets...</p>
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Planning</p>
          <h1 className={styles.title}>Budgets</h1>
          <p className={styles.subtitle}>
            Set monthly spending limits and track your progress.
          </p>
        </div>

        <button
          type="button"
          className={styles.addButton}
          onClick={openAddForm}
        >
          + Add Budget
        </button>
      </header>

      {successMessage && (
        <div className={styles.successBanner} role="status">
          {successMessage}
        </div>
      )}

      {actionError && (
        <div className={styles.errorBanner} role="alert">
          {actionError}
        </div>
      )}

      {isFormOpen && (
        <div className={styles.formOverlay} onClick={closeForm}>
          <div
            className={styles.formCard}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className={styles.formTitle}>
              {editingBudgetId ? "Edit Budget" : "Add Budget"}
            </h2>

            {formApiError && (
              <div className={styles.errorBanner} role="alert">
                {formApiError}
              </div>
            )}

            <form
              onSubmit={handleFormSubmit}
              className={styles.form}
              noValidate
            >
              <div className={styles.field}>
                <label htmlFor="budget-category" className={styles.label}>
                  Category
                </label>

                <select
                  id="budget-category"
                  name="category"
                  value={form.category}
                  onChange={handleFormChange}
                  className={`${styles.input} ${
                    formErrors.category ? styles.invalid : ""
                  }`}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(formErrors.category)}
                >
                  <option value="" disabled>
                    Select a category
                  </option>

                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                {formErrors.category && (
                  <span className={styles.fieldError}>
                    {formErrors.category}
                  </span>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="budget-amount" className={styles.label}>
                  Amount
                </label>

                <input
                  id="budget-amount"
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={handleFormChange}
                  placeholder="0.00"
                  className={`${styles.input} ${
                    formErrors.amount ? styles.invalid : ""
                  }`}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(formErrors.amount)}
                />

                {formErrors.amount && (
                  <span className={styles.fieldError}>
                    {formErrors.amount}
                  </span>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="budget-month" className={styles.label}>
                  Month
                </label>

                <input
                  id="budget-month"
                  name="month"
                  type="month"
                  value={form.month}
                  onChange={handleFormChange}
                  className={`${styles.input} ${
                    formErrors.month ? styles.invalid : ""
                  }`}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(formErrors.month)}
                />

                {formErrors.month && (
                  <span className={styles.fieldError}>
                    {formErrors.month}
                  </span>
                )}
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={closeForm}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingBudgetId
                    ? "Save Changes"
                    : "Add Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {budgets.length === 0 ? (
        <section className={styles.emptyState}>
          <p className={styles.emptyTitle}>No budgets yet</p>

          <p className={styles.emptyText}>
            Set monthly spending limits for categories to stay on track.
          </p>

          <button
            type="button"
            className={styles.emptyStateButton}
            onClick={openAddForm}
          >
            + Add Budget
          </button>
        </section>
      ) : (
        <div className={styles.budgetGrid}>
          {budgets.map((budget) => {
            const state = getProgressState(budget.percentageUsed);
            const visualWidth = Math.min(budget.percentageUsed, 100);
            const isOverBudget = budget.remainingAmount < 0;

            return (
              <div key={budget.id} className={styles.budgetCard}>
                <div className={styles.budgetCardHeader}>
                  <div>
                    <h3 className={styles.budgetCategory}>
                      {budget.category}
                    </h3>
                    <p className={styles.budgetMonth}>{budget.month}</p>
                  </div>

                  <div className={styles.budgetCardActions}>
                    <button
                      type="button"
                      className={styles.editButton}
                      onClick={() => openEditForm(budget)}
                      aria-label={`Edit ${budget.category} budget`}
                      title="Edit budget"
                    >
                      ✎
                    </button>

                    <button
                      type="button"
                      className={styles.deleteButton}
                      onClick={() => handleDelete(budget)}
                      disabled={deletingId === budget.id}
                      aria-label={`Delete ${budget.category} budget`}
                      title="Delete budget"
                    >
                      {deletingId === budget.id ? "..." : "🗑"}
                    </button>
                  </div>
                </div>

                <p className={styles.budgetAmounts}>
                  {formatCurrency(budget.actualSpending)} /{" "}
                  {formatCurrency(budget.budgetAmount)}
                </p>

                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${visualWidth}%`,
                      backgroundColor: progressColor[state],
                    }}
                  />
                </div>

                <div className={styles.budgetFooter}>
                  <span
                    className={styles.percentageLabel}
                    style={{ color: progressColor[state] }}
                  >
                    {budget.percentageUsed}%
                  </span>

                  <span
                    className={
                      isOverBudget
                        ? styles.remainingOver
                        : styles.remainingNormal
                    }
                  >
                    {isOverBudget
                      ? `${formatCurrency(
                          Math.abs(budget.remainingAmount)
                        )} over budget`
                      : `${formatCurrency(budget.remainingAmount)} remaining`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Budgets;