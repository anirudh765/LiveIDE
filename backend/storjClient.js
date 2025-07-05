const AWS = require('aws-sdk');
require("dotenv").config();

const storjClient = new AWS.S3({
    endpoint: 'https://gateway.storjshare.io',
    accessKeyId: process.env.STORJ_ACCESS_KEY_ID,     
    secretAccessKey: process.env.STORJ_SECRET_ACCESS_KEY, 
    s3ForcePathStyle: true,                   
    signatureVersion: 'v4',                  
});
 

module.exports = storjClient;
