require("dotenv").config();
console.log("🔹 Configurações carregadas:", {
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
});

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Sequelize, DataTypes } = require("sequelize");

// Configuração do banco de dados SQL Server
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: "mssql",
  port: process.env.DB_PORT,
  dialectOptions: {
    options: {
      encrypt: true, // Necessário para Azure
      trustServerCertificate: false,
    },
  },
  logging: console.log, // Opcional para debug
});

// Testar conexão com o banco de dados
sequelize
  .authenticate()
  .then(() => console.log("🎉 Conectado ao banco de dados Azure SQL!"))
  .catch((err) => console.error("Erro ao conectar ao banco:", err));

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Modelo da equipe
const Team = sequelize.define(
  "Teams",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    data_atividade: { type: DataTypes.DATEONLY, allowNull: false },
    supervisor: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false },
    equipe: { type: DataTypes.STRING, allowNull: false },
    eletricista_motorista: { type: DataTypes.STRING, allowNull: false },
    eletricista_parceiro: { type: DataTypes.STRING, allowNull: false },
    servico: { type: DataTypes.STRING, allowNull: false },
    placa_veiculo: { type: DataTypes.STRING, allowNull: false },
    finalizado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      // Remova o defaultValue aqui
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      // Remova o defaultValue aqui
    },
  },
  {
    timestamps: true,
    tableName: "Teams",
  }
);

// Modelo do usuário
const User = sequelize.define(
  "Users",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    matricula: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    senha: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    tableName: "Users",
  }
);

// Sincronizar banco de dados e garantir que as tabelas estão corretas
sequelize
  .sync({ alter: true }) // Use `force: true` apenas em desenvolvimento para recriar tabelas
  .then(() => console.log("Banco de dados sincronizado"))
  .catch((err) => console.error("Erro ao sincronizar banco:", err));

// Rota POST para autenticação de usuário
app.post("/login", async (req, res) => {
  try {
    const { matricula, senha } = req.body;

    // Busca o usuário no banco de dados
    const user = await User.findOne({
      where: { matricula },
    });

    if (!user) {
      return res.status(401).json({ message: "Matrícula ou senha inválidos" });
    }

    // Compara a senha fornecida com a senha armazenada (em texto plano)
    if (senha !== user.senha) {
      return res.status(401).json({ message: "Matrícula ou senha inválidos" });
    }

    // Retorna sucesso se o usuário for encontrado e a senha estiver correta
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
      where: { id },
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
      where: { id },
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