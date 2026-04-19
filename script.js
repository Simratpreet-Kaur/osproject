// Interactive Starfield Background
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let stars = [];

function initStars() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = [];
    for (let i = 0; i < 150; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.1
        });
    }
}

function animateStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        star.y += star.speed;
        if (star.y > canvas.height) star.y = 0;
    });
    requestAnimationFrame(animateStars);
}

window.addEventListener('resize', initStars);
initStars();
animateStars();

// Constants & UI Elements
const btnStart = document.getElementById('btn-start');
const btnCompare = document.getElementById('btn-compare');
const btnRandom = document.getElementById('btn-random');
const simSection = document.getElementById('simulation-section');
const compSection = document.getElementById('comparison-section');
const simOutput = document.getElementById('sim-output');
const simSpeed = document.getElementById('sim-speed');
const speedVal = document.getElementById('speed-val');
const badge = document.getElementById('sim-status-badge');

let chartInstance = null;
let currentTimeout = null;

// Initialization
simSpeed.addEventListener('input', () => {
    const val = parseInt(simSpeed.value);
    speedVal.innerText = val > 700 ? 'Slow' : val > 400 ? 'Normal' : 'Fast';
});

btnStart.addEventListener('click', startSimulation);
btnCompare.addEventListener('click', compareAll);
btnRandom.addEventListener('click', generateRandomString);

// --- Core Algorithms ---

function getFIFO(frames, sequence) {
    let memory = [];
    let steps = [];
    let faults = 0;
    let hits = 0;

    sequence.forEach((page) => {
        let isFault = false;
        let changeAt = -1;
        if (!memory.includes(page)) {
            isFault = true;
            faults++;
            if (memory.length < frames) {
                memory.push(page);
                changeAt = memory.length - 1;
            } else {
                memory.shift();
                memory.push(page);
                changeAt = frames - 1;
            }
        } else {
            hits++;
        }
        steps.push({ page, memory: [...memory], isFault, changeAt });
    });
    return { steps, faults, hits };
}

function getLRU(frames, sequence) {
    let memory = [];
    let steps = [];
    let faults = 0;
    let hits = 0;
    let usage = [];

    sequence.forEach((page) => {
        let isFault = false;
        let changeAt = -1;
        const index = memory.indexOf(page);

        if (index === -1) {
            isFault = true;
            faults++;
            if (memory.length < frames) {
                memory.push(page);
                usage.push(page);
                changeAt = memory.length - 1;
            } else {
                const lruPage = usage.shift();
                const memIndex = memory.indexOf(lruPage);
                memory[memIndex] = page;
                usage.push(page);
                changeAt = memIndex;
            }
        } else {
            hits++;
            usage.splice(usage.indexOf(page), 1);
            usage.push(page);
        }
        steps.push({ page, memory: [...memory], isFault, changeAt });
    });
    return { steps, faults, hits };
}

function getOptimal(frames, sequence) {
    let memory = [];
    let steps = [];
    let faults = 0;
    let hits = 0;

    sequence.forEach((page, i) => {
        let isFault = false;
        let changeAt = -1;
        if (!memory.includes(page)) {
            isFault = true;
            faults++;
            if (memory.length < frames) {
                memory.push(page);
                changeAt = memory.length - 1;
            } else {
                let farthest = i;
                let replaceIndex = 0;
                for (let j = 0; j < memory.length; j++) {
                    let nextUse = -1;
                    for (let k = i + 1; k < sequence.length; k++) {
                        if (memory[j] === sequence[k]) {
                            nextUse = k;
                            break;
                        }
                    }
                    if (nextUse === -1) { replaceIndex = j; break; }
                    if (nextUse > farthest) { farthest = nextUse; replaceIndex = j; }
                }
                memory[replaceIndex] = page;
                changeAt = replaceIndex;
            }
        } else {
            hits++;
        }
        steps.push({ page, memory: [...memory], isFault, changeAt });
    });
    return { steps, faults, hits };
}

// --- UI Orchestration ---

