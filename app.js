const express = require('express');
const cors = require('cors');
const produtosRoutes = require('./routes/produtos');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/produtos', produtosRoutes);

module.exports = app;