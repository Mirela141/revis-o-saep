const API = '/produtos';

let produtos = [];

const $ = (id) => document.getElementById(id);

const moeda = (valor) =>
    Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

const numero = (valor) =>
    Number(valor || 0).toLocaleString('pt-BR');

function escapar(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

async function requisicao(caminho = '', opcoes = {}) {
    const resposta = await fetch(`${API}${caminho}`, {
        ...opcoes,
        headers: {
            'Content-Type': 'application/json',
            ...opcoes.headers
        }
    });

    const texto = await resposta.text();
    let dados = null;

    try {
        dados = texto ? JSON.parse(texto) : null;
    } catch {
        throw new Error('A API retornou uma resposta inválida.');
    }

    if (!resposta.ok) {
        throw new Error(dados?.error || 'Erro ao comunicar com a API.');
    }

    return dados;
}

function mostrarMensagem(id, mensagem, erro = false) {
    const elemento = $(id);

    if (!elemento) return;

    elemento.innerHTML = `
        <tr>
            <td colspan="6" class="empty">
                ${escapar(mensagem)}
            </td>
        </tr>
    `;

    if (erro) {
        console.error(mensagem);
    }
}

function preencherTabela(id, linhas, colunas, mensagemVazia) {
    const tabela = $(id);

    if (!tabela) return;

    if (!Array.isArray(linhas) || !linhas.length) {
        mostrarMensagem(id, mensagemVazia);
        return;
    }

    if (!Array.isArray(colunas)) {
        console.error('O parâmetro colunas precisa de ser um Array.');
        return;
    }

    tabela.innerHTML = linhas.map((linha) => `
        <tr>
            ${colunas.map((coluna) =>
                `<td>${coluna(linha)}</td>`
            ).join('')}
        </tr>
    `).join('');
}

function renderizarProdutos(lista = produtos) {
    const colunas = [
        (p) => escapar(p.id),
        (p) => escapar(p.nome),
        (p) => escapar(p.categoria),
        (p) => numero(p.quantidade),
        (p) => moeda(p.valor)
    ];

    preencherTabela(
        'tabela-produtos',
        lista,
        colunas,
        'Nenhum produto encontrado.'
    );

    preencherTabela(
        'tabela-dashboard',
        lista,
        colunas,
        'Nenhum produto cadastrado.'
    );

    // Preenche tanto o seletor de entrada quanto o seletor de saída
    ['produto-entrada', 'produto-saida'].forEach((idSeletor) => {
        const seletor = $(idSeletor);

        if (seletor) {
            const valorAnterior = seletor.value;

            seletor.innerHTML = `
                <option value="">Selecione um produto</option>
                ${produtos.map((p) => `
                    <option value="${escapar(p.id)}">
                        ${escapar(p.nome)} (ID${escapar(p.id)})
                    </option>
                `).join('')}
            `;

            if (produtos.some((p) => String(p.id) === valorAnterior)) {
                seletor.value = valorAnterior;
            }
        }
    });

    if ($('total-produtos')) {$('total-produtos').textContent = numero(produtos.length);
    }

    if ($('total-unidades')) {$('total-unidades').textContent = numero(
            produtos.reduce((soma, p) => soma + Number(p.quantidade || 0), 0)
        );
    }

    if ($('valor-estoque')) {$('valor-estoque').textContent = moeda(
            produtos.reduce(
                (soma, p) => soma + Number(p.quantidade || 0) * Number(p.valor || 0),
                0
            )
        );
    }

    if ($('total-alertas')) {$('total-alertas').textContent = numero(
            produtos.filter((p) =>
                Number(p.quantidade) <= 0 || Number(p.quantidade) >= 100
            ).length
        );
    }
}

async function carregarProdutos() {
    try {
        const dados = await requisicao('/');

        if (!Array.isArray(dados)) {
            throw new Error('O formato da lista de produtos é inválido.');
        }

        produtos = dados;
        renderizarProdutos();
    } catch (erro) {
        mostrarMensagem('tabela-produtos', erro.message, true);
        mostrarMensagem('tabela-dashboard', erro.message, true);
        console.error('Erro ao carregar produtos:', erro);
    }
}

// Navegação entre as páginas
document.querySelectorAll('.nav-btn[data-page]').forEach((botao) => {
    botao.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach((item) => {
            item.classList.remove('active');
        });

        document.querySelectorAll('.page').forEach((pagina) => {
            pagina.classList.remove('active');
        });

        botao.classList.add('active');

        const pagina = $(botao.dataset.page);

        if (pagina) {
            pagina.classList.add('active');
        }

        const titulo = $('titulo-pagina');

        if (titulo) {
            titulo.textContent = botao.textContent.replace(/^[^\wÀ-ÿ]+/, '').trim();
        }

        if (botao.dataset.page === 'saidas') carregarSaidas();
        if (botao.dataset.page === 'relatorios') carregarValores();
        if (botao.dataset.page === 'limites') carregarLimites();
    });
});

