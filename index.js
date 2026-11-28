import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import Stripe from'stripe'

const stripe=new Stripe(process.env.STRIPE_SECRET_KEY)

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cors());

const client = new MongoClient(
  `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.2rfkb4j.mongodb.net/`,
);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
const connectClient = await connectToMongoDB();
const database = connectClient.db("hireloopdb");
const users = database.collection("user");
const jobs = database.collection("jobs");
const applications = database.collection("applications");
const payments = database.collection("payments");

app.get("/", (req, res) => {
  res.send("HIRELOOP IS WORKING!");
});

// users related api
app.get("/users", async (req, res) => {
  const cursor = users.find({});
  const result = await cursor.toArray();
  res.send(result);
});

app.get('/users/:id/premium',async (req,res)=>{
  const id=req.params.id;
  const query={_id:new ObjectId(id)};
  const result=await users.findOne(query,{projection:{premium:1}});
  
  res.send(result)
})

// jobs related apis
// app.get('/jobs',async(req,res)=>{
// const query={}
// if(req.query){
// if(req.query.status){
//   query.status=req.query.status;
// }
// if(req.query.remote !==undefined){
//   query.remote=req.query.remote==="true"
// }
// if(req.query.category){
//   query.category=req.query.category;
// }
// if(req.query.jobType){
//   query.jobType=req.query.jobType;
// }
//   // Search filter
//   if (req.query.search) {
//   // const searchText=req.search.trim();

//     query.$or = [
//       { title: { $regex: req.query.search, $options: "i" } },
//       {company:{ $regex: req.query.search, $options: "i" }},
//       { responsibilities: { $regex: req.query.search, $options: "i" } },
//       { qualifications: { $regex: req.query.search, $options: "i" } }
//     ];
//   }
// }
// console.log("query",req.query)
//   const cursor=jobs.find(query);
//   const result=await cursor.toArray();
//   res.send(result);

//   console.log("search",req.query.search);
//   console.log("mongodb query",JSON.stringify(query,null,2))
// })
app.get("/jobs", async (req, res) => {
  const query = {};
  const { status, remote, category, jobType, search } = req.query;

  if (status) {
    query.status = { $regex: `^${status.trim()}$`, $options: "i" };
  }

  if (remote === "true" || remote === "false") {
    query.remote = remote === "true";
  }

  if (category) {
    query.category = { $regex: `^${category.trim()}$`, $options: "i" };
  }

  if (jobType) {
    query.jobType = { $regex: `^${jobType.trim()}$`, $options: "i" };
  }

  // Search filter
  if (search) {
    const searchText = search.trim();
    query.$or = [
      { title: { $regex: searchText, $options: "i" } },
      { company: { $regex: searchText, $options: "i" } },
      { responsibilities: { $regex: searchText, $options: "i" } },
      { qualifications: { $regex: searchText, $options: "i" } },
    ];
  }

  console.log("mongodb query:", JSON.stringify(query, null, 2));

  const result = await jobs.find(query).toArray();
  res.send(result);
});

app.post("/jobs", async (req, res) => {
  const job = req.body;
  const result = await jobs.insertOne(job);
  res.send(result);
});

app.get(`/jobs/:id`,async(req,res)=>{
  const id=req.params.id;
  const query={_id:new ObjectId(id)};
  const result=await jobs.findOne(query);
  res.send(result)
})
app.delete("/jobs/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await jobs.deleteOne(query);
  res.send(result);
});

// application related apis
app.get('/applications',async(req,res)=>{
  const query={};

  if(req.query.userId){
    query.userId=req.query.userId;
  }

  const cursor=applications.find(query);
  const result=await cursor.toArray();
  res.send(result);
})
app.get('/applications/count',async(req,res)=>{
  const query={};
  if(req.query.userId){
    query.userId=req.query.userId;
  }
const result=await applications.countDocuments(query)
  res.send({count: result});
})

app.post('/applications',async(req,res)=>{
  const application=req.body;
  const result=await applications.insertOne(application)
  res.send(result);
})

// payment related api
app.post('/payments/checkout-verify',async (req,res)=>{
  const {sessionId}=req.body;
   if(!sessionId){
      return res.status(400).send({success:false, message:'session Id is required '})
    }

  // 1.get the session from stripe
  // 2.check is the session id for the currently logged in user
  // 3.insert sessionId into the payment collection
  // 4.update user information as premium user

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const { status, payment_status, customer_email, metadata, payment_intent } = session;

    if (status !== 'complete' || payment_status !== 'paid'){
      return res.send({success:false,message:'Payment verification failed'})
    }

    const userId = metadata?.userId;
    if (!userId) {
      return res.status(400).send({success:false,message:'Payment is not linked to a user'})
    }

    const sessionQuery={sessionId};
    const existingPayment=await payments.findOne(sessionQuery);
    if(existingPayment){
      return res.send({success:true, alreadyProcessed:true, message:'Payment already done!'})
    }

    const payment= {
    sessionId,
      status,
    customer_email,
    metadata,
    payment_intent: payment_intent?.id ?? payment_intent ?? null,
    userId,
    payment_date:new Date(),
    payment_status,

  }
    const result =await payments.insertOne(payment);

    // update the user table
    const query ={_id:new ObjectId(userId)};

    const updateDoc={
      $set:{
        premium:true,
      }
    }
    const updateResult=await users.updateOne(
      query,
      updateDoc
    )
    res.send({success:true,result,updateResult})
  } catch (error) {
    console.error('checkout-verify failed:', error);
    res.status(500).send({
      success:false,
      message: error instanceof Error ? error.message : 'Payment verification failed',
    })
  }
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
