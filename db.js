const mysql = require('mysql2');

// Crear un pool de conexiones para mejorar la gestión de múltiples conexiones
const pool = mysql.createPool({
  host: 'bu1ead73wakxfatfgj7b-mysql.services.clever-cloud.com',
  user: 'ufxrywhggfdgwbou',
  password: 'aBKLva7XmFfaysgFYXLc',
  database: 'bu1ead73wakxfatfgj7b',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10, // Número máximo de conexiones simultáneas
  queueLimit: 0, // Sin límite en la cola de conexiones pendientes
});

// Verificar la conexión inicial
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error conectando al pool de base de datos:', err.message);
    return;
  }
  console.log('Conectado al pool de base de datos');
  connection.release(); // Liberar la conexión inicial
});

module.exports = pool;
