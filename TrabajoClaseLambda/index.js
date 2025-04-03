const { MongoClient, ObjectId } = require('mongodb');
const express = require('express');
const awsServerlessExpress = require('aws-serverless-express');
/* 
url de consultas
post: https://se38ww11q8.execute-api.us-east-2.amazonaws.com/prod/users
getAll: https://se38ww11q8.execute-api.us-east-2.amazonaws.com/prod/users
getById: https://se38ww11q8.execute-api.us-east-2.amazonaws.com/prod/users/{id}
Delete:https://se38ww11q8.execute-api.us-east-2.amazonaws.com/prod/users/{id}
Put: https://se38ww11q8.execute-api.us-east-2.amazonaws.com/prod/users/{id} */

const app = express();
app.use(express.json());

let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    
    const client = await MongoClient.connect(process.env.MONGODB_URI, {
        connectTimeoutMS: 5000,
        socketTimeoutMS: 30000
    });
    const db = client.db(process.env.DB_NAME);
    cachedDb = db;
    return db;
}

// POST - Crear usuario
app.post('/users', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        
        const requiredFields = ['name', 'email', 'password', 'age', 'role'];
        const missingFields = requiredFields.filter(field => !body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                error: `Faltan campos obligatorios: ${missingFields.join(', ')}`
            });
        }

        const result = await db.collection('users').insertOne({
            name: body.name,
            email: body.email,
            password: body.password,
            age: Number(body.age),
            role: body.role,
            createdAt: new Date()
        });

        res.status(201).json({
            _id: result.insertedId,
            ...body
        });
    } catch (err) {
        console.error("Error en POST /users:", err);
        res.status(500).json({
            error: "Error interno del servidor",
            details: err.message
        });
    }
});

// GET - Obtener todos los usuarios
app.get('/users', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const users = await db.collection('users').find({}).toArray();
        res.json(users);
    } catch (err) {
        console.error("Error en GET /users:", err);
        res.status(500).json({
            error: "Error al obtener usuarios",
            details: err.message
        });
    }
});

// GET - Obtener usuario por ID
app.get('/users/:id', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const user = await db.collection('users').findOne({ 
            _id: new ObjectId(req.params.id) 
        });
        
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        res.json(user);
    } catch (err) {
        console.error("Error en GET /users/:id:", err);
        res.status(500).json({
            error: "Error al obtener usuario",
            details: err.message
        });
    }
});

// PUT - Actualizar usuario
app.put('/users/:id', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: {
                name: body.name,
                email: body.email,
                password: body.password,
                age: Number(body.age),
                role: body.role,
                updatedAt: new Date()
            }}
        );
        
        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        res.json({ message: "Usuario actualizado correctamente" });
    } catch (err) {
        console.error("Error en PUT /users/:id:", err);
        res.status(500).json({
            error: "Error al actualizar usuario",
            details: err.message
        });
    }
});

// DELETE - Eliminar usuario
app.delete('/users/:id', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const result = await db.collection('users').deleteOne({ 
            _id: new ObjectId(req.params.id) 
        });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        res.json({ message: "Usuario eliminado correctamente" });
    } catch (err) {
        console.error("Error en DELETE /users/:id:", err);
        res.status(500).json({
            error: "Error al eliminar usuario",
            details: err.message
        });
    }
});

const server = awsServerlessExpress.createServer(app);
exports.handler = (event, context) => awsServerlessExpress.proxy(server, event, context);