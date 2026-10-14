const express = require('express');
const router = express.Router();
const db = require('../db');

// 6) Listar todos os produtos
router.get('/', (req, res) => {
    db.query('SELECT * FROM produtos', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao buscar produtos' });
        }
        res.json(results);
    });
});

// 7) Cadastrar novos produtos
router.post('/cadastrar', (req, res) => {
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

    const sql = `
        INSERT INTO produtos
        (nome, quantidade, valor, categoria)
        VALUES (?, ?, ?, ?)
    `;

    db.query(
        sql,
        [nome, quantidade, valor, categoria],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Erro ao cadastrar produto' });
            }

            return res.status(201).json({
                message: 'Produto cadastrado com sucesso',
                id: results.insertId
            });
        }
    );
});

// 8) Registrar entrada de produto no estoque
router.post('/entrada', (req, res) => {
    const { id, quantidade } = req.body;

    if (!id || quantidade === undefined || quantidade === null || quantidade <= 0) {
        return res.status(400).json({
            error: 'Informe id e quantidade maior que zero'
        });
    }

    const atualizarProduto = `
        UPDATE produtos
        SET quantidade = quantidade + ?
        WHERE id = ?
    `;

    db.query(atualizarProduto, [quantidade, id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao registrar entrada' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        // Ajustado para 'data_movimentacao'
        const registrarMovimentacao = `
            INSERT INTO movimentacoes
            (data_movimentacao, tipo, quantidade, produtos_id)
            VALUES (CURDATE(), 'entrada', ?, ?)
        `;

        db.query(registrarMovimentacao, [quantidade, id], (err2) => {
            if (err2) {
                console.error(err2);
                return res.status(500).json({
                    error: 'Produto atualizado, mas houve erro ao registrar a movimentação'
                });
            }

            return res.status(200).json({
                message: 'Entrada registrada com sucesso'
            });
        });
    });
});

// 9) Valor total por categoria
router.get('/valor-total', (req, res) => {
    const sql = `
        SELECT
            categoria,
            SUM(quantidade * valor) AS valor_total
        FROM produtos
        GROUP BY categoria
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao buscar valor total por categoria' });
        }
        res.json(results);
    });
});

// 10) Listar todas as saídas em ordem decrescente por data
router.get('/saidas', (req, res) => {
    const sql = `
        SELECT *
        FROM movimentacoes
        WHERE LOWER(tipo) = 'saida' OR LOWER(tipo) = 'saída'
        ORDER BY data_movimentacao DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao buscar saídas' });
        }
        res.json(results);
    });
});

// 11) Produtos nos limites mínimo e máximo
router.get('/limites', (req, res) => {
    const sql = `
        SELECT
            id,
            nome,
            quantidade,
            valor,
            categoria,
            (quantidade / 100) * 100 AS percentual
        FROM produtos
        WHERE quantidade <= 0 OR quantidade >= 100
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao buscar produtos nos limites' });
        }
        res.json(results);
    });
});

// 12) Movimentações por período
router.get('/movimentacoes', (req, res) => {
    const { data_inicial, data_final } = req.query;

    if (!data_inicial || !data_final) {
        return res.status(400).json({
            error: 'Informe data_inicial e data_final na URL'
        });
    }

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
        INNER JOIN movimentacoes m
            ON p.id = m.produtos_id
        WHERE m.data_movimentacao BETWEEN ? AND ?
        GROUP BY p.id, p.nome
    `;

    db.query(sql, [data_inicial, data_final], (err, results) => {
        if (err) {
            console.error('ERRO NO BANCO (ROTA 12):', err);
            return res.status(500).json({ error: 'Erro ao buscar movimentações no período' });
        }
        res.json(results);
    });
});

// 13) Produtos com maior volume de saída no período
router.get('/maiores-saidas', (req, res) => {
    const { data_inicial, data_final } = req.query;

    if (!data_inicial || !data_final) {
        return res.status(400).json({
            error: 'Informe data_inicial e data_final na URL'
        });
    }

    const sql = `
        SELECT
            p.nome AS nome_do_produto,
            SUM(m.quantidade) AS quantidade_total_de_saidas,
            SUM(m.quantidade * p.valor) AS valor_total_financeiro_das_saidas
        FROM produtos p
        INNER JOIN movimentacoes m
            ON p.id = m.produtos_id
        WHERE (LOWER(m.tipo) = 'saida' OR LOWER(m.tipo) = 'saída')
          AND m.data_movimentacao BETWEEN ? AND ?
        GROUP BY p.id, p.nome
        ORDER BY quantidade_total_de_saidas DESC
    `;

    db.query(sql, [data_inicial, data_final], (err, results) => {
        if (err) {
            console.error('ERRO NO BANCO (ROTA 13):', err);
            return res.status(500).json({ error: 'Erro ao buscar maiores saídas' });
        }
        res.json(results);
    });
});

module.exports = router;