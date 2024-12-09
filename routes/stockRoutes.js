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

  // Usamos transacciones para asegurarnos de que todas las actualizaciones se realizan correctamente
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

      // Preparamos las consultas para cada fila del array que se desea actualizar
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
          } = item;

          // Convertimos las fechas al formato YYYY-MM-DD si vienen en formato ISO
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
              cuantosLlegaron = ?
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

      // Ejecutamos todas las consultas
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

  
  
  module.exports = router;