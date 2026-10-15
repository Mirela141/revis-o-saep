const express = require('express');
const app = express();
const produtosRouter = require('./routes/produtos');

app.use(express.json());

// Regista as rotas sob o prefixo /produtos
app.use('/produtos', produtosRouter);

// OBRIGATÓRIO PARA A VERCEL: exporta a app Express
module.exports = app;

// Executa o servidor apenas no ambiente local
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Servidor a executar na porta ${PORT}`));
}