const express = require('express');
const app = express();
const produtosRouter = require('../routes/produtos');

app.use(express.json());
app.use('/produtos', produtosRouter);

module.exports = app;

//OII