const db = require("../config/database");


const Notification = {


    create: async(user_id,budget_id,month,alert_code,message)=>{


        const result = await db.query(
            `
            INSERT INTO notifications
            (user_id,budget_id,month,alert_code,message)
            VALUES($1,$2,$3,$4,$5)
            ON CONFLICT (user_id,budget_id,month,alert_code)
            DO NOTHING
            RETURNING
                id,
                user_id,
                budget_id,
                TO_CHAR(month, 'YYYY-MM') AS month,
                alert_code,
                message,
                is_read,
                created_at,
                read_at
            `,
            [
                user_id,
                budget_id,
                month,
                alert_code,
                message
            ]
        );


        return result.rows[0] || null;


    },


    getAllByUser: async(user_id)=>{


        const result = await db.query(
            `
            SELECT
                id,
                user_id,
                budget_id,
                TO_CHAR(month, 'YYYY-MM') AS month,
                alert_code,
                message,
                is_read,
                created_at,
                read_at
            FROM notifications
            WHERE user_id=$1
            ORDER BY created_at DESC
            `,
            [user_id]
        );


        return result.rows;


    },


    getUnreadByUser: async(user_id)=>{


        const result = await db.query(
            `
            SELECT
                id,
                user_id,
                budget_id,
                TO_CHAR(month, 'YYYY-MM') AS month,
                alert_code,
                message,
                is_read,
                created_at,
                read_at
            FROM notifications
            WHERE user_id=$1 AND is_read=FALSE
            ORDER BY created_at DESC
            `,
            [user_id]
        );


        return result.rows;


    },


    markAsRead: async(id,user_id)=>{


        const result = await db.query(
            `
            UPDATE notifications
            SET
                is_read=TRUE,
                read_at=NOW()
            WHERE id=$1 AND user_id=$2
            RETURNING
                id,
                user_id,
                budget_id,
                TO_CHAR(month, 'YYYY-MM') AS month,
                alert_code,
                message,
                is_read,
                created_at,
                read_at
            `,
            [
                id,
                user_id
            ]
        );


        return result.rows[0] || null;


    },


    markAllAsRead: async(user_id)=>{


        const result = await db.query(
            `
            UPDATE notifications
            SET
                is_read=TRUE,
                read_at=NOW()
            WHERE user_id=$1 AND is_read=FALSE
            RETURNING
                id,
                user_id,
                budget_id,
                TO_CHAR(month, 'YYYY-MM') AS month,
                alert_code,
                message,
                is_read,
                created_at,
                read_at
            `,
            [user_id]
        );


        return result.rows;


    },


    deleteById: async(id,user_id)=>{


        const result = await db.query(
            `
            DELETE FROM notifications
            WHERE id=$1 AND user_id=$2
            RETURNING
                id,
                user_id,
                budget_id,
                TO_CHAR(month, 'YYYY-MM') AS month,
                alert_code,
                message,
                is_read,
                created_at,
                read_at
            `,
            [
                id,
                user_id
            ]
        );


        return result.rows[0] || null;


    }


};


module.exports = Notification;