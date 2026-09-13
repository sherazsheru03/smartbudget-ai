const Budget = require("../models/Budget");
const Notification = require("../models/Notification");
const { calculateBudgetProjection } = require("../utils/budgetProjection");
const { getBudgetAlerts } = require("../utils/budgetAlerts");


const getDayInfoForTargetMonth = (month)=>{


    const [targetYearString,targetMonthString] = month.split("-");


    const targetYear = Number(targetYearString);
    const targetMonthIndex = Number(targetMonthString) - 1;


    const daysInMonth = new Date(
        targetYear,
        targetMonthIndex + 1,
        0
    ).getDate();


    const today = new Date();


    const isCurrentMonth =
        today.getFullYear() === targetYear &&
        today.getMonth() === targetMonthIndex;


    if(isCurrentMonth){


        return {
            daysElapsed:today.getDate(),
            daysInMonth
        };


    }


    const targetMonthStart = new Date(targetYear,targetMonthIndex,1);
    const currentMonthStart = new Date(today.getFullYear(),today.getMonth(),1);


    const isPastMonth = targetMonthStart < currentMonthStart;


    if(isPastMonth){


        return {
            daysElapsed:daysInMonth,
            daysInMonth
        };


    }


    return {
        daysElapsed:0,
        daysInMonth
    };


};


const buildAlertMessage = (alertCode,budgetDataItem)=>{


    const { category } = budgetDataItem;


    switch(alertCode){


        case "BUDGET_EXCEEDED":
            return `Your ${category} budget has been exceeded.`;


        case "BUDGET_NEAR_LIMIT":
            return `Your ${category} budget is nearing its limit.`;


        case "PROJECTED_OVER_BUDGET":
            return `Your ${category} spending is projected to go over budget by month end.`;


        case "BUDGET_EXHAUSTED":
            return `You have no remaining budget left for ${category}.`;


        default:
            return `A budget alert was triggered for ${category}.`;


    }


};


/**
 * Evaluates deterministic budget alerts for a single user/category/month
 * and persists any triggered alerts as notifications.
 *
 * This function never involves Gemini/AI. It reuses the existing
 * budgetProjection.js and budgetAlerts.js utilities exactly as
 * budgetController.js does, so alert thresholds are calculated in exactly
 * one place in the codebase.
 *
 * Safe to call repeatedly: duplicate notifications are silently ignored by
 * the existing UNIQUE (user_id, budget_id, month, alert_code) constraint
 * via Notification.create()'s ON CONFLICT DO NOTHING behavior. No
 * "does notification already exist?" query is performed here.
 *
 * @param {number} user_id
 * @param {string} category
 * @param {string} month - "YYYY-MM" format, matching Budget.js conventions.
 * @returns {Promise<{ evaluated:boolean, budgetId:number|null, alerts:string[], createdNotifications:object[] }>}
 */
const evaluateAndPersistBudgetNotifications = async(user_id,category,month)=>{


    const budgets = await Budget.getBudgetsWithSpending(user_id);


    const matchingBudget = budgets.find(
        (budget)=>
            budget.category === category &&
            budget.month === month
    );


    if(!matchingBudget){


        return {
            evaluated:false,
            budgetId:null,
            alerts:[],
            createdNotifications:[]
        };


    }


    const { daysElapsed, daysInMonth } = getDayInfoForTargetMonth(month);


    const projection = calculateBudgetProjection(
        matchingBudget.budgetAmount,
        matchingBudget.actualSpending,
        daysElapsed,
        daysInMonth
    );


    const alerts = getBudgetAlerts({
        percentageUsed:matchingBudget.percentageUsed,
        projectedPercentage:projection.projectedPercentage,
        remainingAmount:matchingBudget.remainingAmount
    });


    // Notification.create() persists to a PostgreSQL DATE column. The
    // `month` parameter above is intentionally kept as "YYYY-MM" for
    // matching against Budget.js's TO_CHAR(...,'YYYY-MM') convention, but
    // "YYYY-MM" alone is not valid DATE input for a parameterized insert
    // (causes PostgreSQL error 22007: invalid input syntax for type date).
    // Derive the canonical first-of-month DATE string only for persistence.
    const notificationMonth = `${month}-01`;


    const createdNotifications = [];


    for(const alertCode of alerts){


        const message = buildAlertMessage(alertCode,matchingBudget);


        const notification = await Notification.create(
            user_id,
            matchingBudget.id,
            notificationMonth,
            alertCode,
            message
        );


        if(notification){
            createdNotifications.push(notification);
        }


    }


    return {
        evaluated:true,
        budgetId:matchingBudget.id,
        alerts,
        createdNotifications
    };


};


module.exports = { evaluateAndPersistBudgetNotifications };
