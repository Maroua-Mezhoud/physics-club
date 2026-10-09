
"use strict";

// ============================================
// 1. GET THE HTML ELEMENTS
// ============================================

const energySelect = document.getElementById("energy-level");

const energyValue = document.getElementById("energy-value");
const wavefunctionValue = document.getElementById("wavefunction-value");
const graphContainer = document.getElementById("quantum-graph");

// ============================================
// 2. HERMITE POLYNOMIALS
// ============================================

// Physicists' Hermite polynomials:
//
// H0(x) = 1
// H1(x) = 2x
// H(n+1)(x) = 2x Hn(x) - 2n H(n-1)(x)

function hermite(n, x) {

    if (n === 0) return 1;
    if (n === 1) return 2 * x;

    let previous = 1;
    let current = 2 * x;

    for (let k = 1; k < n; k++) {

        const next =
            2 * x * current -
            2 * k * previous;

        previous = current;
        current = next;
    }

    return current;
}

// ============================================
// 3. FACTORIAL
// ============================================

function factorial(n) {

    let result = 1;

    for (let k = 2; k <= n; k++) {
        result *= k;
    }

    return result;
}

// ============================================
// 4. NORMALIZED WAVEFUNCTION
// ============================================

// Dimensionless coordinate:
// xi = x / x0
//
// We plot sqrt(x0) * psi_n(x), which is normalized
// with respect to the dimensionless coordinate xi.

function wavefunction(n, xi) {

    const normalization =
        Math.pow(Math.PI, 0.25) *
        Math.sqrt(Math.pow(2, n) * factorial(n));

    return (
        hermite(n, xi) *
        Math.exp(-xi * xi / 2)
    ) / normalization;
}

// ============================================
// 5. CREATE THE POSITION VALUES
// ============================================

const xValues = [];

for (let i = 0; i <= 500; i++) {

    const x = -5 + (10 * i / 500);

    xValues.push(x);
}

// ============================================
// 6. GRAPH 1: WAVEFUNCTION
// ============================================

function drawWavefunction(n) {

    const yValues = xValues.map(
        x => wavefunction(n, x)
    );

    Plotly.react(
        "wavefunction-graph",
        [{
            x: xValues,
            y: yValues,
            type: "scatter",
            mode: "lines",

            name: "ψₙ(x)",

            line: {
                color: "#60a5fa",
                width: 3
            },

            hovertemplate:
                "x/x₀ = %{x:.3f}<br>" +
                "ψ = %{y:.5f}<extra></extra>"
        }],
        {
            ...commonLayout,

            yaxis: {
                ...commonLayout.yaxis,
                title: "√x₀ · ψₙ(x)"
            }
        },
        plotConfig
    );
}

// ============================================
// 7. GRAPH 2: PROBABILITY DENSITY
// ============================================

function drawProbability(n) {

    const probabilityValues = xValues.map(x => {

        const psi = wavefunction(n, x);

        return psi * psi;
    });

    Plotly.react(
        "probability-graph",
        [{
            x: xValues,
            y: probabilityValues,

            type: "scatter",
            mode: "lines",

            name: "|ψₙ(x)|²",

            line: {
                color: "#a78bfa",
                width: 3
            },

            fill: "tozeroy",
            fillcolor: "rgba(167,139,250,0.16)",

            hovertemplate:
                "x/x₀ = %{x:.3f}<br>" +
                "Probability density = %{y:.5f}<extra></extra>"
        }],
        {
            ...commonLayout,

            yaxis: {
                ...commonLayout.yaxis,
                title: "x₀ · |ψₙ(x)|²",
                rangemode: "tozero"
            }
        },
        plotConfig
    );
}

// ============================================
// 8. GRAPH 3: POTENTIAL AND ENERGY LEVEL
// ============================================

function drawEnergy(n) {

    // Dimensionless potential:
    // V / (hbar * omega) = x^2 / 2

    const potentialValues = xValues.map(
        x => 0.5 * x * x
    );

    // Quantized energy:
    // E_n / (hbar * omega) = n + 1/2

    const energy = n + 0.5;

    Plotly.react(
        "energy-graph",
        [
            {
                x: xValues,
                y: potentialValues,

                type: "scatter",
                mode: "lines",

                name: "V(x) = x²/2",

                line: {
                    color: "#60a5fa",
                    width: 3
                }
            },

            {
                x: [-5, 5],
                y: [energy, energy],

                type: "scatter",
                mode: "lines",

                name: `Eₙ = ${energy} ℏω`,

                line: {
                    color: "#a78bfa",
                    width: 2,
                    dash: "dash"
                }
            }
        ],
        {
            ...commonLayout,

            yaxis: {
                ...commonLayout.yaxis,
                title: "Energy / ℏω",
                range: [0, Math.max(5.5, energy + 1)]
            }
        },
        plotConfig
    );
}

// ============================================
// 9. SHARED GRAPH STYLE
// ============================================

const commonLayout = {

    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",

    font: {
        family: "Inter, sans-serif",
        color: "#a5b4d8",
        size: 11
    },

    margin: {
        l: 55,
        r: 20,
        t: 30,
        b: 50
    },

    xaxis: {
        title: "Dimensionless position x/x₀",
        gridcolor: "rgba(148,163,255,0.13)",
        zerolinecolor: "rgba(148,163,255,0.2)"
    },

    yaxis: {
        gridcolor: "rgba(148,163,255,0.13)",
        zerolinecolor: "rgba(148,163,255,0.2)"
    },

    legend: {
        orientation: "h",
        x: 0,
        y: 1.15
    }
};

const plotConfig = {
    responsive: true,
    displaylogo: false
};

// ============================================
// 10. UPDATE THE SIMULATION
// ============================================

function updateSimulation() {

    const n = Number(energySelect.value);

    // Energy eigenvalue
    const energy = n + 0.5;

    energyValue.textContent =
        `E${["₀","₁","₂","₃","₄","₅"][n]} = ${energy} ℏω`;

    wavefunctionValue.textContent =
        `ψ${["₀","₁","₂","₃","₄","₅"][n]}(x)`;

    // Draw the three graphs
    drawWavefunction(n);
    drawProbability(n);
    drawEnergy(n);
}

// ============================================
// 11. LISTEN FOR USER INPUT
// ============================================

energySelect.addEventListener(
    "change",
    updateSimulation
);

// ============================================
// 12. START
// ============================================

if (window.Plotly) {

    // Replace the placeholder with the three graph areas.
    graphContainer.innerHTML = `
        <div class="graph-grid">

            <article class="graph-card">
                <h3>Wavefunction ψₙ(x)</h3>
                <div id="wavefunction-graph" class="plot"></div>
            </article>

            <article class="graph-card">
                <h3>Probability density |ψₙ(x)|²</h3>
                <div id="probability-graph" class="plot"></div>
            </article>

            <article class="graph-card graph-wide">
                <h3>Potential V(x) and energy Eₙ</h3>
                <div id="energy-graph" class="plot"></div>
            </article>

        </div>
    `;

    updateSimulation();

} else {

    graphContainer.textContent =
        "Plotly could not load. Please check your internet connection.";
}
