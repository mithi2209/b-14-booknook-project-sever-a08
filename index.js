
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

app.post("/add-books", async (req, res) => {
  try {
    const { ...data } = req.body;

    if (
      !data.Title ||
      !data.Author ||
      !data.Category ||
      !data.Image ||
      !data.Description ||
      !data.userName ||
      !data.userEmail ||
      !data.TotalCopies
    ) {
      return res.status(400).send({
        message: "Please provide all required information",
      });
    }

      const copies = Number(data.TotalCopies);

      if (!Number.isInteger(copies) || copies <= 0) {
        return res.status(400).send({
          message: "Total copies must be a positive number",
        });
      }

      const bookData = {
        ...data,
        TotalCopies: copies,
        AvailableCopies: copies,
        createdAt: new Date(),
      };

      const result = await allBookCollection.insertOne(bookData);

      res.status(201).send(result);

    }
    catch (error) {
      console.log("Error adding book:", error);

      res.status(500).send({
        message: "Failed to add book",
      });
    
    }

});




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
      
    const bookObjectId = new ObjectId(bookId);

    // Find the book
    const book = await allBookCollection.findOne({
      _id: bookObjectId,
    });

    if (!book) {
      return res.status(400).send({
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
      return res.status(409).send({
        message: "You already borrowed this book",
      });
    }

    // // Decrease AVAILABLE copies only

    const updateBookCopies = await allBookCollection.updateOne(
      {
        _id: bookObjectId ,
         AvailableCopies: { $gt: 0 },
      },
      {
        $inc: { AvailableCopies: -1 },
      }
    );

    if (updateBookCopies.modifiedCount === 0) {
      return  res.status(400).send({
        message: "Book Not Available",
      }); 
    }

    // Borrowing dates
    const borrowDate = new Date();

    const expectedReturnDate = new Date(borrowDate);
    expectedReturnDate.setDate(expectedReturnDate.getDate() + 7);

    // Borrow book data
    const borrowedBook = {
      bookId: bookObjectId,
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

      return res.status(201).send({
        message: "Book borrowed successfully",
        result,
      });
    } 
    catch (error) {
      // Restore the copy if saving the borrow record fails
      await allBookCollection.updateOne(
        {
          _id: bookObjectId,

          AvailableCopies: { $lt: book.TotalCopies },
        },

        {
          $inc: {
            AvailableCopies: 1,
          },
        });

        throw error;
      }
  } 
  catch (error) {
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


// get my books from added books

app.get("/my-books/:userEmail" , async (req, res) => {
     
    try{
      const {userEmail} = req.params ;

      const result = await allBookCollection
      .find({userEmail})
      .sort({createdAt: -1})
      .toArray() ;

      res.send(result);
    }
    catch (error) {
      console.log(error);
      res.status(500).send({
        message: "Failed to get your books",
      });
    }

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


    // Find original book
    const originalBook = await allBookCollection.findOne({
      _id: borrowedBook.bookId,
    });


    if (!originalBook) {
      return res.status(404).send({
        message: "Book not found",
      });
    }

    // Increase available copies only if below original total
    const copyResult = await allBookCollection.updateOne(
      {
        _id: borrowedBook.bookId,
        AvailableCopies: { $lt: originalBook.TotalCopies },
      },
      {
        $inc: {
          AvailableCopies: 1,
        },
      }
    );


    if (copyResult.modifiedCount === 0) {
      return res.send({
        message: "Available copies could not be updated",
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

    // restore copy count if return record update fails
     if (result.modifiedCount === 0) {
      await allBookCollection.updateOne(
        {
          _id: borrowedBook.bookId,
          AvailableCopies: { $gt: 0 },
        },
        {
          $inc: {
            AvailableCopies: -1,
          },
        }
      );

      return res.send({
        message: "This book has already been returned",
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