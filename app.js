
const express = require('express');
const path = require('path');
const cors = require('cors');
const produtosRoutes = require('./routes/produtos');

const app = express();

app.use(cors());
app.use(express.json());

// Página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// JavaScript do site
app.get('/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'script.js'));
});

// Rotas da API
app.use('/produtos', produtosRoutes);

module.exports = app;
