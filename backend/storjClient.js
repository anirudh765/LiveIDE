const AWS = require('aws-sdk');
require("dotenv").config();

const storjClient = new AWS.S3({
    endpoint: 'https://gateway.storjshare.io', // STORJ S3-compatible endpoint
    accessKeyId: process.env.STORJ_ACCESS_KEY_ID,      // Replace with your Access Key ID
    secretAccessKey: process.env.STORJ_SECRET_ACCESS_KEY, // Replace with your Secret Access Key
    s3ForcePathStyle: true,                   // Required by STORJ
    signatureVersion: 'v4',                   // Required for S3 compatibility
});
 

module.exports = storjClient;