// Pesquisar produtos
$('pesquisa-produto')?.addEventListener('input', (evento) => {
    const termo = evento.target.value.toLocaleLowerCase('pt-BR');

    renderizarProdutos(produtos.filter((p) =>
        String(p.nome ?? '').toLocaleLowerCase('pt-BR').includes(termo) ||
        String(p.categoria ?? '').toLocaleLowerCase('pt-BR').includes(termo) ||
        String(p.id ?? '').includes(termo)
    ));
});

// Cadastrar produto
$('cadastro-form')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const form = evento.currentTarget;
    const dados = new FormData(form);

    const nome = String(dados.get('nome') || '').trim();
    const categoria = String(dados.get('categoria') || '').trim();
    const quantidade = Number(dados.get('quantidade'));
    const valor = Number(dados.get('valor'));
    
    // Tenta obter 'unidade_medida' ou 'unidade' do formulário. Se não houver, atribui 'un'
    const campoUnidade = dados.get('unidade_medida') || dados.get('unidade');
    const unidade_medida = (campoUnidade && String(campoUnidade).trim()) 
        ? String(campoUnidade).trim() 
        : 'un';

    const produto = {
        nome,
        categoria,
        quantidade,
        valor,
        unidade_medida
    };

    // Validação estrita: exige quantidade e valor maiores que 0
    if (!produto.nome || !produto.categoria || !produto.unidade_medida ||
        produto.quantidade <= 0 || !Number.isFinite(produto.quantidade) ||
        produto.valor <= 0 || !Number.isFinite(produto.valor)) {
        alert('Confira os dados. Preencha todos os campos e certifique-se de que a quantidade e o valor são maiores que zero.');
        return;
    }

    try {
        const resultado = await requisicao('/cadastrar', {
            method: 'POST',
            body: JSON.stringify(produto)
        });

        alert(resultado?.message || 'Produto cadastrado com sucesso!');
        form.reset();
        await carregarProdutos();
    } catch (erro) {
        alert(erro.message);
        console.error(erro);
    }
});

// Registrar entrada de estoque
$('entrada-form')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const form = evento.currentTarget;
    const id = Number($('produto-entrada')?.value);
    const quantidade = Number($('quantidade-entrada')?.value);

    if (!id || !Number.isFinite(quantidade) || quantidade <= 0) {
        alert('Selecione um produto e informe uma quantidade maior que zero.');
        return;
    }

    try {
        const resultado = await requisicao('/entrada', {
            method: 'POST',
            body: JSON.stringify({ id, quantidade })
        });

        alert(resultado?.message || 'Entrada registrada com sucesso!');
        form.reset();
        await carregarProdutos();
    } catch (erro) {
        alert(erro.message);
        console.error(erro);
    }
});

// Registrar saída de estoque
$('saida-form')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const form = evento.currentTarget;
    const id = Number($('produto-saida')?.value);
    const quantidade = Number($('quantidade-saida')?.value);
    const observacao = $('motivo-saida')?.value || '';

    if (!id || !Number.isFinite(quantidade) || quantidade <= 0) {
        alert('Selecione um produto e informe uma quantidade maior que zero.');
        return;
    }

    try {
        const resultado = await requisicao('/saida', {
            method: 'POST',
            body: JSON.stringify({ id, quantidade, observacao })
        });

        alert(resultado?.message || 'Saída registrada com sucesso!');
        form.reset();
        await carregarProdutos();
        await carregarSaidas();
    } catch (erro) {
        alert(erro.message);
        console.error(erro);
    }
});

