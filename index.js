const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()

const PORT = process.env.PORT || 5000


const app = express()

// middleware
app.use(cors())
app.use(express.json())

const verifyJwtToken = (req, res, next) => {

    const authorization = req.headers.authorization

    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access!' })
    }

    // Bearer Token
    const token = authorization.split(' ')[1]

    // verify a token symmetric
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRECT, (err, decoded) => {

        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access!' })
        }

        req.decoded = decoded
        next()
    });

}

app.get('/', (req, res) => {
    res.send('Hello World!')
})

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.h88b4w7.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const usersCollection = client.db('ClickCraftersDB').collection('users')
        const coursesCollection = client.db('ClickCraftersDB').collection('courses')
        const selectedCoursesCollection = client.db('ClickCraftersDB').collection('selectedCourses')

        /**********************************
        * ****** MIDDLEWARE *******
        ********************************/
        // Verify admin middleware
        const verifyAdmin = async (req, res, next) => {

            const email = req.decoded.email

            const query = { email }
            const user = await usersCollection.findOne(query)

            if (user.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access!' })
            }
            next()
        }

        // Verify Instructor middleware
        const verifyInstructor = async (req, res, next) => {

            const email = req.decoded.email

            const query = { email }
            const user = await usersCollection.findOne(query)

            if (user.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden access!' })
            }
            next()
        }

        /**********************************
         * ****** INSTRUCTOR RELATED API *******
         ********************************/
        // Check Instructor User
        app.get('/my-classes/instructor/:email', verifyJwtToken, async (req, res) => {

            const email = req.params.email

            if (req.decoded.email !== email) {
                return res.send({ instructor: false })
            }

            const query = { email }
            const user = await usersCollection.findOne(query)
            const result = { instructor: user?.role === 'instructor' }
            res.send(result)
        })


        /**********************************
         * ****** JWT RELATED API *******
         ********************************/
        app.post('/jwt', (req, res) => {

            const user = req.body

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRECT,
                { expiresIn: '1h' }
            )
            res.send({ token })
        })

        /**********************************
         * ****** COURSES PAGE RELATED API *******
         ********************************/
        // Get All Courses have on website
        app.get('/courses', async (req, res) => {

            const result = await coursesCollection.find().toArray()
            res.send(result)
        })

        /**********************************
         * ****** USER RELATED API *******
         ********************************/
        // Get All User
        app.get('/users', verifyJwtToken, verifyAdmin, async (req, res) => {

            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        // Check Admin User
        app.get('/users/admin/:email', verifyJwtToken, async (req, res) => {

            const email = req.params.email

            if (req.decoded.email !== email) {
                return res.send({ admin: false })
            }

            const query = { email }
            const user = await usersCollection.findOne(query)
            const result = { admin: user?.role === 'admin' }
            res.send(result)
        })

        // Post User When created a new User
        app.post('/users', async (req, res) => {

            const users = req.body

            const query = {
                email: users.email
            }

            const exitingId = await usersCollection.findOne(query)
            if (exitingId) {
                return res.send({ message: "User is already exist" })
            }

            const result = await usersCollection.insertOne(users)
            res.send(result)
        })

        // Handle Users related Api (make admin)
        app.patch('/users/admin/:_id', async (req, res) => {

            const _id = req.params._id

            const filter = {
                _id: new ObjectId(_id)
            }

            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.delete('/users/delete/:_id', async (req, res) => {

            const _id = req.params._id

            const query = { _id: new ObjectId(_id) }
            const result = await usersCollection.deleteOne(query)
            res.send(result)
        })

        // Handle Users related Api (make Instructor)
        app.patch('/users/instructor/:_id', async (req, res) => {

            const _id = req.params._id

            const filter = {
                _id: new ObjectId(_id)
            }

            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        /**********************************
        *** SELECTED COURSE RELATED API ***
        ********************************/
        // get Selected Course when user select
        app.get('/selected-courses', verifyJwtToken, async (req, res) => {

            const email = req.query.email
            if (!email) {
                res.send([])
            }

            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbidden Access!' })
            }

            const query = { email }
            const result = await selectedCoursesCollection.find(query).toArray()
            res.send(result)
        })

        // When user select course then post course his/her dasboard
        app.post('/selected-courses', async (req, res) => {

            const selectedCourse = req.body

            const result = await selectedCoursesCollection.insertOne(selectedCourse)
            res.send(result)
        })

        // Delete User Seleted Courses
        app.delete('/selected-courses/:_id', async (req, res) => {

            const _id = req.params._id

            const query = { _id: new ObjectId(_id) }
            const result = await selectedCoursesCollection.deleteOne(query)
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(PORT, () => {
    console.log(`Example app listening on port ${PORT}`)
})