async function startSimulation() {
    clearTimeout(currentTimeout);
    const { frames, sequence, algorithm } = getInputs();
    if (!sequence.length) return alert('Enter a page sequence.');

    let result;
    if (algorithm === 'FIFO') result = getFIFO(frames, sequence);
    else if (algorithm === 'LRU') result = getLRU(frames, sequence);
    else result = getOptimal(frames, sequence);

    document.getElementById('sim-title').innerText = `${algorithm} Analysis`;
    simSection.style.display = 'block';
    compSection.style.display = 'none';
    badge.innerText = 'PREPARING';
    badge.style.background = 'rgba(99, 102, 241, 0.1)';

    simOutput.innerHTML = '<div class="step-grid" id="grid-container"></div>';
    const grid = document.getElementById('grid-container');

    const delay = parseInt(simSpeed.value);
    
    // Sequential Animation
    for (let i = 0; i < result.steps.length; i++) {
        badge.innerText = `PROCESSING STEP ${i + 1}/${result.steps.length}`;
        const step = result.steps[i];
        const col = createStepColumn(step, frames);
        grid.appendChild(col);
        
        // Auto scroll to latest step
        simOutput.scrollLeft = simOutput.scrollWidth;

        await new Promise(r => { currentTimeout = setTimeout(r, delay); });
        col.classList.add('step-visible');
        
        // Highlight logic
        if (step.changeAt !== -1) {
            const framesElems = col.querySelectorAll('.frame');
            framesElems[step.changeAt].classList.add('active-change');
        }

        updateStatsPartial(result, i + 1, sequence.length);
    }

    badge.innerText = 'COMPLETED';
    badge.style.background = 'rgba(16, 185, 129, 0.2)';
    badge.style.color = '#10b981';
}

function createStepColumn(step, maxFrames) {
    const col = document.createElement('div');
    col.className = 'step-column';

    const pageNum = document.createElement('div');
    pageNum.className = 'page-num';
    pageNum.innerText = step.page;
    col.appendChild(pageNum);

    for (let f = 0; f < maxFrames; f++) {
        const frame = document.createElement('div');
        frame.className = 'frame';
        frame.innerText = step.memory[f] !== undefined ? step.memory[f] : '-';
        col.appendChild(frame);
    }

    const status = document.createElement('div');
    status.className = `status ${step.isFault ? 'fault' : 'hit'}`;
    status.innerText = step.isFault ? 'MISS' : 'HIT';
    col.appendChild(status);

    return col;
}

function updateStatsPartial(fullResult, currentStepIdx, total) {
    // Calculate stats based on progress
    const stepsSoFar = fullResult.steps.slice(0, currentStepIdx);
    const hits = stepsSoFar.filter(s => !s.isFault).length;
    const faults = stepsSoFar.filter(s => s.isFault).length;

    document.getElementById('stat-hits').innerText = hits;
    document.getElementById('stat-faults').innerText = faults;
    document.getElementById('stat-hit-ratio').innerText = ((hits / currentStepIdx) * 100).toFixed(0) + '%';
    document.getElementById('stat-fault-ratio').innerText = ((hits / total) * 100).toFixed(0) + '%';
}

function compareAll() {
    const { frames, sequence } = getInputs();
    if (!sequence.length) return alert('Enter a page sequence.');

    const fifo = getFIFO(frames, sequence);
    const lru = getLRU(frames, sequence);
    const optimal = getOptimal(frames, sequence);

    simSection.style.display = 'none';
    compSection.style.display = 'block';
    
    // Find winner
    const results = [
        { name: 'FIFO', faults: fifo.faults },
        { name: 'LRU', faults: lru.faults },
        { name: 'Optimal', faults: optimal.faults }
    ].sort((a, b) => a.faults - b.faults);

    const winner = results[0].name;
    document.getElementById('winner-announcement').innerHTML = `<span class="winner-tag">🏆 ${winner} WINNER</span>`;

    renderChart(fifo, lru, optimal);
}

function renderChart(fifo, lru, optimal) {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    const total = fifo.hits + fifo.faults;

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['FIFO', 'LRU', 'Optimal Strategy'],
            datasets: [
                {
                    label: 'Page Faults (Misses)',
                    data: [fifo.faults, lru.faults, optimal.faults],
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderRadius: 6
                },
                {
                    label: 'Page Hits',
                    data: [fifo.hits, lru.hits, optimal.hits],
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { stacked: true, max: total, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8' } }
            },
            plugins: {
                legend: { position: 'bottom', labels: { color: '#f8fafc', padding: 20 } }
            }
        }
    });
}

function getInputs() {
    const frames = parseInt(document.getElementById('frames').value) || 3;
    const stringVal = document.getElementById('reference-string').value;
    const sequence = stringVal.split(',').map(s => s.trim()).filter(s => s !== '').map(Number);
    const algorithm = document.getElementById('algorithm').value;
    return { frames, sequence, algorithm };
}

function generateRandomString() {
    const length = 10 + Math.floor(Math.random() * 5);
    const random = Array.from({ length }, () => Math.floor(Math.random() * 10)).join(', ');
    document.getElementById('reference-string').value = random;
}
