const Notification = require("../models/Notification");


const parseNotificationId = (value)=>{


    const numericId = Number(value);


    if(
        !Number.isInteger(numericId) ||
        numericId <= 0
    ){
        return null;
    }


    return numericId;


};


exports.getNotifications = async(req,res)=>{


    try{


        const user_id = req.user.id;


        const notifications =
            await Notification.getAllByUser(user_id);


        res.status(200).json({
            message:"Notifications fetched successfully",
            notifications
        });


    }catch(error){


        res.status(500).json({
            message:"Failed to fetch notifications"
        });


    }


};


exports.getUnreadNotifications = async(req,res)=>{


    try{


        const user_id = req.user.id;


        const notifications =
            await Notification.getUnreadByUser(user_id);


        res.status(200).json({
            message:"Unread notifications fetched successfully",
            notifications
        });


    }catch(error){


        res.status(500).json({
            message:"Failed to fetch unread notifications"
        });


    }


};


exports.markNotificationAsRead = async(req,res)=>{


    const id = parseNotificationId(req.params.id);


    if(id === null){
        return res.status(400).json({
            message:"Notification ID must be a positive integer"
        });
    }


    try{


        const user_id = req.user.id;


        const notification =
            await Notification.markAsRead(id,user_id);


        if(!notification){
            return res.status(404).json({
                message:"Notification not found"
            });
        }


        res.status(200).json({
            message:"Notification marked as read successfully",
            notification
        });


    }catch(error){


        res.status(500).json({
            message:"Failed to mark notification as read"
        });


    }


};


exports.markAllNotificationsAsRead = async(req,res)=>{


    try{


        const user_id = req.user.id;


        const notifications =
            await Notification.markAllAsRead(user_id);


        res.status(200).json({
            message:"All notifications marked as read successfully",
            notifications
        });


    }catch(error){


        res.status(500).json({
            message:"Failed to mark all notifications as read"
        });


    }


};


exports.deleteNotification = async(req,res)=>{


    const id = parseNotificationId(req.params.id);


    if(id === null){
        return res.status(400).json({
            message:"Notification ID must be a positive integer"
        });
    }


    try{


        const user_id = req.user.id;


        const notification =
            await Notification.deleteById(id,user_id);


        if(!notification){
            return res.status(404).json({
                message:"Notification not found"
            });
        }


        res.status(200).json({
            message:"Notification deleted successfully",
            notification
        });


    }catch(error){


        res.status(500).json({
            message:"Failed to delete notification"
        });


    }


};