// Valor do estoque agrupado por categoria
async function carregarValores() {
    try {
        const dados = await requisicao('/valor-total');

        preencherTabela(
            'tabela-valores',
            dados,
            [
                (p) => escapar(p.categoria),
                () => '—',
                () => '—',
                (p) => moeda(p.valor_total)
            ],
            'Nenhum valor disponível.'
        );
    } catch (erro) {
        mostrarMensagem('tabela-valores', erro.message, true);
    }
}

// Saídas registradas no banco
async function carregarSaidas() {
    try {
        const dados = await requisicao('/saidas');

        preencherTabela(
            'tabela-saidas',
            dados,
            [
                (m) => escapar(
                    produtos.find((p) => Number(p.id) === Number(m.produtos_id))?.nome
                    || `Produto ID ${m.produtos_id ?? 'não informado'}`
                ),
                (m) => numero(m.quantidade),
                (m) => escapar(m.data_movimentacao),
                (m) => escapar(m.descricao ?? m.observacao ?? '—')
            ],
            'Nenhuma saída registrada.'
        );
    } catch (erro) {
        mostrarMensagem('tabela-saidas', erro.message, true);
    }
}

// Limites de estoque
async function carregarLimites() {
    try {
        const dados = await requisicao('/limites');

        preencherTabela(
            'tabela-limites',
            dados,
            [
                (p) => escapar(p.nome),
                (p) => numero(p.quantidade),
                () => '0 ou 100 unidades',
                (p) => `<span class="status">${
                    Number(p.quantidade) <= 0
                        ? 'Sem estoque'
                        : 'Limite atingido'
                }</span>`
            ],
            'Nenhum produto nos limites definidos.'
        );
    } catch (erro) {
        mostrarMensagem('tabela-limites', erro.message, true);
    }
}

// Consultar movimentações por período
$('movimentacoes-form')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const inicial = $('data-inicial').value;
    const final = $('data-final').value;

    if (inicial > final) {
        alert('A data inicial não pode ser posterior à data final.');
        return;
    }

    try {
        const query = new URLSearchParams({
            data_inicial: inicial,
            data_final: final
        });

        const dados = await requisicao(`/movimentacoes?${query}`);

        preencherTabela(
            'tabela-movimentacoes',
            dados,
            [
                (m) => escapar(m.nome_do_produto),
                (m) => `Entradas: ${numero(m.total_de_entradas)}<br>Saídas: ${numero(m.total_de_saidas)}`,
                (m) => numero(m.saldo_no_periodo),
                (m) => `Entradas: ${moeda(m.valor_total_financeiro_das_entradas)}<br>Saídas: ${moeda(m.valor_total_financeiro_das_saidas)}`
            ],
            'Nenhuma movimentação encontrada nesse período.'
        );
    } catch (erro) {
        mostrarMensagem('tabela-movimentacoes', erro.message, true);
    }
});

// Produtos com maiores saídas
$('maiores-saidas-form')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const inicial = $('saidas-data-inicial').value;
    const final = $('saidas-data-final').value;

    if (inicial > final) {
        alert('A data inicial não pode ser posterior à data final.');
        return;
    }

    try {
        const query = new URLSearchParams({
            data_inicial: inicial,
            data_final: final
        });

        const dados = await requisicao(`/maiores-saidas?${query}`);

        preencherTabela(
            'tabela-maiores-saidas',
            dados,
            [
                (p) => escapar(p.nome_do_produto),
                (p) => `${numero(p.quantidade_total_de_saidas)} unidades — ${moeda(p.valor_total_financeiro_das_saidas)}`
            ],
            'Nenhuma saída encontrada nesse período.'
        );
    } catch (erro) {
        mostrarMensagem('tabela-maiores-saidas', erro.message, true);
    }
});

// Inicialização do site
carregarProdutos();