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
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: "mssql",
  port: process.env.DB_PORT,
  timezone: '-03:00', // <<< Define o fuso horário de Brasília (UTC-3)
  dialectOptions: {
    options: {
      encrypt: true, // Necessário para Azure
      trustServerCertificate: false,
      useUTC: false, // <<< Muito importante: desativa UTC para salvar no timezone definido
    },
  },
  logging: console.log,
});

const supervisoresPorEstado = {
  SP: [
    "018505 - DIEGO RAFAEL DE MELO SILVA",
    "006061 - JULIO CESAR PEREIRA DA SILVA",
    "016032 - WAGNER AUGUSTO DA SILVA MAURO"

  ],
  RJ: [
    "017451 - WESLEY PEREIRA DE SOUZA GOMES",
    "015843 - HUGO PACHECO DOS SANTOS",
    "004438 - JOSE OSCAR DO NASCIMENTO DE AZEVEDO",
    "015729 - TIAGO DE SOUZA MATTOS"
  ],
  RJB: [
    "018089 - SILVIA HELENA MARIOTINI DE ALCANTARA",
    "018273 - JALISON NAVEGA",
    "018274 - MARLON SILVA PINTO",
    "018275 - FELIPE NATAL DIAS",
    "018276 - RODOLPHO GOMES MOCAIBER",
    "018412 - ADISON DOS SANTOS",
    "018466 - JOAO BATISTA FRANCISCO",
    "018468 - DANIEL PEIXOTO AREAS",
    "018761 - GELSON ERIS MOREIRA PASSOS",
    "018575 - MARCO ANTONIO DE NOVAES OLIVEIRA",
    "019231 - RAFAEL BATISTA PIASSA",
    "019412 - ROBSON JOSE DE QUEIROZ GUIMARAES",
    "019485 - RENATO SANTIAGO SILVA",
    "019704 - JORGE MICHAEL DE CASTRO PIRES",
    "020116 - WANDERSON FERREIRA DA CONCEICAO"
  ]
};


// Testar conexão com o banco de dados
sequelize
  .authenticate()
  .then(() => console.log("🎉 Conectado ao banco de dados Azure SQL!"))
  .catch((err) => console.error("Erro ao conectar ao banco:", err));

const app = express();

// Configuração do CORS para permitir solicitações do frontend no Vercel
app.use(
  cors({
    origin: "https://composicao-stc.vercel.app", // Permite apenas o frontend no Vercel
    credentials: true, // Permite cookies e cabeçalhos de autenticação
  })
);

app.use(bodyParser.json());

