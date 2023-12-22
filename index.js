const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;


// middleware 
const corsOptions = {
    origin: ['http://localhost:5173', "https://task-management-sb.web.app"],
    credentials: true,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded
        next()
    })
}


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.DB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection

        const usersCollection = client.db("taskManage").collection("users");
        const tasksCollection = client.db("taskManage").collection("tasks");
        const notificationsCollection = client.db("taskManage").collection("notifications");


        //auth related api call
        app.post('/jwt', async (req, res) => {
            const { email } = req.body
            const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '10d',
            })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'none'
                })
                .send({ success: true })
        })
        // Logout
        app.get('/logout', async (req, res) => {
            try {
                res
                    .clearCookie('token', {
                        maxAge: 0,
                        secure: false,
                        // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    })
                    .send({ success: true })
                console.log('Logout successful')
            } catch (err) {
                res.status(500).send(err)
            }
        })

        //saving user details in db
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            console.log(user)
            const query = { email: email }
            const options = { upsert: true }
            const isExist = await usersCollection.findOne(query)
            if (isExist) {
                if (user?.status === 'Requested') {
                    const result = await usersCollection.updateOne(
                        query,
                        {
                            $set: user,
                        },
                        options
                    )
                    return res.send(result)
                } else {
                    return res.send(isExist)
                }
            }
            const result = await usersCollection.updateOne(
                query,
                {
                    $set: { ...user },
                },
                options
            )
            res.send(result)
        })

        //save a task
        app.post('/task', verifyToken, async (req, res) => {
            const task = req.body;
            const result = await tasksCollection.insertOne(task);
            res.send(result);
        })

        //update a single task 
        app.put('/update-task/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const task = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedTask = {
                $set: {
                    title: task.title,
                    description: task.description,
                    deadline: task.deadline,
                    priority: task.priority
                }
            }
            const result = await tasksCollection.updateOne(filter, updatedTask);
            res.send(result);
        })


        //delete a task
        app.delete('/deleteTask/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await tasksCollection.deleteOne(query);
            res.send(result);
        })
        //get a single task data;
        app.get('/task/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await tasksCollection.findOne(query);
            res.send(result);
        })

        //get all tasks 
        app.get('/tasks/:email', async (req, res) => {
            const email = req.params.email;
            const result = await tasksCollection.find({ email }).toArray();
            res.send(result)

        })

        //update task status 
        app.patch('/status/:id', verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const status = req.body.status;
                const options = { upsert: true };
                const filter = { _id: new ObjectId(id) };
                const updatedTask = {
                    $set: {
                        status
                    }
                }
                const result = await tasksCollection.updateOne(filter, updatedTask, options);
                res.send(result);
            } catch (error) {
                res.send({ message: error.message })
            }
        })


        //save notifications 
        app.put('/notification/:id', async (req, res) => {
            const id = req.params.id;
            const notification = req.body;
            const query = { taskId: id }
            const options = { upsert: true }
            const isExist = await notificationsCollection.findOne(query)
            if (isExist) {
                if (notification) {
                    const result = await notificationsCollection.updateOne(
                        query,
                        {
                            $set: notification,
                        },
                        options
                    )
                    return res.send(result)
                } else {
                    return res.send(isExist)
                }
            }
            const result = await notificationsCollection.updateOne(
                query,
                {
                    $set: { ...notification },
                },
                options
            )
            res.send(result)
        })


        //delete a notification 
        app.delete('/deleteNotification/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await notificationsCollection.deleteOne(query);
            res.send(result);
        })
        //get notifications 
        app.get('/notifications/:email', async (req, res) => {
            const email = req.params.email;
            const result = await notificationsCollection.find({ email }).toArray();
            res.send(result)
        })


        //get a single user info
        app.get('/user/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.findOne({ email });
            res.send(result)
        })
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);





app.get('/health', async (req, res) => {
    res.send('Server is running successfully.')
})

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
})