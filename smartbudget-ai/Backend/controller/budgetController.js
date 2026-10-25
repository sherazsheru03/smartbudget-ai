const Budget = require("../models/Budget");
const { calculateBudgetProjection } = require("../utils/budgetProjection");
const { getBudgetAlerts } = require("../utils/budgetAlerts");
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




const MONTH_LABELS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
];




const EMPTY_INSIGHTS_SUMMARY =
    "No budgets found yet. Create a budget to see personalised insights.";




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




const toNumber = (value)=>{




    const numericValue = Number(value);




    return Number.isFinite(numericValue) ? numericValue : 0;




};




const getBudgetMonthKey = (budgetMonth)=>{




    const monthString = String(budgetMonth).slice(0,7);




    return isValidMonth(monthString) ? monthString : null;




};




const formatMonthLabel = (monthKey)=>{




    if(!monthKey){
        return "";
    }




    return `${MONTH_LABELS[Number(monthKey.slice(5,7)) - 1]} ${monthKey.slice(0,4)}`;




};




const getDayInfoForBudgetMonth = (budgetMonth)=>{




    const today = new Date();




    const monthString = String(budgetMonth).slice(0,7);




    const targetYear = isValidMonth(monthString)
        ? Number(monthString.slice(0,4))
        : today.getFullYear();




    const targetMonth = isValidMonth(monthString)
        ? Number(monthString.slice(5,7))
        : today.getMonth() + 1;




    const daysInMonth = new Date(
        targetYear,
        targetMonth,
        0
    ).getDate();




    const targetIndex = targetYear * 12 + targetMonth;
    const currentIndex = today.getFullYear() * 12 + (today.getMonth() + 1);




    let daysElapsed;
    let monthStatus;




    if(targetIndex === currentIndex){
        daysElapsed = today.getDate();
        monthStatus = "CURRENT";
    }else if(targetIndex < currentIndex){
        daysElapsed = daysInMonth;
        monthStatus = "PAST";
    }else{
        daysElapsed = 0;
        monthStatus = "FUTURE";
    }




    return {
        daysElapsed,
        daysInMonth,
        monthStatus
    };




};




const getSpendingStatus = (remainingAmount)=>{




    const remaining = toNumber(remainingAmount);




    if(remaining < 0){
        return "OVER_BUDGET";
    }




    if(remaining === 0){
        return "BUDGET_USED_UP";
    }




    return "WITHIN_BUDGET";




};




const getProjectionStatus = (monthStatus,projectedTotal,budgetAmount)=>{




    if(monthStatus === "PAST"){
        return "PERIOD_ENDED";
    }




    if(monthStatus === "FUTURE"){
        return "NOT_STARTED";
    }




    return toNumber(projectedTotal) > toNumber(budgetAmount)
        ? "PROJECTED_OVER_BUDGET"
        : "PROJECTED_WITHIN_BUDGET";




};




const formatCurrencyForInsight = (value)=>{




    const safeValue = toNumber(value);




    return `₹${safeValue.toLocaleString("en-IN",{
        minimumFractionDigits:0,
        maximumFractionDigits:0
    })}`;




};




const formatPercentForInsight = (value)=>{




    return `${Math.round(toNumber(value) * 10) / 10}%`;




};




const getBudgetName = (budgetDataItem)=>{




    const { category, monthLabel } = budgetDataItem;




    return monthLabel
        ? `${category} budget for ${monthLabel}`
        : `${category} budget`;




};




/**
 * Builds the final recommendation text using ONLY backend-calculated
 * numbers. The model's wording for this field is intentionally discarded and
 * replaced here, because free-text generation cannot be trusted to copy a
 * numeric value byte-for-byte into prose. This guarantees the number shown to
 * the user always matches budgetProjection.js.
 */
const buildTrustedRecommendation = (budgetDataItem)=>{




    const {
        category,
        monthLabel,
        monthStatus,
        spendingStatus,
        remainingAmount,
        recommendedDailySpend,
        daysRemaining
    } = budgetDataItem;




    const budgetName = getBudgetName(budgetDataItem);




    if(monthStatus === "PAST"){




        if(spendingStatus === "OVER_BUDGET"){
            return `The ${budgetName} has ended. Consider reviewing what drove this spending when you plan your next ${category} budget.`;
        }




        return `The ${budgetName} has ended. You can use it as a reference when planning your next ${category} budget.`;




    }




    if(monthStatus === "FUTURE"){




        return `The ${budgetName} has not started yet. Spending will be tracked once the month begins.`;




    }




    const safeDaysRemaining = toNumber(daysRemaining);




    if(safeDaysRemaining <= 0){




        return `There are no days left in the ${budgetName}. Review the final spending before planning the next period.`;




    }




    if(toNumber(remainingAmount) <= 0){




        return `You have no remaining ${category} budget${monthLabel ? ` for ${monthLabel}` : ""}. Consider limiting further ${category} spending for the rest of the month.`;




    }




    const dayText = safeDaysRemaining === 1 ? "day" : "days";




    return `You have ${formatCurrencyForInsight(remainingAmount)} left for the next ${safeDaysRemaining} ${dayText}. Keeping ${category} spending near ${formatCurrencyForInsight(Math.max(toNumber(recommendedDailySpend),0))} a day should help you stay within budget.`;




};




