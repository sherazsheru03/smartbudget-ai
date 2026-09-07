const express = require("express");


const router = express.Router();


const {
    getBudgets,
    getBudgetById,
    createBudget,
    updateBudget,
    deleteBudget,
    getBudgetsWithSpending,
    getBudgetInsights
}
=
require("../controller/budgetController");


const authMiddleware =
require("../middleware/authMiddleware");


router.get(
"/",
authMiddleware,
getBudgets
);


router.get(
"/spending",
authMiddleware,
getBudgetsWithSpending
);


router.get(
"/insights",
authMiddleware,
getBudgetInsights
);


router.get(
"/:id",
authMiddleware,
getBudgetById
);


router.post(
"/",
authMiddleware,
createBudget
);


router.put(
"/:id",
authMiddleware,
updateBudget
);


router.delete(
"/:id",
authMiddleware,
deleteBudget
);


module.exports = router;
