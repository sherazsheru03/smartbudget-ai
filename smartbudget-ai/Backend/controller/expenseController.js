const Expense = require("../models/Expense");

exports.addExpense = async(req,res)=>{

    try{

        const user_id = req.user.id;

        const {
            title,
            amount,
            category,
            date
        } = req.body;

        const expense = await Expense.create(
            user_id,
            title,
            amount,
            category,
            date
        );

        res.status(201).json({
            message:"Expense added successfully",
            expense
        });

    }catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};

exports.getExpenses = async(req,res)=>{

    try{

        const expenses =
        await Expense.getAllByUser(req.user.id);

        res.json(expenses);

    }catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};

exports.deleteExpense = async(req,res)=>{

    try{

        const user_id = req.user.id;
        const { id } = req.params;

        const deletedExpense = await Expense.deleteById(id,user_id);

        if(!deletedExpense){
            return res.status(404).json({
                message:"Expense not found"
            });
        }

        res.status(200).json({
            message:"Expense deleted successfully",
            expense:deletedExpense
        });

    }catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};

exports.updateExpense = async(req,res)=>{

    try{

        const user_id = req.user.id;
        const { id } = req.params;

        const {
            title,
            amount,
            category,
            date
        } = req.body;

        const updatedExpense = await Expense.updateById(
            id,
            user_id,
            title,
            amount,
            category,
            date
        );

        if(!updatedExpense){
            return res.status(404).json({
                message:"Expense not found"
            });
        }

        res.status(200).json({
            message:"Expense updated successfully",
            expense:updatedExpense
        });

    }catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};

exports.getSummary = async(req,res)=>{

    try{

        const user_id = req.user.id;

        const totalsRow = await Expense.getMonthlyTotals(user_id);
        const topCategoryRow = await Expense.getTopCategoryForCurrentMonth(user_id);

        const currentMonthTotal = Number(totalsRow.current_month_total) || 0;
        const previousMonthTotal = Number(totalsRow.previous_month_total) || 0;
        const currentMonthTransactionCount = Number(totalsRow.current_month_count) || 0;

        let percentageChange = null;

        if(previousMonthTotal > 0){
            percentageChange =
                ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100;
            percentageChange = Math.round(percentageChange * 10) / 10;
        }else if(previousMonthTotal === 0 && currentMonthTotal > 0){
            percentageChange = null;
        }

        const topCategory = topCategoryRow ? topCategoryRow.category : null;

        const dayOfMonth = new Date().getDate();

        const dailyAverage =
            dayOfMonth > 0
                ? Math.round((currentMonthTotal / dayOfMonth) * 100) / 100
                : 0;

        res.status(200).json({
            currentMonthTotal,
            previousMonthTotal,
            percentageChange,
            topCategory,
            dailyAverage,
            currentMonthTransactionCount
        });

    }catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};

exports.getAnalytics = async(req,res)=>{

    try{

        const user_id = req.user.id;

        const monthlyTrendRows = await Expense.getMonthlyTrend(user_id);
        const categoryRows = await Expense.getCategoryBreakdown(user_id);
        const highestExpenseRow = await Expense.getHighestExpense(user_id);
        const totalTransactionsRow = await Expense.getTotalTransactionCount(user_id);

        const monthlyTrend = monthlyTrendRows.map((row)=>({
            month: row.month,
            total: Number(row.total) || 0
        }));

        const categoryTotalSum = categoryRows.reduce(
            (sum,row)=> sum + (Number(row.total) || 0),
            0
        );

        const categoryBreakdown = categoryRows.map((row)=>{

            const total = Number(row.total) || 0;

            const percentage =
                categoryTotalSum > 0
                    ? Math.round((total / categoryTotalSum) * 1000) / 10
                    : 0;

            return {
                category: row.category,
                total,
                percentage
            };

        });

        const highestExpense = highestExpenseRow
            ? {
                id: highestExpenseRow.id,
                title: highestExpenseRow.title,
                amount: highestExpenseRow.amount,
                category: highestExpenseRow.category,
                date: highestExpenseRow.date
            }
            : null;

        const totalTransactions =
            Number(totalTransactionsRow.total_transactions) || 0;

        const monthsWithData = monthlyTrend.length;

        const averageMonthlySpending =
            monthsWithData > 0
                ? Math.round(
                    (monthlyTrend.reduce((sum,entry)=> sum + entry.total, 0) /
                    monthsWithData) * 100
                  ) / 100
                : 0;

        const hasAnySpendingInTrend = monthlyTrend.some(
            (entry)=> entry.total > 0
        );

        const highestSpendingMonth = hasAnySpendingInTrend
            ? monthlyTrend.reduce(
                (max,entry)=> entry.total > max.total ? entry : max,
                monthlyTrend[0]
              )
            : null;

        res.status(200).json({
            monthlyTrend,
            categoryBreakdown,
            highestExpense,
            averageMonthlySpending,
            highestSpendingMonth,
            totalTransactions
        });

    }catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};