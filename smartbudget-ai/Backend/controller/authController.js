const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/User");


// REGISTER USER
exports.register = async (req, res) => {

    try {

        const { name, email, password } = req.body;


        const existingUser = await User.findByEmail(email);

        if(existingUser){
            return res.status(400).json({
                message:"User already exists"
            });
        }


        const hashedPassword = await bcrypt.hash(password,10);


        const user = await User.create(
            name,
            email,
            hashedPassword
        );


        res.status(201).json({
            message:"User registered successfully",
            user:{
                id:user.id,
                name:user.name,
                email:user.email
            }
        });


    } catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};



// LOGIN USER
exports.login = async(req,res)=>{

    try{

        const {email,password}=req.body;


        const user = await User.findByEmail(email);


        if(!user){
            return res.status(400).json({
                message:"Invalid credentials"
            });
        }


        const validPassword = await bcrypt.compare(
            password,
            user.password
        );


        if(!validPassword){
            return res.status(400).json({
                message:"Invalid credentials"
            });
        }



        const token = jwt.sign(
            {
                id:user.id,
                email:user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn:"7d"
            }
        );


        res.json({
            message:"Login successful",
            token
        });


    }catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};