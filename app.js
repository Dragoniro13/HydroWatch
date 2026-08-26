// Configuração do Chart.js para o modo escuro
if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.borderColor = '#1f2937';
}

// Configuração da API do ThingSpeak
const channelID = "3469733";
const urlThingSpeak = "https://api.thingspeak.com/channels/3469733/fields/1/last.json";

// REGRA: Nível abaixo de 50.0 cm entra em ALERTA
const LIMITE_ALERTA = 4.0;

// Banco de dados dos piezômetros (valores em centímetros ajustados para maquete/protótipo)
let listaPiezometros = [
    { id: 'PZ-01', local: 'Montante (Barragem A)', nivel: 0.0, status: 'Alerta', historico: [0, 0, 0, 0, 0, 0] },
    { id: 'PZ-02', local: 'Jusante (Barragem A)', nivel: 32.0, status: 'Operacional', historico: [10, 21, 8, 13, 24, 32] },
    { id: 'PZ-03', local: 'Talude Central', nivel: 3.0, status: 'Alerta', historico: [28, 20, 11, 10, 5, 3] },
    { id: 'PZ-04', local: 'Base Principal', nivel: 5.0, status: 'Operacional', historico: [45, 56, 38, 59, 20, 5] },
    { id: 'PZ-05', local: 'Setor Norte', nivel: 0.0, status: 'Manutenção', historico: [0, 0, 0, 0, 0, 0] }
];

let graficoLinhasInstancia = null;
let graficoPizzaInstancia = null;

// Função para obter data/hora atual formatada
function obterDataHoraAtual() {
    return new Date().toLocaleString('pt-BR');
}

// Avalia automaticamente o status de qualquer piezômetro com base no nível
function calcularStatus(piezometro) {
    if (piezometro.status === 'Manutenção') return 'Manutenção';
    return piezometro.nivel < LIMITE_ALERTA ? 'Alerta' : 'Operacional';
}

// Função de Navegação entre Abas
function navegar(paginaId, botao) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const secao = document.getElementById(paginaId);
    if (secao) secao.classList.add('active');
    if (botao) botao.classList.add('active');
}

// Atualiza toda a interface (Cards, Tabelas, Badges e Gráficos)
function atualizarInterfaceCompleta() {
    const dataHoraAtual = obterDataHoraAtual();

    // 1. Recalcula o status de todos os piezômetros com base no nível
    listaPiezometros.forEach(pz => {
        pz.status = calcularStatus(pz);
    });

    // 2. Atualiza Cards Superiores do Dashboard
    const totalEl = document.getElementById('card-total-piezometros');
    if (totalEl) totalEl.innerText = listaPiezometros.length;

    const criticos = listaPiezometros.filter(p => p.status === 'Alerta').length;
    const criticosEl = document.getElementById('card-criticos-piezometros');
    if (criticosEl) criticosEl.innerText = criticos;

    const ativos = listaPiezometros.filter(p => p.status !== 'Manutenção');
    const soma = ativos.reduce((acc, p) => acc + p.nivel, 0);
    const media = ativos.length > 0 ? (soma / ativos.length).toFixed(1) : '0.0';
    const mediaEl = document.getElementById('card-media-nivel');
    if (mediaEl) mediaEl.innerText = `${media} cm`;

    // 3. Renderiza a aba Piezômetros
    const containerPz = document.getElementById('container-piezometros');
    if (containerPz) {
        containerPz.innerHTML = '';
        listaPiezometros.forEach(pz => {
            const badgeClass = pz.status === 'Alerta' ? 'badge-danger' : (pz.status === 'Manutenção' ? 'badge-warning' : 'badge-success');
            containerPz.innerHTML += `
                <div class="card pz-card">
                    <div class="pz-header">
                        <h3 style="color: #ffffff;">${pz.id}</h3>
                        <span id="badge-${pz.id}" class="badge ${badgeClass}">${pz.status}</span>
                    </div>
                    <p><strong>Local:</strong> ${pz.local}</p>
                    <p><strong>Nível:</strong> <span id="val-${pz.id}">${pz.status === 'Manutenção' ? '--' : pz.nivel.toFixed(1) + ' cm'}</span></p>
                    <p style="font-size: 0.75rem; color: #6b7280; margin-top: 8px;"><strong>Última Leitura:</strong> <span>${dataHoraAtual}</span></p>
                </div>`;
        });
    }

    // 4. Renderiza a Tabela de Relatórios
    const tabela = document.getElementById('tabela-relatorios');
    if (tabela) {
        tabela.innerHTML = '';
        listaPiezometros.forEach(pz => {
            const badgeClass = pz.status === 'Alerta' ? 'badge-danger' : (pz.status === 'Manutenção' ? 'badge-warning' : 'badge-success');
            tabela.innerHTML += `
                <tr>
                    <td>${dataHoraAtual}</td>
                    <td><strong>${pz.id}</strong></td>
                    <td>${pz.local}</td>
                    <td><span id="tab-${pz.id}">${pz.status === 'Manutenção' ? '--' : pz.nivel.toFixed(1) + ' cm'}</span></td>
                    <td><span class="badge ${badgeClass}">${pz.status}</span></td>
                </tr>`;
        });
    }

    // 5. Atualiza os gráficos
    atualizarGraficos();
}

