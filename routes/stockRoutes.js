const express = require('express');
const router = express.Router();
const pool = require('../db');

// Ruta para obtener todos los datos de Stock
router.get('/', (req, res) => {
  pool.query('SELECT * FROM stock', (err, results) => {
    if (err) {
      console.error('Error al obtener datos:', err);
      res.status(500).json({ error: 'Error al obtener datos de la base de datos' });
    } else {
      // Convertir las fechas del formato ISO al formato "YYYY-MM-DD"
      const formattedResults = results.map((item) => ({
        ...item,
        fechaEnvio: item.fechaEnvio ? item.fechaEnvio.toISOString().split('T')[0] : null,
        fechaLlegada: item.fechaLlegada ? item.fechaLlegada.toISOString().split('T')[0] : null,
      }));

      res.status(200).json(formattedResults);
    }
  });
});

// Ruta para guardar todos los datos en Stock (inserción masiva)
router.post('/', (req, res) => {
  const stockData = req.body;

  if (!Array.isArray(stockData) || stockData.length === 0) {
    return res.status(400).json({ error: 'Debe enviar un array con al menos un registro.' });
  }

  // Creamos el array con todos los valores a insertar
  const values = [];
  stockData.forEach((item) => {
    const {
      codigoInsumo,
      nombreInsumo,
      unidad,
      cantidadMaxima,
      cantidadPedida,
      pendiente,
      numeroCompra,
      fechaEnvio,
      fechaLlegada,
      cuantosLlegaron,
      mes01,
      mes02,
    } = item;

    // Convertimos las fechas al formato YYYY-MM-DD si vienen en formato ISO
    const formattedFechaEnvio = fechaEnvio ? fechaEnvio.split('T')[0] : null;
    const formattedFechaLlegada = fechaLlegada ? fechaLlegada.split('T')[0] : null;

    // Si `mes01` o `mes02` están vacíos o son null, se asigna el valor 0
    const validMes01 = parseInt(mes01) || 0;
    const validMes02 = parseInt(mes02) || 0;

    values.push([
      codigoInsumo,
      nombreInsumo,
      unidad,
      cantidadMaxima || 0, // También aseguramos que cantidadMaxima no sea null
      cantidadPedida || 0,
      pendiente || 0,
      numeroCompra,
      formattedFechaEnvio,  // Utilizamos la fecha formateada
      formattedFechaLlegada, // Utilizamos la fecha formateada
      cuantosLlegaron || 0,
      validMes01,
      validMes02,
    ]);
  });

  // Consulta para inserción masiva
  const sqlQuery = `
    INSERT INTO stock (
      codigoInsumo, nombreInsumo, unidad, cantidadMaxima, cantidadPedida, pendiente, numeroCompra, fechaEnvio, fechaLlegada, cuantosLlegaron, mes01, mes02
    ) VALUES ?
  `;

  // Usamos una transacción para asegurarnos de que todo se inserta correctamente o nada se inserta
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error al obtener una conexión del pool:', err);
      res.status(500).json({ error: 'Error al conectarse a la base de datos' });
      return;
    }

    connection.beginTransaction((err) => {
      if (err) {
        console.error('Error al iniciar la transacción:', err);
        connection.release();
        res.status(500).json({ error: 'Error al iniciar la transacción' });
        return;
      }

      connection.query(sqlQuery, [values], (err, results) => {
        if (err) {
          console.error('Error al insertar datos:', err);
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ error: 'Error al insertar datos en la base de datos' });
          });
        }

        connection.commit((err) => {
          if (err) {
            console.error('Error al hacer commit de la transacción:', err);
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: 'Error al hacer commit de la transacción' });
            });
          }

          console.log('Datos insertados correctamente');
          connection.release();
          res.status(201).json({ message: 'Datos guardados exitosamente' });
        });
      });
    });
  });
});

// Nueva ruta para actualización masiva de insumos
router.put('/update', (req, res) => {
  const updatedStockData = req.body;

  if (!Array.isArray(updatedStockData) || updatedStockData.length === 0) {
    return res.status(400).json({ error: 'Debe enviar un array con al menos un registro para actualizar.' });
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error al obtener una conexión del pool:', err);
      res.status(500).json({ error: 'Error al conectarse a la base de datos' });
      return;
    }

    connection.beginTransaction((err) => {
      if (err) {
        console.error('Error al iniciar la transacción:', err);
        connection.release();
        res.status(500).json({ error: 'Error al iniciar la transacción' });
        return;
      }

      const queries = updatedStockData.map((item) => {
        return new Promise((resolve, reject) => {
          const {
            codigoInsumo,
            cantidadMaxima,
            cantidadPedida,
            pendiente,
            numeroCompra,
            fechaEnvio,
            fechaLlegada,
            cuantosLlegaron,
            week,         // Columna semana
            observation,  // Columna observación
            bimensual,    // Columna bimensual
          } = item;

          const formattedFechaEnvio = fechaEnvio ? fechaEnvio.split('T')[0] : null;
          const formattedFechaLlegada = fechaLlegada ? fechaLlegada.split('T')[0] : null;

          const sqlQuery = `
            UPDATE stock
            SET 
              cantidadMaxima = ?,
              cantidadPedida = ?,
              pendiente = ?,
              numeroCompra = ?,
              fechaEnvio = ?,
              fechaLlegada = ?,
              cuantosLlegaron = ?,
              week = ?,          -- Columna semana
              observation = ?,   -- Columna observación
              bimensual = ?      -- Columna bimensual
            WHERE codigoInsumo = ?
          `;

          connection.query(
            sqlQuery,
            [
              cantidadMaxima,
              cantidadPedida,
              pendiente,
              numeroCompra,
              formattedFechaEnvio,
              formattedFechaLlegada,
              cuantosLlegaron,
              week || null,        // Valor semana
              observation || '',   // Valor observación
              bimensual || 'No definido', // Valor bimensual
              codigoInsumo,
            ],
            (err, result) => {
              if (err) {
                return reject(err);
              }
              resolve(result);
            }
          );
        });
      });

      Promise.all(queries)
        .then(() => {
          connection.commit((err) => {
            if (err) {
              console.error('Error al hacer commit de la transacción:', err);
              return connection.rollback(() => {
                connection.release();
                res.status(500).json({ error: 'Error al hacer commit de la transacción' });
              });
            }

            console.log('Datos actualizados correctamente');
            connection.release();
            res.status(200).json({ message: 'Datos actualizados exitosamente' });
          });
        })
        .catch((err) => {
          console.error('Error al actualizar datos:', err);
          connection.rollback(() => {
            connection.release();
            res.status(500).json({ error: 'Error al actualizar datos en la base de datos' });
          });
        });
    });
  });
});