/**
 * Deterministic message used whenever the model's wording is missing,
 * unmatched, or fails the trust checks below. Uses backend figures only.
 */
const buildTrustedMessage = (budgetDataItem)=>{




    const {
        monthStatus,
        spendingStatus,
        projectionStatus,
        budgetAmount,
        actualSpending,
        remainingAmount,
        percentageUsed,
        projectedTotal,
        projectedOverage
    } = budgetDataItem;




    const budgetName = getBudgetName(budgetDataItem);
    const spent = formatCurrencyForInsight(actualSpending);
    const limit = formatCurrencyForInsight(budgetAmount);
    const percent = formatPercentForInsight(percentageUsed);
    const overBy = formatCurrencyForInsight(Math.abs(toNumber(remainingAmount)));




    if(monthStatus === "FUTURE"){




        return `The ${budgetName} is set at ${limit} and has not started yet.`;




    }




    if(monthStatus === "PAST"){




        if(spendingStatus === "OVER_BUDGET"){
            return `You finished the ${budgetName} having spent ${spent} of ${limit} (${percent}), which is ${overBy} over budget.`;
        }




        return `You finished the ${budgetName} having spent ${spent} of ${limit} (${percent}).`;




    }




    const baseMessage = `You have spent ${spent} of your ${limit} ${budgetName} (${percent}).`;




    if(spendingStatus === "OVER_BUDGET"){
        return `${baseMessage} You are already ${overBy} over budget.`;
    }




    if(spendingStatus === "BUDGET_USED_UP"){
        return `${baseMessage} You have used up the full budget.`;
    }




    if(projectionStatus === "PROJECTED_OVER_BUDGET"){




        const projectedOverBy = toNumber(projectedOverage) > 0
            ? toNumber(projectedOverage)
            : Math.max(toNumber(projectedTotal) - toNumber(budgetAmount),0);




        return `${baseMessage} At this pace you may finish around ${formatCurrencyForInsight(projectedTotal)}, about ${formatCurrencyForInsight(projectedOverBy)} over budget.`;




    }




    return `${baseMessage} At this pace you are on track to finish around ${formatCurrencyForInsight(projectedTotal)}, within budget.`;




};




/**
 * Deterministic overall summary used when the model's summary is missing or
 * fails the trust checks below.
 */
const buildTrustedSummary = (budgetData)=>{




    if(budgetData.length === 0){
        return EMPTY_INSIGHTS_SUMMARY;
    }




    const totalCount = budgetData.length;




    const overBudgetCount = budgetData.filter(
        (item)=>item.spendingStatus === "OVER_BUDGET"
    ).length;




    const projectedOverCount = budgetData.filter(
        (item)=>
            item.spendingStatus !== "OVER_BUDGET" &&
            item.projectionStatus === "PROJECTED_OVER_BUDGET"
    ).length;




    const parts = [
        `You are tracking ${totalCount} ${totalCount === 1 ? "budget" : "budgets"}.`
    ];




    if(overBudgetCount === 0 && projectedOverCount === 0){
        parts.push("All of them are currently within budget.");
    }




    if(overBudgetCount > 0){
        parts.push(`${overBudgetCount} ${overBudgetCount === 1 ? "is" : "are"} over budget.`);
    }




    if(projectedOverCount > 0){
        parts.push(`${projectedOverCount} ${projectedOverCount === 1 ? "is" : "are"} projected to go over budget this month.`);
    }




    return parts.join(" ");




};




/**
 * Trust checks for model-written text. The model only supplies wording;
 * any text that exposes internal IDs, uses a non-rupee currency, quotes a
 * figure that the backend did not supply, names the wrong month, or
 * contradicts the backend status is replaced with deterministic text.
 */
