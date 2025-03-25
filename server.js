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
const { Sequelize, DataTypes, Op } = require("sequelize");

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

// Configuração do CORS para permitir solicitações do frontend no Vercel
app.use(
  cors({
    origin: "https://composicao-sp-stc.vercel.app", // Permite apenas o frontend no Vercel
    credentials: true, // Permite cookies e cabeçalhos de autenticação
  })
);

app.use(bodyParser.json());

// Rota raiz para verificar se o servidor está funcionando
app.get("/", (req, res) => {
  res.send("Backend da Composição SP está funcionando! 🚀");
});

// Middleware para normalizar dados antes das rotas POST/PUT
app.use('/teams', (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    if (req.body.status !== "CAMPO") {
      req.body.equipe = "N/A";
      req.body.servico = "N/A";
      req.body.placa_veiculo = "N/A";
      // Garante que motorista/parceiro sejam N/A se não informados
      if (!req.body.eletricista_motorista) req.body.eletricista_motorista = "N/A";
    }
  }
  next();
});

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
    br0_motorista: { type: DataTypes.STRING, allowNull: true },
    eletricista_parceiro: { type: DataTypes.STRING, allowNull: false },
    br0_parceiro: { type: DataTypes.STRING, allowNull: true },
    servico: { type: DataTypes.STRING, allowNull: false },
    placa_veiculo: { type: DataTypes.STRING, allowNull: false },
    finalizado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
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
    },
    senha: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      defaultValue: "user", // Define "user" como padrão
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

  

// Função para validar duplicidade
const validateDuplicates = async (newTeam, editId = null) => {
  const { 
    data_atividade, 
    equipe, 
    placa_veiculo, 
    eletricista_motorista, 
    eletricista_parceiro, 
    status 
  } = newTeam;

  // 1. Validação básica que sempre aplica (exceto quando é N/A)
  if (eletricista_motorista === eletricista_parceiro && 
      eletricista_motorista !== "N/A" && 
      eletricista_parceiro !== "N/A") {
    return "O eletricista motorista não pode ser o mesmo que o eletricista parceiro.";
  }

  // 2. Validações específicas para status "CAMPO"
  if (status === "CAMPO") {
    // Verifica equipe duplicada (ignorando valores N/A)
    if (equipe && equipe !== "N/A") {
      const duplicateEquipe = await Team.findOne({
        where: { 
          data_atividade, 
          equipe, 
          id: { [Op.ne]: editId },
          status: "CAMPO" // Só verifica duplicata em outros registros CAMPO
        },
      });
      if (duplicateEquipe) return "Já existe uma equipe com o mesmo nome para esta data.";
    }

    // Verifica placa duplicada (ignorando valores N/A)
    if (placa_veiculo && placa_veiculo !== "N/A") {
      const duplicatePlaca = await Team.findOne({
        where: { 
          data_atividade, 
          placa_veiculo, 
          id: { [Op.ne]: editId },
          status: "CAMPO" // Só verifica duplicata em outros registros CAMPO
        },
      });
      if (duplicatePlaca) return "Já existe uma placa com o mesmo número para esta data.";
    }

    // Verifica eletricistas duplicados (ignorando N/A)
    if ((eletricista_motorista && eletricista_motorista !== "N/A") || 
        (eletricista_parceiro && eletricista_parceiro !== "N/A")) {
      const whereClause = {
        data_atividade,
        id: { [Op.ne]: editId },
        status: "CAMPO", // Só verifica em outros registros CAMPO
        [Op.or]: []
      };

      if (eletricista_motorista && eletricista_motorista !== "N/A") {
        whereClause[Op.or].push(
          { eletricista_motorista: eletricista_motorista },
          { eletricista_parceiro: eletricista_motorista }
        );
      }

      if (eletricista_parceiro && eletricista_parceiro !== "N/A") {
        whereClause[Op.or].push(
          { eletricista_motorista: eletricista_parceiro },
          { eletricista_parceiro: eletricista_parceiro }
        );
      }

      const duplicateEletricistas = await Team.findOne({ where: whereClause });
      if (duplicateEletricistas) {
        return "Já existe um motorista ou parceiro com o mesmo nome para esta data.";
      }
    }
  }

  return null; // Sem erros de validação
};



