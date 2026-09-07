const db = require("../config/database");

const Expense = {

    create: async(user_id,title,amount,category,date)=>{

        const result = await db.query(
            `
            INSERT INTO expenses
            (user_id,title,amount,category,date)
            VALUES($1,$2,$3,$4,$5)
            RETURNING *
            `,
            [
                user_id,
                title,
                amount,
                category,
                date
            ]
        );

        return result.rows[0];

    },

    getAllByUser: async(user_id)=>{

        const result = await db.query(
            `
            SELECT * FROM expenses
            WHERE user_id=$1
            ORDER BY created_at DESC
            `,
            [user_id]
        );

        return result.rows;

    },

    deleteById: async(id,user_id)=>{

        const result = await db.query(
            `
            DELETE FROM expenses
            WHERE id=$1 AND user_id=$2
            RETURNING *
            `,
            [id,user_id]
        );

        return result.rows[0];

    },

    updateById: async(id,user_id,title,amount,category,date)=>{

        const result = await db.query(
            `
            UPDATE expenses
            SET title=$1, amount=$2, category=$3, date=$4
            WHERE id=$5 AND user_id=$6
            RETURNING *
            `,
            [
                title,
                amount,
                category,
                date,
                id,
                user_id
            ]
        );

        return result.rows[0];

    },

    getMonthlyTotals: async(user_id)=>{

        const result = await db.query(
            `
            SELECT
                COALESCE(SUM(amount) FILTER (
                    WHERE date >= date_trunc('month', CURRENT_DATE)
                ), 0) AS current_month_total,
                COALESCE(SUM(amount) FILTER (
                    WHERE date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                      AND date < date_trunc('month', CURRENT_DATE)
                ), 0) AS previous_month_total,
                COUNT(*) FILTER (
                    WHERE date >= date_trunc('month', CURRENT_DATE)
                ) AS current_month_count
            FROM expenses
            WHERE user_id=$1
            `,
            [user_id]
        );

        return result.rows[0];

    },

    getTopCategoryForCurrentMonth: async(user_id)=>{

        const result = await db.query(
            `
            SELECT category, SUM(amount) AS total
            FROM expenses
            WHERE user_id=$1
              AND date >= date_trunc('month', CURRENT_DATE)
            GROUP BY category
            ORDER BY total DESC
            LIMIT 1
            `,
            [user_id]
        );

        return result.rows[0];

    },

    getMonthlyTrend: async(user_id)=>{

        const result = await db.query(
            `
            SELECT
                to_char(month_series, 'YYYY-MM') AS month,
                COALESCE(SUM(expenses.amount), 0) AS total
            FROM generate_series(
                date_trunc('month', CURRENT_DATE - INTERVAL '5 months'),
                date_trunc('month', CURRENT_DATE),
                INTERVAL '1 month'
            ) AS month_series
            LEFT JOIN expenses
                ON date_trunc('month', expenses.date) = month_series
                AND expenses.user_id = $1
            GROUP BY month_series
            ORDER BY month_series
            `,
            [user_id]
        );

        return result.rows;

    },

    getCategoryBreakdown: async(user_id)=>{

        const result = await db.query(
            `
            SELECT category, SUM(amount) AS total
            FROM expenses
            WHERE user_id=$1
            GROUP BY category
            ORDER BY total DESC
            `,
            [user_id]
        );

        return result.rows;

    },

    getHighestExpense: async(user_id)=>{

        const result = await db.query(
            `
            SELECT id, title, amount, category, date
            FROM expenses
            WHERE user_id=$1
            ORDER BY amount DESC
            LIMIT 1
            `,
            [user_id]
        );

        return result.rows[0];

    },

    getTotalTransactionCount: async(user_id)=>{

        const result = await db.query(
            `
            SELECT COUNT(*) AS total_transactions
            FROM expenses
            WHERE user_id=$1
            `,
            [user_id]
        );

        return result.rows[0];

    }

};

module.exports = Expense;