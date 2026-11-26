import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";

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

app.get("/", (req, res) => {
  res.send("HIRELOOP IS WORKING!");
});

app.get("/users", async (req, res) => {
  const cursor = users.find({});
  const result = await cursor.toArray();
  res.send(result);
});

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

app.post('/applications',async(req,res)=>{
  const application=req.body;
  const result=await applications.insertOne(application)
  res.send(result);
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