const FORBIDDEN_TEXT_PATTERNS = [
    /\$/,
    /\bUSD\b/i,
    /\bdollars?\b/i,
    /\bbudget\s*(?:id\s*)?#?\s*\d+/i,
    /\bbudget\s*id\b/i,
    /\bbudgetId\b/i,
    /\(\s*id\b/i
];




const MONTH_NAME_PATTERN =
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/gi;




const extractNumbersFromText = (text)=>{




    return (String(text).match(/\d+(?:,\d+)*(?:\.\d+)?/g) || [])
        .map((numberText)=>Number(numberText.replace(/,/g,"")))
        .filter((value)=>Number.isFinite(value));




};




const extractMonthLabelsFromText = (text)=>{




    return Array.from(String(text).matchAll(MONTH_NAME_PATTERN)).map((match)=>{
        const monthName = match[1];
        return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1).toLowerCase()} ${match[2]}`;
    });




};




const collectAllowedNumbers = (items)=>{




    const allowedNumbers = [0,100];




    items.forEach((item)=>{




        [
            item.budgetAmount,
            item.actualSpending,
            item.remainingAmount,
            item.percentageUsed,
            item.dailyBurnRate,
            item.projectedTotal,
            item.projectedPercentage,
            item.projectedOverage,
            item.daysRemaining,
            item.recommendedDailySpend,
            item.daysElapsed,
            item.daysInMonth
        ].forEach((value)=>{
            const numericValue = Number(value);
            if(value !== null && value !== undefined && Number.isFinite(numericValue)){
                allowedNumbers.push(Math.abs(numericValue));
            }
        });




        if(item.month){
            allowedNumbers.push(
                Number(item.month.slice(0,4)),
                Number(item.month.slice(5,7))
            );
        }




    });




    return allowedNumbers;




};




const isTrustworthyText = (text,items,allowedMonthLabels,options)=>{




    const { allowCounts, maxLength } = options;




    if(typeof text !== "string" || text.trim() === "" || text.length > maxLength){
        return false;
    }




    if(FORBIDDEN_TEXT_PATTERNS.some((pattern)=>pattern.test(text))){
        return false;
    }




    const mentionsOnlyAllowedMonths = extractMonthLabelsFromText(text).every(
        (label)=>allowedMonthLabels.includes(label)
    );




    if(!mentionsOnlyAllowedMonths){
        return false;
    }




    const allowedNumbers = collectAllowedNumbers(items);




    return extractNumbersFromText(text).every((value)=>{




        if(allowCounts && Number.isInteger(value) && value <= items.length){
            return true;
        }




        return allowedNumbers.some((allowed)=>Math.abs(allowed - value) <= 0.51);




    });




};




const isTrustworthyInsightMessage = (message,budgetDataItem)=>{




    const allowedMonthLabels = budgetDataItem.monthLabel
        ? [budgetDataItem.monthLabel]
        : [];




    if(!isTrustworthyText(message,[budgetDataItem],allowedMonthLabels,{ allowCounts:false, maxLength:400 })){
        return false;
    }




    const { spendingStatus, projectionStatus } = budgetDataItem;




    const claimsWithinBudget =
        /\b(?:within|under)\s+(?:your\s+|the\s+)?(?:\w+\s+)?budget\b|\bon track\b/i.test(message);




    const claimsOverBudget =
        /\bexceed(?:ed|s|ing)?\b|\bover\s+(?:your\s+|the\s+)?(?:\w+\s+)?budget\b|\boverspen[dt]\b|\bwent over\b/i.test(message);




    if(spendingStatus === "OVER_BUDGET" && claimsWithinBudget){
        return false;
    }




    if(
        spendingStatus !== "OVER_BUDGET" &&
        projectionStatus !== "PROJECTED_OVER_BUDGET" &&
        claimsOverBudget
    ){
        return false;
    }




    return true;




};




const isTrustworthySummary = (summary,budgetData)=>{




    const allowedMonthLabels = budgetData
        .map((item)=>item.monthLabel)
        .filter(Boolean);




    if(!isTrustworthyText(summary,budgetData,allowedMonthLabels,{ allowCounts:true, maxLength:600 })){
        return false;
    }




    const hasConcern = budgetData.some(
        (item)=>item.spendingStatus === "OVER_BUDGET" || item.riskLevel === "HIGH"
    );




    const claimsAllClear =
        /\ball\b[^.]*\b(?:within|on track)\b|\beverything\b[^.]*\b(?:within|on track)\b|\bno concerns?\b/i.test(summary);




    return !(hasConcern && claimsAllClear);




};




const normalizeBudgetId = (budgetId)=>{




    if(budgetId === null || budgetId === undefined){
        return null;
    }




    const normalizedId = String(budgetId).trim();




    return normalizedId === "" ? null : normalizedId;




};




/**
 * Associates model insights with backend budget records ONLY by budget ID.
 * Unknown, missing, or duplicate IDs are ignored. Every figure, the month,
 * risk level, alerts, and recommendation come from the backend record.
 */
const buildTrustedInsights = (budgetData,aiInsights)=>{




    const budgetIds = new Set(
        budgetData.map((item)=>normalizeBudgetId(item.budgetId))
    );




    const aiInsightByBudgetId = new Map();




    (Array.isArray(aiInsights) ? aiInsights : []).forEach((insight)=>{




        const key = normalizeBudgetId(insight && insight.budgetId);




        if(key === null || !budgetIds.has(key) || aiInsightByBudgetId.has(key)){
            return;
        }




        aiInsightByBudgetId.set(key,insight);




    });




    return budgetData.map((item)=>{




        const aiInsight = aiInsightByBudgetId.get(normalizeBudgetId(item.budgetId));




        const aiMessage =
            aiInsight && typeof aiInsight.message === "string"
                ? aiInsight.message.trim()
                : "";




        const message =
            aiMessage !== "" && isTrustworthyInsightMessage(aiMessage,item)
                ? aiMessage
                : buildTrustedMessage(item);




        return {
            budgetId:item.budgetId,
            category:item.category,
            month:item.month,
            monthLabel:item.monthLabel,
            monthStatus:item.monthStatus,
            budgetAmount:item.budgetAmount,
            actualSpending:item.actualSpending,
            remainingAmount:item.remainingAmount,
            percentageUsed:item.percentageUsed,
            dailyBurnRate:item.dailyBurnRate,
            projectedTotal:item.projectedTotal,
            projectedPercentage:item.projectedPercentage,
            projectedOverage:item.projectedOverage,
            daysRemaining:item.daysRemaining,
            recommendedDailySpend:item.recommendedDailySpend,
            riskLevel:item.riskLevel,
            alerts:item.alerts,
            message,
            recommendation:buildTrustedRecommendation(item)
        };




    });




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




        if(!Array.isArray(budgets) || budgets.length === 0){




            return res.status(200).json({
                message:"Budget insights fetched successfully",
                insights:[],
                summary:EMPTY_INSIGHTS_SUMMARY
            });




        }




        const budgetData = budgets.map((budget)=>{




            const { daysElapsed, daysInMonth, monthStatus } =
                getDayInfoForBudgetMonth(budget.month);




            const month = getBudgetMonthKey(budget.month);




            const projection = calculateBudgetProjection(
                budget.budgetAmount,
                budget.actualSpending,
                daysElapsed,
                daysInMonth
            );




            const alerts = getBudgetAlerts({
                percentageUsed:budget.percentageUsed,
                projectedPercentage:projection.projectedPercentage,
                remainingAmount:budget.remainingAmount,
                monthStatus,
                actualSpending:budget.actualSpending
            });




            return {
                budgetId:budget.id,
                category:budget.category,
                month,
                monthLabel:formatMonthLabel(month),
                monthStatus,
                spendingStatus:getSpendingStatus(budget.remainingAmount),
                projectionStatus:getProjectionStatus(
                    monthStatus,
                    projection.projectedTotal,
                    budget.budgetAmount
                ),
                daysElapsed,
                daysInMonth,
                budgetAmount:budget.budgetAmount,
                actualSpending:budget.actualSpending,
                remainingAmount:budget.remainingAmount,
                percentageUsed:budget.percentageUsed,
                dailyBurnRate:projection.dailyBurnRate,
                projectedTotal:projection.projectedTotal,
                projectedPercentage:projection.projectedPercentage,
                projectedOverage:projection.projectedOverage,
                daysRemaining:projection.daysRemaining,
                recommendedDailySpend:projection.recommendedDailySpend,
                riskLevel:projection.riskLevel,
                alerts
            };




        });




        const aiResult =
            await generateBudgetInsights(budgetData);




        const trustedInsights =
            buildTrustedInsights(budgetData,aiResult.insights);




        const aiSummary =
            typeof aiResult.summary === "string"
                ? aiResult.summary.trim()
                : "";




        const summary =
            aiSummary !== "" && isTrustworthySummary(aiSummary,budgetData)
                ? aiSummary
                : buildTrustedSummary(budgetData);




        res.status(200).json({
            message:"Budget insights fetched successfully",
            insights:trustedInsights,
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
