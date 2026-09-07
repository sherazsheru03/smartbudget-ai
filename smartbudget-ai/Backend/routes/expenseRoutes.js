const express = require("express");

const router = express.Router();

const {
    addExpense,
    getExpenses,
    deleteExpense,
    updateExpense,
    getSummary,
    getAnalytics
}
=
require("../controller/expenseController");

const authMiddleware =
require("../middleware/authMiddleware");

router.get(
"/summary",
authMiddleware,
getSummary
);

router.get(
"/analytics",
authMiddleware,
getAnalytics
);

router.post(
"/",
authMiddleware,
addExpense
);

router.get(
"/",
authMiddleware,
getExpenses
);

router.delete(
"/:id",
authMiddleware,
deleteExpense
);

router.put(
"/:id",
authMiddleware,
updateExpense
);

module.exports = router;