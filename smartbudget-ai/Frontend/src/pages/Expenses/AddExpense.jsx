import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import styles from "./AddExpense.module.css";

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

const getToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const initialForm = {
  title: "",
  amount: "",
  category: "",
  date: getToday(),
};

function AddExpense() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));

    setErrors((previousErrors) => ({
      ...previousErrors,
      [name]: "",
    }));

    setApiError("");
  };

  const validateForm = () => {
    const nextErrors = {};
    const amount = Number(form.amount);

    if (!form.title.trim()) {
      nextErrors.title = "Expense title is required.";
    }

    if (!form.amount) {
      nextErrors.amount = "Amount is required.";
    } else if (Number.isNaN(amount) || amount <= 0) {
      nextErrors.amount = "Amount must be greater than 0.";
    }

    if (!form.category) {
      nextErrors.category = "Category is required.";
    }

    if (!form.date) {
      nextErrors.date = "Date is required.";
    }

    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const validationErrors = validateForm();

    setErrors(validationErrors);
    setApiError("");
    setSuccessMessage("");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await API.post("/expenses", {
        title: form.title.trim(),
        amount: Number(form.amount),
        category: form.category,
        date: form.date,
      });

      setSuccessMessage("Expense added successfully.");

      setTimeout(() => {
        navigate("/dashboard");
      }, 800);
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Failed to add expense. Please try again.";

      setApiError(message);
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      navigate("/dashboard");
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="add-expense-title">
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Transactions</p>
            <h1 id="add-expense-title" className={styles.title}>
              Add Expense
            </h1>
            <p className={styles.subtitle}>
              Record a transaction to keep your budget up to date.
            </p>
          </div>

          <button
            type="button"
            className={styles.backButton}
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Back
          </button>
        </div>

        {apiError && (
          <div className={styles.errorBanner} role="alert">
            {apiError}
          </div>
        )}

        {successMessage && (
          <div className={styles.successBanner} role="status">
            {successMessage}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="expense-title" className={styles.label}>
              Expense Title
            </label>

            <input
              id="expense-title"
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Netflix Subscription"
              className={`${styles.input} ${
                errors.title ? styles.invalid : ""
              }`}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "title-error" : undefined}
              disabled={isSubmitting}
            />

            {errors.title && (
              <span id="title-error" className={styles.fieldError}>
                {errors.title}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="expense-amount" className={styles.label}>
              Amount
            </label>

            <div className={styles.amountWrapper}>
              <span className={styles.currencySymbol}>₹</span>
              <input
                id="expense-amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.amount}
                onChange={handleChange}
                placeholder="0.00"
                className={`${styles.input} ${styles.amountInput} ${
                  errors.amount ? styles.invalid : ""
                }`}
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? "amount-error" : undefined}
                disabled={isSubmitting}
              />
            </div>

            {errors.amount && (
              <span id="amount-error" className={styles.fieldError}>
                {errors.amount}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="expense-category" className={styles.label}>
              Category
            </label>

            <select
              id="expense-category"
              name="category"
              value={form.category}
              onChange={handleChange}
              className={`${styles.input} ${styles.select} ${
                errors.category ? styles.invalid : ""
              }`}
              aria-invalid={Boolean(errors.category)}
              aria-describedby={
                errors.category ? "category-error" : undefined
              }
              disabled={isSubmitting}
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

            {errors.category && (
              <span id="category-error" className={styles.fieldError}>
                {errors.category}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="expense-date" className={styles.label}>
              Date
            </label>

            <input
              id="expense-date"
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              className={`${styles.input} ${
                errors.date ? styles.invalid : ""
              }`}
              aria-invalid={Boolean(errors.date)}
              aria-describedby={errors.date ? "date-error" : undefined}
              disabled={isSubmitting}
            />

            {errors.date && (
              <span id="date-error" className={styles.fieldError}>
                {errors.date}
              </span>
            )}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding Expense..." : "Add Expense"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default AddExpense;