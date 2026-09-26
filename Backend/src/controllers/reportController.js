const ScamReport = require("../models/ScamReport");
const { Op } = require("sequelize");


exports.createReport =
async(req,res)=>{

try{

const {
title,
description,
source_url,
scam_score
} = req.body;

const report =
await ScamReport.create({

user_id:req.user.id,

title,

description,

source_url,

scam_score

});

return res.status(201).json({

success:true,
report

});

}catch(error){

console.error(error.message);
return res.status(500).json({ success:false, message:"Request failed" });

}

};



exports.getReports =
async(req,res)=>{

try{

const reports =
await ScamReport.findAll({

order:[
["createdAt","DESC"]
]

});

return res.json({

success:true,
reports

});

}catch(error){

console.error(error.message);
return res.status(500).json({ success:false, message:"Request failed" });

}

};



exports.getReport =
async(req,res)=>{

try{

const report =
await ScamReport.findByPk(
req.params.id
);

if(!report){

return res.status(404).json({

success:false,
message:"Not Found"

});

}

return res.json({

success:true,
report

});

}catch(error){

console.error(error.message);
return res.status(500).json({ success:false, message:"Request failed" });

}

};




exports.deleteReport =
async(req,res)=>{

try{

const report =
await ScamReport.findByPk(
req.params.id
);

if(!report){

return res.status(404).json({

success:false,
message:"Not Found"

});

}

await report.destroy();

return res.json({

success:true,
message:"Deleted"

});

}catch(error){

console.error(error.message);
return res.status(500).json({ success:false, message:"Request failed" });

}

};


exports.searchReports =
async(req,res)=>{

try{

const { q } = req.query;

const reports =
await ScamReport.findAll({

where:{

title:{
[Op.like]:
`%${q}%`
}

}

});

return res.json({

success:true,
reports

});

}catch(error){

console.error(error.message);
return res.status(500).json({ success:false, message:"Request failed" });

}

};



exports.trendingReports =
async(req,res)=>{

try{

const reports =
await ScamReport.findAll({

order:[
["scam_score","DESC"]
],

limit:10

});

return res.json({

success:true,
reports

});

}catch(error){

console.error(error.message);
return res.status(500).json({ success:false, message:"Request failed" });

}

};