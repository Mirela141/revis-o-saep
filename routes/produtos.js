const express = require('express');
const router = express.Router();
const db = require('../db');

// 6) Listar todos os produtos
router.get('/', async (req, res) => {
    try {
        const results = await db.query('SELECT * FROM produtos');
        res.json(results.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});

// 7) Cadastrar novos produtos
router.post('/cadastrar', async (req, res) => {
    const { nome, quantidade, valor, categoria } = req.body;

    if (
        !nome ||
        quantidade === undefined ||
        quantidade === null ||
        valor === undefined ||
        valor === null ||
        !categoria
    ) {
        return res.status(400).json({
            error: 'Campos obrigatórios: nome, quantidade, valor e categoria'
        });
    }

    if (quantidade < 0) {
        return res.status(400).json({ error: 'A quantidade não pode ser negativa' });
    }

    if (valor <= 0) {
        return res.status(400).json({ error: 'O valor deve ser maior que zero' });
    }

    try {
        const sql = `
            INSERT INTO produtos (nome, quantidade, valor, categoria)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `;
        const results = await db.query(sql, [nome, quantidade, valor, categoria]);

        return res.status(201).json({
            message: 'Produto cadastrado com sucesso',
            id: results.rows[0].id
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao cadastrar produto' });
    }
});

// 8) Registrar entrada de produto no estoque
router.post('/entrada', async (req, res) => {
    const { id, quantidade } = req.body;

    if (!id || quantidade === undefined || quantidade === null || quantidade <= 0) {
        return res.status(400).json({
            error: 'Informe id e quantidade maior que zero'
        });
    }

    try {
        const atualizarProduto = `
            UPDATE produtos
            SET quantidade = quantidade + $1
            WHERE id = $2
        `;
        const results = await db.query(atualizarProduto, [quantidade, id]);

        if (results.rowCount === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const registrarMovimentacao = `
            INSERT INTO movimentacoes (data_movimentacao, tipo, quantidade, produtos_id)
            VALUES (CURRENT_DATE, 'entrada', $1, $2)
        `;
        await db.query(registrarMovimentacao, [quantidade, id]);

        return res.status(200).json({ message: 'Entrada registrada com sucesso' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao registrar entrada' });
    }
});

// 8.1) Registrar saída de produto do estoque
router.post('/saida', async (req, res) => {
    const { id, quantidade, observacao } = req.body;

    if (!id || quantidade === undefined || quantidade === null || quantidade <= 0) {
        return res.status(400).json({
            error: 'Informe id e quantidade maior que zero'
        });
    }

    try {
        // Verifica se o produto existe e se possui estoque suficiente
        const produtoResult = await db.query('SELECT quantidade FROM produtos WHERE id = $1', [id]);

        if (produtoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const estoqueAtual = produtoResult.rows[0].quantidade;
        if (estoqueAtual < quantidade) {
            return res.status(400).json({ 
                error: `Estoque insuficiente. Quantidade atual disponível: ${estoqueAtual}` 
            });
        }

        // Subtrai do estoque
        const atualizarProduto = `
            UPDATE produtos
            SET quantidade = quantidade - $1
            WHERE id = $2
        `;
        await db.query(atualizarProduto, [quantidade, id]);

        // Registra a movimentação de saída
        const registrarMovimentacao = `
            INSERT INTO movimentacoes (data_movimentacao, tipo, quantidade, produtos_id)
            VALUES (CURRENT_DATE, 'saida', $1, $2)
        `;
        await db.query(registrarMovimentacao, [quantidade, id]);

        return res.status(200).json({ message: 'Saída registrada com sucesso' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao registrar saída' });
    }
});

// 9) Valor total por categoria
router.get('/valor-total', async (req, res) => {
    try {
        const sql = `
            SELECT
                categoria,
                SUM(quantidade * valor) AS valor_total
            FROM produtos
            GROUP BY categoria
        `;
        const results = await db.query(sql);
        res.json(results.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar valor total por categoria' });
    }
});

// 10) Listar todas as saídas em ordem decrescente por data
router.get('/saidas', async (req, res) => {
    try {
        const sql = `
            SELECT *
            FROM movimentacoes
            WHERE LOWER(tipo) = 'saida' OR LOWER(tipo) = 'saída'
            ORDER BY data_movimentacao DESC
        `;
        const results = await db.query(sql);
        res.json(results.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar saídas' });
    }
});

module.exports = router;