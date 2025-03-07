const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Sequelize, DataTypes } = require("sequelize");

// Configuração do banco de dados SQL Server
const sequelize = new Sequelize("STC_SP", "sa", "broz1500", {
  host: "CENSPRAC",
  dialect: "mssql",
  logging: console.log, // Log para depuração
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Modelo da equipe
const Team = sequelize.define("Teams", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  data_atividade: { type: DataTypes.DATEONLY, allowNull: false },
  supervisor: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false },
  equipe: { type: DataTypes.STRING, allowNull: false },
  eletricista_motorista: { type: DataTypes.STRING, allowNull: false },
  eletricista_parceiro: { type: DataTypes.STRING, allowNull: false },
  servico: { type: DataTypes.STRING, allowNull: false },
  placa_veiculo: { type: DataTypes.STRING, allowNull: false },
  finalizado: { type: DataTypes.BOOLEAN, defaultValue: false },
  createdAt: { 
    type: DataTypes.DATE, 
    allowNull: false, 
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") 
  },
  updatedAt: { 
    type: DataTypes.DATE, 
    allowNull: false, 
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") 
  }
}, {
  timestamps: true,
  tableName: "Teams",
});

// Modelo do usuário
const User = sequelize.define("Users", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  matricula: { type: DataTypes.STRING, allowNull: false, unique: true },
  senha: { type: DataTypes.STRING, allowNull: false },
  createdAt: { 
    type: DataTypes.DATE, 
    allowNull: false, 
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") 
  },
  updatedAt: { 
    type: DataTypes.DATE, 
    allowNull: false, 
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") 
  }
}, {
  timestamps: true,
  tableName: "Users",
});

// Sincronizar banco de dados e garantir que as tabelas estão corretas
sequelize.sync({ alter: true })
  .then(() => console.log("Banco de dados sincronizado"))
  .catch(err => console.error("Erro ao sincronizar banco:", err));

// Rota POST para autenticação de usuário
app.post("/login", async (req, res) => {
  try {
    const { matricula, senha } = req.body;

    // Busca o usuário no banco de dados
    const user = await User.findOne({
      where: { matricula, senha }, // Verifica matrícula e senha
    });

    if (!user) {
      return res.status(401).json({ message: "Matrícula ou senha inválidos" });
    }

    // Retorna sucesso se o usuário for encontrado
    res.json({ message: "Login bem-sucedido", user });
  } catch (error) {
    console.error("Erro ao autenticar usuário:", error);
    res.status(500).json({ message: "Erro ao autenticar usuário" });
  }
});

// Rota GET para buscar todas as equipes não finalizadas, com filtro por data
app.get("/teams", async (req, res) => {
  try {
    const { data } = req.query;
    console.log("Parâmetros recebidos:", { data }); // Debug

    const whereClause = { finalizado: false }; // Sempre buscar apenas não finalizados
    if (data) {
      whereClause.data_atividade = data;
    }

    const teams = await Team.findAll({
      where: whereClause,
    });

    console.log("Equipes não finalizadas encontradas:", teams); // Debug
    res.json(teams);
  } catch (error) {
    console.error("Erro ao buscar equipes não finalizadas:", error);
    res.status(500).json({ message: "Erro ao buscar equipes não finalizadas" });
  }
});

// Rota GET para buscar todas as equipes finalizadas, com filtro por data
app.get("/teams/finalizadas", async (req, res) => {
  try {
    const { data } = req.query;
    console.log("Parâmetros recebidos:", { data }); // Debug

    const whereClause = { finalizado: true }; // Buscar apenas finalizados
    if (data) {
      whereClause.data_atividade = data;
    }

    const teams = await Team.findAll({
      where: whereClause,
    });

    console.log("Equipes finalizadas encontradas:", teams); // Debug
    res.json(teams);
  } catch (error) {
    console.error("Erro ao buscar equipes finalizadas:", error);
    res.status(500).json({ message: "Erro ao buscar equipes finalizadas" });
  }
});

// Rota POST para cadastrar uma equipe
app.post("/teams", async (req, res) => {
  try {
    console.log("📩 Dados recebidos do frontend:", req.body); // Debug

    const novaEquipe = await Team.create(req.body);

    res.status(201).json(novaEquipe);
  } catch (error) {
    console.error("❌ Erro ao cadastrar equipe:", error);
    res.status(500).json({ message: "Erro ao cadastrar equipe", error });
  }
});

// Rota PUT para marcar registros como finalizados
app.put("/teams/finalizar", async (req, res) => {
  try {
    await Team.update(
      { finalizado: true }, // Marca todos como finalizados
      { where: { finalizado: false } } // Apenas os não finalizados
    );
    res.json({ message: "Registros finalizados com sucesso" });
  } catch (error) {
    console.error("Erro ao finalizar registros:", error);
    res.status(500).json({ message: "Erro ao finalizar registros" });
  }
});

// Rota PUT para editar um registro
app.put("/teams/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedTeam = await Team.update(req.body, {
      where: { id }
    });

    if (updatedTeam[0] === 0) {
      return res.status(404).json({ message: "Equipe não encontrada" });
    }

    res.json({ message: "Equipe atualizada com sucesso" });
  } catch (error) {
    console.error("Erro ao atualizar equipe:", error);
    res.status(500).json({ message: "Erro ao atualizar equipe" });
  }
});

// Rota DELETE para excluir um registro
app.delete("/teams/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Team.destroy({
      where: { id }
    });

    if (deleted === 0) {
      return res.status(404).json({ message: "Equipe não encontrada" });
    }

    res.json({ message: "Equipe excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir equipe:", error);
    res.status(500).json({ message: "Erro ao excluir equipe" });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});