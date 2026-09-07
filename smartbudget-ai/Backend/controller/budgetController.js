const Budget = require("../models/Budget");
const { calculateBudgetProjection } = require("../utils/budgetProjection");
const {
    generateBudgetInsights,
    AIInsightServiceError
} = require("../services/aiInsightService");


const VALID_CATEGORIES = [
    "Food",
    "Transportation",
    "Shopping",
    "Entertainment",
    "Bills",
    "Healthcare",
    "Education",
    "Travel",
    "Other"
];


const isValidMonth = (month)=>{


    if(typeof month !== "string"){
        return false;
    }


    return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);


};


const normalizeMonth = (month)=>{


    if(!isValidMonth(month)){
        return null;
    }


    return `${month}-01`;


};


const validateBudgetInput = (category,amount,month)=>{


    if(
        typeof category !== "string" ||
        category.trim() === ""
    ){
        return "Category is required";
    }


    if(!VALID_CATEGORIES.includes(category)){
        return "Invalid category";
    }


    const numericAmount = Number(amount);


    if(
        amount === undefined ||
        amount === null ||
        amount === "" ||
        Number.isNaN(numericAmount) ||
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
    ){
        return "Amount must be greater than 0";
    }


    if(!month){
        return "Month is required";
    }


    if(!isValidMonth(month)){
        return "Month must be in YYYY-MM format";
    }


    return null;


};


const getCurrentMonthDayInfo = ()=>{


    const today = new Date();


    const daysElapsed = today.getDate();


    const daysInMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
    ).getDate();


    return {
        daysElapsed,
        daysInMonth
    };


};


exports.createBudget = async(req,res)=>{


    try{


        const user_id = req.user.id;


        const {
            category,
            amount,
            month
        } = req.body;


        const validationError = validateBudgetInput(
            category,
            amount,
            month
        );


        if(validationError){
            return res.status(400).json({
                message:validationError
            });
        }


        const normalizedMonth = normalizeMonth(month);


        const budget = await Budget.create(
            user_id,
            category,
            Number(amount),
            normalizedMonth
        );


        res.status(201).json({
            message:"Budget created successfully",
            budget
        });


    }catch(error){


        if(error.code === "23505"){
            return res.status(400).json({
                message:"A budget already exists for this category and month"
            });
        }


        res.status(500).json({
            message:"Failed to create budget"
        });


    }


};


exports.getBudgets = async(req,res)=>{


    try{


        const user_id = req.user.id;


        const budgets = await Budget.getAllByUser(user_id);


        res.status(200).json(budgets);


    }catch(error){


        res.status(500).json({
            message:"Failed to fetch budgets"
        });


    }


};


exports.getBudgetById = async(req,res)=>{


    try{


        const user_id = req.user.id;
        const { id } = req.params;


        const budget = await Budget.getById(
            id,
            user_id
        );


        if(!budget){
            return res.status(404).json({
                message:"Budget not found"
            });
        }


        res.status(200).json(budget);


    }catch(error){


        res.status(500).json({
            message:"Failed to fetch budget"
        });


    }


};


exports.updateBudget = async(req,res)=>{


    try{


        const user_id = req.user.id;
        const { id } = req.params;


        const existingBudget = await Budget.getById(
            id,
            user_id
        );


        if(!existingBudget){
            return res.status(404).json({
                message:"Budget not found"
            });
        }


        const category =
            req.body.category !== undefined
                ? req.body.category
                : existingBudget.category;


        const amount =
            req.body.amount !== undefined
                ? req.body.amount
                : existingBudget.amount;


        let month;


        if(req.body.month !== undefined){


            month = req.body.month;


        }else{


            month = String(existingBudget.month).slice(0,7);


        }


        const validationError = validateBudgetInput(
            category,
            amount,
            month
        );


        if(validationError){
            return res.status(400).json({
                message:validationError
            });
        }


        const normalizedMonth = normalizeMonth(month);


        const updatedBudget = await Budget.updateById(
            id,
            user_id,
            category,
            Number(amount),
            normalizedMonth
        );


        if(!updatedBudget){
            return res.status(404).json({
                message:"Budget not found"
            });
        }


        res.status(200).json({
            message:"Budget updated successfully",
            budget:updatedBudget
        });


    }catch(error){


        if(error.code === "23505"){
            return res.status(400).json({
                message:"A budget already exists for this category and month"
            });
        }


        res.status(500).json({
            message:"Failed to update budget"
        });


    }


};


exports.deleteBudget = async(req,res)=>{


    try{


        const user_id = req.user.id;
        const { id } = req.params;


        const deletedBudget = await Budget.deleteById(
            id,
            user_id
        );


        if(!deletedBudget){
            return res.status(404).json({
                message:"Budget not found"
            });
        }


        res.status(200).json({
            message:"Budget deleted successfully",
            budget:deletedBudget
        });


    }catch(error){


        res.status(500).json({
            message:"Failed to delete budget"
        });


    }


};


exports.getBudgetsWithSpending = async(req,res)=>{


    try{


        const user_id = req.user.id;


        const budgets =
            await Budget.getBudgetsWithSpending(user_id);


        res.status(200).json({
            message:"Budget spending fetched successfully",
            budgets
        });


    }catch(error){


        res.status(500).json({
            message:"Failed to fetch budget spending"
        });


    }


};


exports.getBudgetInsights = async(req,res)=>{


    try{


        const user_id = req.user.id;


        const budgets =
            await Budget.getBudgetsWithSpending(user_id);


        const { daysElapsed, daysInMonth } = getCurrentMonthDayInfo();


        const budgetData = budgets.map((budget)=>{


            const projection = calculateBudgetProjection(
                budget.budgetAmount,
                budget.actualSpending,
                daysElapsed,
                daysInMonth
            );


            return {
                budgetId:budget.id,
                category:budget.category,
                budgetAmount:budget.budgetAmount,
                actualSpending:budget.actualSpending,
                remainingAmount:budget.remainingAmount,
                percentageUsed:budget.percentageUsed,
                dailyBurnRate:projection.dailyBurnRate,
                projectedTotal:projection.projectedTotal,
                projectedOverage:projection.projectedOverage,
                daysRemaining:projection.daysRemaining
            };


        });


        const { insights, summary } =
            await generateBudgetInsights(budgetData);


        res.status(200).json({
            message:"Budget insights fetched successfully",
            insights,
            summary
        });


    }catch(error){


        if(error instanceof AIInsightServiceError){


            return res.status(502).json({
                message:"Failed to generate budget insights",
                code:error.code
            });


        }


        res.status(500).json({
            message:"Failed to fetch budget insights"
        });


    }


};
