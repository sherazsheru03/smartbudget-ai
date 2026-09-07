const db = require("../config/database");

const Budget = {

    create: async(user_id,category,amount,month)=>{

        const result = await db.query(
            `
            INSERT INTO budgets
            (user_id,category,amount,month)
            VALUES($1,$2,$3,$4)
            RETURNING
                id,
                user_id,
                category,
                amount,
                TO_CHAR(month, 'YYYY-MM') AS month,
                created_at,
                updated_at
            `,
            [
                user_id,
                category,
                amount,
                month
            ]
        );

        return result.rows[0];

    },

    getAllByUser: async(user_id)=>{

        const result = await db.query(
            `
            SELECT
                id,
                user_id,
                category,
                amount,
                TO_CHAR(month, 'YYYY-MM') AS month,
                created_at,
                updated_at
            FROM budgets
            WHERE user_id=$1
            ORDER BY month DESC, created_at DESC
            `,
            [user_id]
        );

        return result.rows;

    },

    getById: async(id,user_id)=>{

        const result = await db.query(
            `
            SELECT
                id,
                user_id,
                category,
                amount,
                TO_CHAR(month, 'YYYY-MM') AS month,
                created_at,
                updated_at
            FROM budgets
            WHERE id=$1 AND user_id=$2
            `,
            [
                id,
                user_id
            ]
        );

        return result.rows[0];

    },

    updateById: async(id,user_id,category,amount,month)=>{

        const result = await db.query(
            `
            UPDATE budgets
            SET
                category=$1,
                amount=$2,
                month=$3,
                updated_at=NOW()
            WHERE id=$4 AND user_id=$5
            RETURNING
                id,
                user_id,
                category,
                amount,
                TO_CHAR(month, 'YYYY-MM') AS month,
                created_at,
                updated_at
            `,
            [
                category,
                amount,
                month,
                id,
                user_id
            ]
        );

        return result.rows[0];

    },

    deleteById: async(id,user_id)=>{

        const result = await db.query(
            `
            DELETE FROM budgets
            WHERE id=$1 AND user_id=$2
            RETURNING
                id,
                user_id,
                category,
                amount,
                TO_CHAR(month, 'YYYY-MM') AS month,
                created_at,
                updated_at
            `,
            [
                id,
                user_id
            ]
        );

        return result.rows[0];

    },

    getBudgetsWithSpending: async(user_id)=>{

        const result = await db.query(
            `
            SELECT
                budgets.id,
                budgets.category,
                budgets.amount,
                TO_CHAR(budgets.month, 'YYYY-MM') AS month,
                COALESCE(SUM(expenses.amount), 0) AS actual_spending
            FROM budgets
            LEFT JOIN expenses
                ON expenses.user_id = budgets.user_id
                AND expenses.category = budgets.category
                AND date_trunc('month', expenses.date) = budgets.month
            WHERE budgets.user_id=$1
            GROUP BY
                budgets.id,
                budgets.category,
                budgets.amount,
                budgets.month
            ORDER BY
                budgets.month DESC,
                budgets.created_at DESC
            `,
            [user_id]
        );

        return result.rows.map((row)=>{

            const budgetAmount = Number(row.amount) || 0;
            const actualSpending = Number(row.actual_spending) || 0;

            const remainingAmount =
                budgetAmount - actualSpending;

            const percentageUsed =
                budgetAmount > 0
                    ? (actualSpending / budgetAmount) * 100
                    : 0;

            return {
                id: row.id,
                category: row.category,
                budgetAmount,
                month: row.month,
                actualSpending,
                remainingAmount,
                percentageUsed
            };

        });

    }

};

module.exports = Budget;