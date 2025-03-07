const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Team = sequelize.define('Team', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    data_atividade: { type: DataTypes.DATEONLY, allowNull: false },
    supervisor: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false },
    equipe: { type: DataTypes.STRING, allowNull: false },
    eletricista_motorista: { type: DataTypes.STRING, allowNull: false },
    eletricista_parceiro: { type: DataTypes.STRING, allowNull: false },
    servico: { type: DataTypes.STRING, allowNull: false },
    placa_veiculo: { type: DataTypes.STRING, allowNull: false }
}, {
    timestamps: true
});

sequelize.sync();
module.exports = Team;