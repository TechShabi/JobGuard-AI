const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ScamReport = sequelize.define(
"ScamReport",
{
    id:{
        type:DataTypes.INTEGER,
        autoIncrement:true,
        primaryKey:true
    },

    user_id:{
        type:DataTypes.INTEGER,
        allowNull:false
    },

    title:{
        type:DataTypes.STRING,
        allowNull:false
    },

    description:{
        type:DataTypes.TEXT("long"),
        allowNull:false
    },

    source_url:{
        type:DataTypes.TEXT,
        allowNull:true
    },

    scam_score:{
        type:DataTypes.INTEGER,
        defaultValue:0
    },

    image:{
        type:DataTypes.STRING,
        allowNull:true
    },

    status:{
        type:DataTypes.ENUM(
            "pending",
            "verified",
            "rejected"
        ),
        defaultValue:"pending"
    }

});

module.exports = ScamReport;