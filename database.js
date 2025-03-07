const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: 'mssql',
    port: process.env.DB_PORT,
    logging: false,
    dialectOptions: {
        options: {
            encrypt: false, // Desative se estiver rodando localmente
            trustServerCertificate: true // Importante para conexões seguras
        }
    }
});

module.exports = sequelize;