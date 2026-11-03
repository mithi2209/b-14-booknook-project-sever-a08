
import cors from "cors";
import  "dotenv/config" ; 
import express from "express"; 
import { MongoClient, ObjectId } from 'mongodb';


const app = express();
const port = process.env.PORT || 5000 ;




// middleware
app.use(cors());
app.use(express.json());
// ...........Mongodb Database connection...........


const client = new MongoClient(process.env.MONGODB_URI);

    export async function connectToMongoDB() {

    try {
        await client.connect();
        console.log("You successfully connected to MongoDB!");
        return client;
    } 
    catch (err) {
        console.dir(err);
    }
    }

const mongoDbClient = await connectToMongoDB() ;

const db = mongoDbClient.db("booknook-server-side");
const allBookCollection = db.collection("All-Books") ;

// to get details of book 
const bookDetailsCollection = db.collection("Book-Details");

// ......................................


// initial server get data
app.get("/" , (req,res) => {
    res.send({message:"Server is Running.."});
})


// post book or add book

// http://localhost:5000/add-books

app.post("/add-books" , async(req,res) => {

   const data = {
    ...req.body,
    createdAt: new Date()
    };
    const  result = await allBookCollection.insertOne(data);
    
    res.send(result);
})


// Add additional book information
app.post("/book-details", async (req, res) => {
    const data = req.body;

    const result = await bookDetailsCollection.insertOne(data);

    res.send(result);
});


// get books data 
app.get("/all-books", async (req,res)=>{

    const cursor = allBookCollection.find({}) ;
    const allBooks = await cursor.toArray() ;
    res.send(allBooks) ;


})


// detail data

app.get("/book-details/:id", async (req, res) => {

    const id = req.params.id;

    // basic book information from all books
    const book = await allBookCollection.findOne({
        _id: new ObjectId(id)
    });

    if (!book) {
        return res.status(404).send({
            message: "Book not found"
        });
    }

    //  additional information using Title
    const bookDetails = await bookDetailsCollection.findOne({
        Title: book.Title
    });

    // data together 
    res.send({
        ...book,
        details: bookDetails
    });

});

// Get latest 6 books (New Arrivals)
app.get("/new-arrivals", async (req, res) => {
  const newArrivals = await allBookCollection
    .find({})
    .sort({ createdAt: -1 })
    .limit(6)
    .toArray();

  res.send(newArrivals);
});


// server connect
app.listen(port ,() =>{
    console.log(`Server is Running On Port : ${port}`);
} )