// borra stock
router.delete('/deleteAll', (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error al obtener una conexión del pool:', err);
      res.status(500).json({ error: 'Error al conectarse a la base de datos' });
      return;
    }

    connection.beginTransaction((err) => {
      if (err) {
        console.error('Error al iniciar la transacción:', err);
        connection.release();
        res.status(500).json({ error: 'Error al iniciar la transacción' });
        return;
      }

      // Consulta para eliminar todos los registros
      connection.query('DELETE FROM stock', (err) => {
        if (err) {
          console.error('Error al eliminar los datos de stock:', err);
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ error: 'Error al eliminar los datos de la base de datos' });
          });
        }

        // Confirmar la transacción para eliminar los registros
        connection.commit((err) => {
          if (err) {
            console.error('Error al hacer commit de la transacción:', err);
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: 'Error al hacer commit de la transacción' });
            });
          }

          console.log('Todos los datos de la tabla stock han sido eliminados correctamente.');
          connection.release();
          res.status(200).json({ message: 'Todos los datos de stock fueron eliminados exitosamente' });
        });
      });
    });
  });
});

router.post('/login', (req, res) => {
  const { nombre, password } = req.body;

  console.log('Intentando loguear con:', nombre, password); // Registro para depurar

  if (!nombre || !password) {
    console.error('Faltan datos en la solicitud');
    return res.status(400).json({ error: 'Debe proporcionar un nombre y una contraseña.' });
  }

  const sqlQuery = `SELECT * FROM usuarios WHERE nombre = ? AND password = ?`;

  pool.query(sqlQuery, [nombre, password], (err, results) => {
    if (err) {
      console.error('Error en la base de datos:', err);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }

    console.log('Resultados de la consulta:', results);

    if (results.length === 0) {
      console.warn('Credenciales incorrectas');
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const user = results[0];
    return res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      user: {
        id: user.id,
        nombre: user.nombre,
        rol: user.rol,
      },
    });
  });
});


// filtra por semana y bimensual
router.get('/filter', (req, res) => {
  const { bimensual, week } = req.query;

  if (!bimensual || !week) {
    return res.status(400).json({ error: 'Debe proporcionar los parámetros bimensual y week.' });
  }

  pool.query(
    `
    SELECT *
    FROM stock
    WHERE bimensual LIKE ? AND week = ?
    `,
    [`%${bimensual}%`, week],
    (err, results) => {
      if (err) {
        console.error('Error en la consulta:', err);
        res.status(500).json({ error: 'Error en la consulta a la base de datos' });
      } else {
        res.status(200).json(results);
      }
    }
  );
});


router.post('/add', (req, res) => {
  const {
    codigoInsumo,
    nombreInsumo,
    unidad,
    cantidadMaxima,
    cantidadPedida,
    pendiente,
    numeroCompra,
    fechaEnvio,
    fechaLlegada,
    cuantosLlegaron,
    week,
    bimensual,
    observation,
  } = req.body;

  const sqlQuery = `
    INSERT INTO stock (
      codigoInsumo, nombreInsumo, unidad, cantidadMaxima, cantidadPedida,
      pendiente, numeroCompra, fechaEnvio, fechaLlegada, cuantosLlegaron,
      week, bimensual, observation
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  pool.query(
    sqlQuery,
    [
      codigoInsumo,
      nombreInsumo,
      unidad,
      cantidadMaxima || 0,
      cantidadPedida || 0,
      pendiente || 0,
      numeroCompra || null,
      fechaEnvio || null,
      fechaLlegada || null,
      cuantosLlegaron || 0,
      week || null,
      bimensual || null,
      observation || '',
    ],
    (err, result) => {
      if (err) {
        console.error('Error al insertar datos:', err);
        return res.status(500).json({ error: 'Error al guardar la compra' });
      }
      res.status(201).json({ message: 'Compra registrada exitosamente', id: result.insertId });
    }
  );
});





module.exports = router;