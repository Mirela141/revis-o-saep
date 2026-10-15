require('dotenv').config();
app.use('/produtos', produtosRouter);

const app = require('./app');
const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});