
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


// 
const borrowedBooksCollection = db.collection("Borrowed-Books");

// ......................................


// initial checking for server get data
app.get("/" , (req,res) => {
    res.send({message:"Server is Running.."});
})


// post book or add book
app.post("/add-books" , async(req,res) => {

   const data = {
    ...req.body,
    createdAt: new Date()
    };
    const  result = await allBookCollection.insertOne(data);
    
    res.send(result);
})



// post borrowed book
app.post("/borrow-books", async (req, res) => {

    const { bookId, userEmail } = req.body;


    // Find the book
    const book = await allBookCollection.findOne({
        _id: new ObjectId(bookId)
    });



    if (!book) {
        return res.send({
            message: "Book not found"
        });
    }

    // Checking if the  already borrowed
    const alreadyBorrowed = await borrowedBooksCollection.findOne({
        bookId: new ObjectId(bookId),
        userEmail : userEmail ,
        status: "borrowed"
    });

    if (alreadyBorrowed) {
        return res.send({
            message: "You already borrowed this book"
        });
    }

    // borrowing books and return dates
    const borrowDate = new Date();

    const returnDate = new Date(borrowDate);
    returnDate.setDate(returnDate.getDate() + 14);
    // ...-->setDate= days
    // returnDate.setTime(returnDate.getDate() + 14 * 24 * 60 * 1000); -->setTime = time in milliseconds

    // Borrow book data
    const borrowedBook = {
        bookId: new ObjectId(bookId),
        bookTitle: book.Title,
        bookImage: book.Image,
        userEmail: userEmail,
        borrowDate: borrowDate,
        returnDate: returnDate,
        status: "borrowed"
    };
      console.log(bookId,
            userEmail)
    // borrowing data save
    const result = await borrowedBooksCollection.insertOne(borrowedBook);

    res.send({
        message: "Book borrowed successfully",
        result
    });

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

   
    const book = await allBookCollection.findOne({
        _id: new ObjectId(id)
    });

    if (!book) {
        return res.send({
            message: "Book not found"
        });
    }

    // data together 
    res.send(book);

});


// Get borrowed books of a user
app.get("/borrowed-books/:userEmail", async (req, res) => {

   const userEmail = req.params.userEmail;

    // get user's borrowed books by email
    const borrowedBooks = await borrowsCollection.find({
        userEmail: userEmail,
        status: "borrowed"
    }).toArray();

    res.send(borrowedBooks);

});

// return a borrowed book 



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