// Rota raiz para verificar se o servidor está funcionando
app.get("/", (req, res) => {
  res.send("Backend da Composição STC está funcionando! 🚀");
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
  
const validateDuplicates = async (newTeam, editId = null) => {
  const {
    data_atividade,
    equipe,
    placa_veiculo,
    eletricista_motorista,
    eletricista_parceiro,
    status,
  } = newTeam;

  const whereBase = {
    data_atividade,
    id: { [Op.ne]: editId }, // Ignora o próprio registro em edição
  };

  // 🔎 1) Validação de eletricista motorista
  if (eletricista_motorista && eletricista_motorista !== "N/A") {
    const motoristaDuplicado = await Team.findOne({
      where: {
        ...whereBase,
        [Op.or]: [
          { eletricista_motorista },
          { eletricista_parceiro: eletricista_motorista }
        ],
      },
    });
    if (motoristaDuplicado) {
      return `O eletricista "${eletricista_motorista}" já está cadastrado nesta data (como motorista ou parceiro).`;
    }
  }

  // 🔎 2) Validação de eletricista parceiro
  if (eletricista_parceiro && eletricista_parceiro !== "N/A") {
    const parceiroDuplicado = await Team.findOne({
      where: {
        ...whereBase,
        [Op.or]: [
          { eletricista_motorista: eletricista_parceiro },
          { eletricista_parceiro }
        ],
      },
    });
    if (parceiroDuplicado) {
      return `O eletricista "${eletricista_parceiro}" já está cadastrado nesta data (como motorista ou parceiro).`;
    }
  }

  // 🔎 3) Validação de equipe (apenas para status CAMPO)
  if (status === "CAMPO" && equipe && equipe !== "N/A") {
    const equipeDuplicada = await Team.findOne({
      where: {
        ...whereBase,
        status: "CAMPO",
        equipe,
      },
    });
    if (equipeDuplicada) {
      return `A equipe "${equipe}" já está cadastrada para esta data.`;
    }
  }

  // 🔎 4) Validação de placa (apenas para status CAMPO)
  if (status === "CAMPO" && placa_veiculo && placa_veiculo !== "N/A") {
    const placaDuplicada = await Team.findOne({
      where: {
        ...whereBase,
        status: "CAMPO",
        placa_veiculo,
      },
    });
    if (placaDuplicada) {
      return `A placa "${placa_veiculo}" já está cadastrada para esta data.`;
    }
  }

  return null; // ✅ Nenhuma duplicidade encontrada
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
  const { data, estado, supervisor } = req.query;

  const whereClause = {
    finalizado: true,
  };

  if (data) {
    if (data.includes(',')) {
      const [startDate, endDate] = data.split(',');
      whereClause.data_atividade = { [Op.between]: [startDate, endDate] };
    } else {
      whereClause.data_atividade = data;
    }
  }

  // Filtro por estado (lista de supervisores)
  if (estado && supervisoresPorEstado[estado]) {
    whereClause.supervisor = { [Op.in]: supervisoresPorEstado[estado] };
  }

  // Filtro por supervisor específico (sobrescreve o estado se for passado)
  if (supervisor) {
    whereClause.supervisor = supervisor;
  }

  try {
    const teams = await Team.findAll({
      where: whereClause,
      order: [['data_atividade', 'ASC']],
    });
    res.json(teams);
  } catch (error) {
    console.error('Erro ao buscar equipes finalizadas:', error);
    res.status(500).json({ message: 'Erro ao buscar equipes finalizadas' });
  }
});

app.get("/absenteismo", async (req, res) => {
  const { startDate, endDate, estado } = req.query;

  const whereClause = {};

  // Filtro por intervalo de datas
  if (startDate && endDate) {
    whereClause.data_atividade = {
      [Op.between]: [startDate, endDate],
    };
  }

  // Filtro por estado (supervisores daquele estado)
  if (estado && supervisoresPorEstado[estado]) {
    whereClause.supervisor = {
      [Op.in]: supervisoresPorEstado[estado],
    };
  }

  try {
    const teams = await Team.findAll({ where: whereClause });

    const total = teams.length;
    const completas = teams.filter((t) => t.status === 'CAMPO').length;
    const ausentes = total - completas;

    const denominador = (completas * 2) + ausentes;
    const percentual = denominador > 0 ? ((ausentes / denominador) * 100).toFixed(2) : '0';

    res.json({
      total,
      completas,
      ausentes,
      percentual,
    });
  } catch (error) {
    console.error('Erro ao calcular absenteísmo:', error);
    res.status(500).json({ message: 'Erro ao calcular absenteísmo' });
  }
});

app.get("/eletricistas/apontados", async (req, res) => {
  const { data, estado } = req.query;

  if (!data || !estado || !supervisoresPorEstado[estado]) {
    return res.status(400).json({ message: "Parâmetros 'data' e 'estado' obrigatórios e válidos." });
  }

  try {
    const teams = await Team.findAll({
      where: {
        data_atividade: data,
        finalizado: true,  
        supervisor: { [Op.in]: supervisoresPorEstado[estado] }
      },
      attributes: ["eletricista_motorista", "eletricista_parceiro"]
    });

    const apontados = new Set();
    teams.forEach(team => {
      if (team.eletricista_motorista && team.eletricista_motorista !== 'N/A') apontados.add(team.eletricista_motorista);
      if (team.eletricista_parceiro && team.eletricista_parceiro !== 'N/A') apontados.add(team.eletricista_parceiro);
    });

    res.json(Array.from(apontados));
  } catch (error) {
    console.error("Erro ao buscar eletricistas apontados:", error);
    res.status(500).json({ message: "Erro ao buscar eletricistas apontados" });
  }
});

app.get("/composicao/export", async (req, res) => {
  try {
    const { data, estado } = req.query;

    if (!data) return res.status(400).json({ message: "Data é obrigatória" });

    const whereClause = {
      data_atividade: data,
      finalizado: true,
    };

    if (estado && supervisoresPorEstado[estado]) {
      whereClause.supervisor = { [Op.in]: supervisoresPorEstado[estado] };
    }

    const equipes = await Team.findAll({
      where: whereClause,
      order: [['data_atividade', 'ASC']],
    });

    const plain = equipes.map((e) => ({
      Data: e.data_atividade,
      Supervisor: e.supervisor,
      Equipe: e.equipe,
      Motorista: e.eletricista_motorista,
      Parceiro: e.eletricista_parceiro,
      Serviço: e.servico,
      Placa: e.placa_veiculo,
      Status: e.status,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(plain);
    XLSX.utils.book_append_sheet(wb, ws, "Composição");

    const filePath = path.join(__dirname, `composicao_${data}_${estado || "todos"}.xlsx`);
    XLSX.writeFile(wb, filePath);

    res.download(filePath, `composicao_${data}_${estado || "todos"}.xlsx`, () => {
      fs.unlinkSync(filePath); // Remove o arquivo após o download
    });

  } catch (error) {
    console.error("Erro ao gerar Excel:", error);
    res.status(500).json({ message: "Erro ao exportar composição" });
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