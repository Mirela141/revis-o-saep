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
    const { nome, quantidade, valor, categoria, unidade_medida } = req.body;

    if (
        !nome ||
        quantidade === undefined ||
        quantidade === null ||
        valor === undefined ||
        valor === null ||
        !categoria ||
        !unidade_medida
    ) {
        return res.status(400).json({
            error: 'Campos obrigatórios: nome, quantidade, valor, categoria e unidade_medida'
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
            INSERT INTO produtos (nome, quantidade, valor, categoria, unidade_medida)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `;
        const results = await db.query(sql, [nome, quantidade, valor, categoria, unidade_medida]);

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

        const atualizarProduto = `
            UPDATE produtos
            SET quantidade = quantidade - $1
            WHERE id = $2
        `;
        await db.query(atualizarProduto, [quantidade, id]);

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

// 11) Produtos nos limites mínimo e máximo
router.get('/limites', async (req, res) => {
    try {
        const sql = `
            SELECT
                id,
                nome,
                quantidade,
                valor,
                categoria,
                (quantidade / 100.0) * 100 AS percentual
            FROM produtos
            WHERE quantidade <= 0 OR quantidade >= 100
        `;
        const results = await db.query(sql);
        res.json(results.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar produtos nos limites' });
    }
});

// 12) Movimentações por período
router.get('/movimentacoes', async (req, res) => {
    const { data_inicial, data_final } = req.query;

    if (!data_inicial || !data_final) {
        return res.status(400).json({
            error: 'Informe data_inicial e data_final na URL'
        });
    }

    try {
        const sql = `
            SELECT
                p.nome AS nome_do_produto,
                SUM(CASE WHEN LOWER(m.tipo) = 'entrada' THEN m.quantidade ELSE 0 END) AS total_de_entradas,
                SUM(CASE WHEN LOWER(m.tipo) = 'saida' OR LOWER(m.tipo) = 'saída' THEN m.quantidade ELSE 0 END) AS total_de_saidas,
                SUM(
                    CASE
                        WHEN LOWER(m.tipo) = 'entrada' THEN m.quantidade
                        WHEN LOWER(m.tipo) = 'saida' OR LOWER(m.tipo) = 'saída' THEN -m.quantidade
                        ELSE 0
                    END
                ) AS saldo_no_periodo,
                SUM(CASE WHEN LOWER(m.tipo) = 'entrada' THEN m.quantidade * p.valor ELSE 0 END) AS valor_total_financeiro_das_entradas,
                SUM(CASE WHEN LOWER(m.tipo) = 'saida' OR LOWER(m.tipo) = 'saída' THEN m.quantidade * p.valor ELSE 0 END) AS valor_total_financeiro_das_saidas
            FROM produtos p
            INNER JOIN movimentacoes m ON p.id = m.produtos_id
            WHERE m.data_movimentacao BETWEEN $1 AND $2
            GROUP BY p.id, p.nome
        `;
        const results = await db.query(sql, [data_inicial, data_final]);
        res.json(results.rows);
    } catch (err) {
        console.error('ERRO NO BANCO (ROTA 12):', err);
        res.status(500).json({ error: 'Erro ao buscar movimentações no período' });
    }
});

// 13) Produtos com maior volume de saída no período
router.get('/maiores-saidas', async (req, res) => {
    const { data_inicial, data_final } = req.query;

    if (!data_inicial || !data_final) {
        return res.status(400).json({
            error: 'Informe data_inicial e data_final na URL'
        });
    }

    try {
        const sql = `
            SELECT
                p.nome AS nome_do_produto,
                SUM(m.quantidade) AS quantidade_total_de_saidas,
                SUM(m.quantidade * p.valor) AS valor_total_financeiro_das_saidas
            FROM produtos p
            INNER JOIN movimentacoes m ON p.id = m.produtos_id
            WHERE (LOWER(m.tipo) = 'saida' OR LOWER(m.tipo) = 'saída')
            AND m.data_movimentacao BETWEEN $1 AND $2
            GROUP BY p.id, p.nome
            ORDER BY quantidade_total_de_saidas DESC
        `;
        const results = await db.query(sql, [data_inicial, data_final]);
        res.json(results.rows);
    } catch (err) {
        console.error('ERRO NO BANCO (ROTA 13):', err);
        res.status(500).json({ error: 'Erro ao buscar maiores saídas' });
    }
});

module.exports = router;