
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
    try {
    const { bookId, userEmail } = req.body;

    // Check required data
    if (!bookId || !userEmail || !ObjectId.isValid(bookId)) {
      return res.send({
        message: "Invalid book or user information",
      });
    }

    // Find the book
    const book = await allBookCollection.findOne({
      _id: new ObjectId(bookId),
    });

    if (!book) {
      return res.send({
        message: "Book not found",
      });
    }

    // Check if the user already borrowed this book
    const alreadyBorrowed = await borrowedBooksCollection.findOne({
      bookId: new ObjectId(bookId),
      userEmail: userEmail,
      status: "borrowed",
    });

    if (alreadyBorrowed) {
      return res.send({
        message: "You already borrowed this book",
      });
    }

    // Check available copies and decrease by 1
    const updateBookCopies = await allBookCollection.updateOne(
      {
        _id: new ObjectId(bookId),
        TotalCopies: { $gt: 0 },
      },
      {
        $inc: { TotalCopies: -1 },
      }
    );

    if (updateBookCopies.modifiedCount === 0) {
      return res.send({
        message: "Book Not Available",
      }); 
    }

    // Borrowing dates
    const borrowDate = new Date();

    const expectedReturnDate = new Date(borrowDate);
    expectedReturnDate.setDate(expectedReturnDate.getDate() + 7);

    // Borrow book data
    const borrowedBook = {
      bookId: new ObjectId(bookId),
      bookTitle: book.Title,
      bookImage: book.Image,
      userEmail,
      borrowDate,
      expectedReturnDate,
      actualReturnDate: null,
      status: "borrowed",
    };

    // Save borrowing data
    try {
      const result = await borrowedBooksCollection.insertOne(borrowedBook);

      return res.send({
        message: "Book borrowed successfully",
        result,
      });
    } 
    catch (error) {
      // Restore the copy if saving the borrow record fails
      await allBookCollection.updateOne(
        { _id: new ObjectId(bookId) },
        { $inc: { TotalCopies: 1 } }
      );

      throw error;
    }
  } catch (error) {
    console.error("Borrow book error:", error);

    res.send({
      message: "Failed to borrow book",
    });
  }
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
    const borrowedBooks = await borrowedBooksCollection.find({
        userEmail: userEmail,
        status: "borrowed"
    }).toArray();

    res.send(borrowedBooks);

});

// patch ---return a borrowed book
app.patch("/return-book/:id", async (req, res) => {

  try {
    const id = req.params.id;
    const { userEmail } = req.body;

    if (!ObjectId.isValid(id) || !userEmail) {
      return res.send({
        message: "Invalid user or book info ",
      });
    }

    // find the active borrowing 
    const borrowedBook = await borrowedBooksCollection.findOne({
      _id: new ObjectId(id),
      userEmail: userEmail,
      status: "borrowed",
    });

    if (!borrowedBook) {
      return res.send({
        message: "Borrowed book not found",
      });
    }

    // marking the book as returned
    const result = await borrowedBooksCollection.updateOne(
      {
        _id: new ObjectId(id),
        userEmail,
        status: "borrowed",
      },
      {
        $set: {
          status: "returned",
          actualReturnDate: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.send({
        message: "This book has already been returned",
      });
    }

    // Increase TotalCopies 
      const copyResult = await allBookCollection.updateOne(
      {
        _id: borrowedBook.bookId,
      },
      {
        $inc: { TotalCopies: 1 },
      }
    );


    if (copyResult.matchedCount === 0) {
      console.error("Original book not found:", borrowedBook.bookId);

      return res.send({
        message: "Original book not found",
      });
    }


    res.send({
      message: "Book returned successfully",
    });

  } catch (error) {
    console.error("Return book error:", error);

    res.send({
      message: "Failed to return book",
    });
  }
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









// ...-->setDate= days
// returnDate.setTime(returnDate.getDate() + 7 * 24 * 60 * 1000);-->setTime = time in milliseconds