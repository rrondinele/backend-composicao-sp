const express = require("express");
const router = express.Router();
const Team = require("../models/Team");

// Rota para cadastrar uma equipe
router.post("/teams", async (req, res) => {
  try {
    const {
      data_atividade,
      supervisor,
      status,
      equipe,
      eletricista_motorista,
      eletricista_parceiro,
      servico,
      placa_veiculo,
    } = req.body;

    const novaEquipe = await Team.create({
      data_atividade,
      supervisor,
      status,
      equipe,
      eletricista_motorista,
      eletricista_parceiro,
      servico,
      placa_veiculo,
    });

    res.status(201).json(novaEquipe);
  } catch (error) {
    console.error("Erro ao cadastrar equipe:", error);
    res.status(500).json({ message: "Erro ao cadastrar equipe" });
  }
});

module.exports = router;
