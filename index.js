

import "dotenv/config" ; 
import cors from "cors";
import express from "express"; 
import { MongoClient, ObjectId } from 'mongodb';


const app = express();
const port = process.env.PORT || 5000 ;

// middleware
app.use(cors());
app.use(express.json());


// initial server get data
app.get("/" , (req,res) => {
    res.send("Simple Crud is Running");
})

// server connect
app.listen(port ,() =>{
    console.log(`Crud Server is Running On Port : ${port}`);
} )