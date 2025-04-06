const bcrypt = require("bcrypt");

const hashPassword = async (password)=>{
    try{
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password,salt);
        return hashedPassword;
    }catch(error){
        console.log("Error in hashing password : ",error);
    }
}

const comparePasswords = async (plainPassword,hashedPassword) =>{
    try{
        const check = await bcrypt.compare(plainPassword,hashedPassword);
        return check;
    }catch(error){
        console.log("Error in comparing passwords : ",error);
    }
}

module.exports = { hashPassword , comparePasswords }