// Rota POST para autenticação de usuário
app.post("/login", async (req, res) => {
  try {
    const { matricula, senha } = req.body;

    console.log("Dados recebidos do frontend:", { matricula, senha }); // Log dos dados recebidos

    // Busca o usuário no banco de dados
    const user = await User.findOne({
      where: { matricula },
    });

    console.log("Usuário encontrado no banco de dados:", user); // Log do usuário encontrado

    if (!user) {
      console.log("Usuário não encontrado"); // Log se o usuário não for encontrado
      return res.status(401).json({ message: "Matrícula ou senha inválidos" });
    }

    // Compara a senha fornecida com a senha armazenada (em texto plano)
    if (senha !== user.senha) {
      console.log("Senha incorreta"); // Log se a senha estiver incorreta
      return res.status(401).json({ message: "Matrícula ou senha inválidos" });
    }

    // Retorna sucesso se o usuário for encontrado e a senha estiver correta
    console.log("Login bem-sucedido"); // Log de sucesso
    res.json({
      message: "Login bem-sucedido",
      user: {
        matricula: user.matricula,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Erro ao autenticar usuário:", error); // Log de erro
    res.status(500).json({ message: "Erro ao autenticar usuário" });
  }
});

// Rota GET para buscar todas as equipes não finalizadas, com filtro por data e supervisor
app.get("/teams", async (req, res) => {
  try {
    const { data, supervisor, role } = req.query;
    console.log("Parâmetros recebidos:", { data, supervisor, role }); // Debug

    const whereClause = { finalizado: false }; // Sempre buscar apenas não finalizados

    // Filtro por data
    if (data) {
      whereClause.data_atividade = data;
    }

    // Filtro por supervisor (aplicado apenas se o usuário for supervisor)
    if (role === "supervisor" && supervisor) {
      // Usa diretamente o valor completo do supervisor enviado pelo frontend
      whereClause.supervisor = supervisor; // Filtra pela coluna "supervisor" no banco de dados
    }

    // Busca as equipes no banco de dados
    const teams = await Team.findAll({ where: whereClause });

    console.log(`Equipes encontradas (${teams.length} resultados):`, teams); // Debug melhorado
    res.json(teams);
  } catch (error) {
    console.error("Erro ao buscar equipes não finalizadas:", error);
    res.status(500).json({ message: "Erro ao buscar equipes não finalizadas" });
  }
});

// Rota GET para buscar todas as equipes finalizadas, com filtro por data e supervisor
app.get("/teams/finalizadas", async (req, res) => {
  try {
    const { data, supervisor, role } = req.query;
    console.log("Parâmetros recebidos:", { data, supervisor, role }); // Debug

    const whereClause = { finalizado: true }; // Buscar apenas finalizados

    // Filtro por data
    if (data) {
      whereClause.data_atividade = data;
    }

    // Filtro por supervisor (aplicado apenas se o usuário for supervisor)
    if (role === "supervisor" && supervisor) {
      // Usa diretamente o valor completo do supervisor enviado pelo frontend
      whereClause.supervisor = supervisor; // Filtra pela coluna "supervisor" no banco de dados
    }

    // Busca as equipes no banco de dados
    const teams = await Team.findAll({ where: whereClause });

    console.log(`Equipes finalizadas encontradas (${teams.length} resultados):`, teams); // Debug melhorado
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

    // Verifica duplicidade
    const duplicateError = await validateDuplicates(req.body);
    if (duplicateError) {
      return res.status(400).json({ message: duplicateError });
    }

    // Cria a nova equipe se não houver duplicidade
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

    // Verifica duplicidade
    const duplicateError = await validateDuplicates(req.body, req.params.id);
    if (duplicateError) {
      return res.status(400).json({ message: duplicateError });
    }

    // Atualiza a equipe se não houver duplicidade
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