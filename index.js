const express = require('express');
const cors = require('cors');
const pool = require('./db'); // Importar el pool de conexiones
const stockRoutes = require('./routes/stockRoutes');

// Inicializar Express
const app = express();

// Middleware para manejar JSON
app.use(express.json());

// Configuración de CORS (Permite solicitudes desde los dominios indicados)
const corsOptions = {
  origin: ['https://monraspgit.github.io', 'https://ines-back-1.onrender.com', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Métodos permitidos
  credentials: true, // Si necesitas enviar cookies o autenticación
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Maneja solicitudes preflight

// Middleware adicional para cabeceras CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Usar las rutas del stock
app.use('/api/stock', stockRoutes);

// Configuración del puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