function inicializarGraficos() {
    if (typeof Chart === 'undefined') return;

    const canvasLinha = document.getElementById('graficoComparativo');
    if (canvasLinha) {
        const ctxLinha = canvasLinha.getContext('2d');
        graficoLinhasInstancia = new Chart(ctxLinha, {
            type: 'line',
            data: {
                labels: ['08:00', '08:30', '09:00', '09:30', '10:00', 'Agora'],
                datasets: listaPiezometros.filter(p => p.status !== 'Manutenção').map((p, i) => ({
                    label: `${p.id} (${p.local})`,
                    data: p.historico,
                    borderColor: ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6'][i % 5],
                    backgroundColor: 'transparent',
                    tension: 0.3
                }))
            },
            options: { responsive: true, animation: false }
        });
    }

    const canvasPizza = document.getElementById('graficoPizza');
    if (canvasPizza) {
        const ctxPizza = canvasPizza.getContext('2d');
        graficoPizzaInstancia = new Chart(ctxPizza, {
            type: 'doughnut',
            data: {
                labels: ['Operacionais', 'Alerta / Crítico', 'Em Manutenção'],
                datasets: [{
                    data: [
                        listaPiezometros.filter(p => p.status === 'Operacional').length,
                        listaPiezometros.filter(p => p.status === 'Alerta').length,
                        listaPiezometros.filter(p => p.status === 'Manutenção').length
                    ],
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, animation: false }
        });
    }
}

function atualizarGraficos() {
    if (graficoLinhasInstancia) {
        const ativos = listaPiezometros.filter(p => p.status !== 'Manutenção');
        ativos.forEach((pz, idx) => {
            if (graficoLinhasInstancia.data.datasets[idx]) {
                graficoLinhasInstancia.data.datasets[idx].data[5] = pz.nivel;
            }
        });
        graficoLinhasInstancia.update('none');
    }

    if (graficoPizzaInstancia) {
        graficoPizzaInstancia.data.datasets[0].data = [
            listaPiezometros.filter(p => p.status === 'Operacional').length,
            listaPiezometros.filter(p => p.status === 'Alerta').length,
            listaPiezometros.filter(p => p.status === 'Manutenção').length
        ];
        graficoPizzaInstancia.update('none');
    }
}

// Lê os dados diretamente da API do ThingSpeak (em centímetros)
async function lerDadosDoSensor() {
    try {
        const resposta = await fetch(urlThingSpeak);
        const dados = await resposta.json();
        
        if (dados && dados.field1 !== undefined && dados.field1 !== null) {
            const novoNivel = parseFloat(dados.field1);

            if (!isNaN(novoNivel)) {
                // Pega o valor exatamente como veio do ThingSpeak (em cm)
                listaPiezometros[0].nivel = novoNivel;
                listaPiezometros[0].historico[5] = novoNivel;

                // Recalcula o status e atualiza toda a interface
                atualizarInterfaceCompleta();
            }
        }
    } catch (erro) {
        console.error("Aguardando próxima atualização do ThingSpeak...", erro);
    }
}

// Inicialização ao carregar a página
window.onload = function() {
    inicializarGraficos();
    atualizarInterfaceCompleta();

    // Consulta imediata e depois a cada 15 segundos
    lerDadosDoSensor();
    setInterval(lerDadosDoSensor, 15000);

    // Evento de cadastro manual de novos piezômetros
    const formCadastrar = document.getElementById('form-cadastrar');
    if (formCadastrar) {
        formCadastrar.addEventListener('submit', function(e) {
            e.preventDefault();

            const nome = document.getElementById('input-nome').value.trim();
            const local = document.getElementById('input-local').value.trim();
            const nivel = parseFloat(document.getElementById('input-nivel').value);
            const statusInicial = document.getElementById('input-status').value;

            if (nome && local && !isNaN(nivel)) {
                const novoPz = {
                    id: nome,
                    local: local,
                    nivel: nivel,
                    status: statusInicial,
                    historico: [nivel, nivel, nivel, nivel, nivel, nivel]
                };

                listaPiezometros.push(novoPz);

                // Reinicia gráficos e atualiza interface
                if (graficoLinhasInstancia) graficoLinhasInstancia.destroy();
                if (graficoPizzaInstancia) graficoPizzaInstancia.destroy();
                inicializarGraficos();

                atualizarInterfaceCompleta();
                formCadastrar.reset();
            }
        });
    }
};
