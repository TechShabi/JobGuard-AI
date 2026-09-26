const ScanHistory = require("../models/ScanHistory");
const { Op } = require("sequelize");

exports.getStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const totalScans = await ScanHistory.count({
            where: { user_id: userId }
        });

        const highRisk = await ScanHistory.count({
            where: {
                user_id: userId,
                scam_score: { [Op.gte]: 70 }
            }
        });

        const mediumRisk = await ScanHistory.count({
            where: {
                user_id: userId,
                scam_score: { [Op.between]: [40, 69] }
            }
        });

        const lowRisk = await ScanHistory.count({
            where: {
                user_id: userId,
                scam_score: { [Op.lt]: 40 }
            }
        });

        // FIXED: Use findAll + reduce instead of .avg()
        const scans = await ScanHistory.findAll({
            where: { user_id: userId },
            attributes: ['scam_score']
        });

        const avgScore = scans.length > 0
            ? scans.reduce((sum, s) => sum + (s.scam_score || 0), 0) / scans.length
            : 0;

        return res.json({
            success: true,
            stats: {
                totalScans,
                highRisk,
                mediumRisk,
                lowRisk,
                averageRisk: Math.round(avgScore)
            }
        });

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// History API
exports.getHistory = async (req, res) => {

    try {

        const userId = req.user.id;

        const scans = await ScanHistory.findAll({

            where: {
                user_id: userId
            },

            order: [
                ["createdAt", "DESC"]
            ],

            limit: 50

        });

        return res.json({

            success: true,

            history: scans

        });

    } catch (error) {

        return res.status(500).json({

            success: false,
            message: error.message

        });

    }

};



// Singal Scan detail

exports.getSingleScan =
    async (req, res) => {

        try {

            const scan =
                await ScanHistory.findByPk(
                    req.params.id
                );

            if (!scan) {

                return res.status(404).json({

                    success: false,
                    message: "Scan Not Found"

                });

            }

            return res.json({

                success: true,
                scan

            });

        } catch (error) {

            return res.status(500).json({

                success: false,
                message: error.message

            });

        }

    };


// delete scan

exports.deleteScan =
    async (req, res) => {

        try {

            const scan =
                await ScanHistory.findByPk(
                    req.params.id
                );

            if (!scan) {

                return res.status(404).json({

                    success: false,
                    message: "Not Found"

                });

            }

            await scan.destroy();

            return res.json({

                success: true,
                message: "Deleted"

            });

        } catch (error) {

            return res.status(500).json({

                success: false,
                message: error.message

            });

        }

    };
