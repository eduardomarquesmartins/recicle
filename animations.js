const canvas = document.getElementById('tree-canvas');
const ctx = canvas ? canvas.getContext('2d', { alpha: true }) : null;

let W, H;
let root;
let windParticles = [];
let mouseX = 0;
let smoothedMouseX = 0;
let globalWind = 0.4;
let gust = 0;
let targetGust = 0;
let treeReadiness = 0;
let isVisible = !!canvas;
let frameCount = 0;

// Pre-computed branch colors (avoid hsl() string per frame)
const BRANCH_COLORS = [0,1,2,3,4,5,6,7].map(d => {
    const l = 20 + d * 4;
    return `hsl(145,40%,${l}%)`;
});

if (canvas) {
    const observer = new IntersectionObserver((entries) => {
        isVisible = entries[0].isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(canvas.parentElement);

    window.addEventListener('mousemove', e => {
        mouseX = (e.clientX / window.innerWidth) - 0.5;
    }, { passive: true });
}

function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = canvas.width = window.innerWidth;
    H = canvas.height = rect.height;
    reset();
}
window.addEventListener('resize', resize, { passive: true });

class WindParticle {
    constructor() {
        this.reset();
        this.x = Math.random() * W;
    }
    reset() {
        this.x = W + 100;
        this.y = Math.random() * H;
        this.size = 1.5 + Math.random() * 4;
        this.speed = 0.8 + Math.random() * 2;
        this.angle = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 0.15;
        this.color = ['#2d6a4f', '#44775a', '#b1f0ce'][Math.floor(Math.random() * 3)];
        this.type = Math.random() > 0.4 ? 'leaf' : 'streak';
        this.streakLen = 50 + Math.random() * 150;
    }
    update(currentWind) {
        this.x -= (this.speed + currentWind * 8);
        this.y += Math.sin(this.x * 0.01) * 0.8;
        this.angle += this.spin;
        if (this.x < -200) this.reset();
    }
    draw(time) {
        if (this.type === 'leaf') {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.beginPath();
            ctx.ellipse(0, 0, this.size, this.size * 2, 0, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = 0.6;
            ctx.fill();
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(45,106,79,0.7)';
            const sLen = this.streakLen / 6;
            for (let i = 0; i <= 6; i++) {
                const sx = this.x + i * sLen;
                const sy = this.y + Math.sin(sx * 0.02 + time * 0.002) * 20;
                i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
            }
            ctx.stroke();
        }
    }
}

class Branch {
    constructor(parent, x, y, angle, length, thickness, depth) {
        this.parent = parent;
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.length = length;
        this.thickness = thickness;
        this.depth = depth;
        this.p = 0;
        this.finished = false;
        this.seed = Math.random() * 1000;
        this.children = [];
        this.leaves = [];
        this.sway = 0;
        this.swayVel = 0;
        this.color = BRANCH_COLORS[Math.min(depth, 7)];
    }

    draw(time, currentWind) {
        const growSpeed = 0.006 + (7 - this.depth) * 0.002;
        if (this.p < 1) {
            this.p = Math.min(1, this.p + growSpeed);
            if (this.p >= 1 && !this.finished) {
                this.finished = true;
                this.spawn();
            }
        }

        const stiffness = 0.008 + (7 - this.depth) * 0.01;
        const dampening = 0.94;

        if (this.finished && treeReadiness >= 0.5) {
            const windScale = Math.max(0, (treeReadiness - 0.5) * 2);
            const windForce = Math.sin(time * 0.0006 + this.seed) * (this.depth + 1) * 0.022 * currentWind * windScale;
            const accel = ((windForce * 5) - this.sway) * stiffness;
            this.swayVel = (this.swayVel + accel) * dampening;
            this.sway += this.swayVel;
            // Limita o balanço máximo por profundidade
            const maxSway = 0.08 + this.depth * 0.04;
            this.sway = Math.max(-maxSway, Math.min(maxSway, this.sway));
        } else {
            this.sway = 0;
            this.swayVel = 0;
        }

        const curAngle = this.angle + this.sway;
        const curL = this.length * this.p;
        const tx = Math.sin(curAngle) * curL;
        const ty = -Math.cos(curAngle) * curL;
        const w1 = this.thickness;
        const w2 = this.thickness * (1 - this.p * 0.4);

        if (w2 < 0.5 && this.depth > 5) return;

        const nx = Math.cos(curAngle);
        const ny = Math.sin(curAngle);

        ctx.fillStyle = this.color;
        ctx.save();
        ctx.translate(this.x, this.y);

        // Merge arc + trapezoid into one path to reduce draw calls
        ctx.beginPath();
        ctx.moveTo(-nx * w1, -ny * w1);
        ctx.lineTo(tx - nx * w2, ty - ny * w2);
        ctx.lineTo(tx + nx * w2, ty + ny * w2);
        ctx.lineTo(nx * w1, ny * w1);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        const tipX = this.x + tx;
        const tipY = this.y + ty;

        for (let i = 0; i < this.children.length; i++) {
            this.children[i].x = tipX;
            this.children[i].y = tipY;
            this.children[i].draw(time, currentWind);
        }

        if (this.finished && this.depth > 2) {
            if (this.leaves.length === 0) this.initLeaves();
            for (let i = 0; i < this.leaves.length; i++) {
                this.leaves[i].draw(time, tipX, tipY, currentWind);
            }
        }
    }

    spawn() {
        if (this.depth >= 7) return;
        const num = (this.depth < 2) ? 2 : (Math.random() < 0.4 ? 3 : 2);
        for (let i = 0; i < num; i++) {
            const spread = 0.4 + this.depth * 0.06;
            const side = (num === 2) ? (i === 0 ? -1 : 1) : (i - 1);
            const newAngle = this.angle + (side * spread) + (Math.random() - 0.5) * 0.3;
            this.children.push(new Branch(this, 0, 0, newAngle, this.length * 0.75, this.thickness * 0.6, this.depth + 1));
        }
    }

    initLeaves() {
        const colors = ['#0f5238', '#2d6a4f', '#44775a'];
        for (let i = 0; i < 8; i++) {
            this.leaves.push(new TreeLeaf(colors[i % 3]));
        }
    }
}

class TreeLeaf {
    constructor(color) {
        this.color = color;
        this.ox = (Math.random() - 0.5) * 60;
        this.oy = (Math.random() - 0.5) * 60;
        this.size = 0;
        this.target = 6 + Math.random() * 12;
        this.seed = Math.random() * 1000;
    }
    draw(time, x, y, windIntensity) {
        if (this.size < this.target) this.size += 0.1;
        const flutter = Math.sin(time * 0.005 + this.seed) * (1 + windIntensity * 3);
        const sway = Math.sin(time * 0.001 + this.seed) * 2 * windIntensity;
        ctx.beginPath();
        ctx.arc(x + this.ox + sway + flutter, y + this.oy + flutter / 2, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.65 + Math.sin(time * 0.003 + this.seed) * 0.15;
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function reset() {
    const isMobile = window.innerWidth < 768;
    const containerWidth = Math.min(window.innerWidth, 1280);
    treeReadiness = 0;

    const startX = isMobile
        ? window.innerWidth / 2
        : (window.innerWidth - containerWidth) / 2 + (containerWidth * 0.18);

    const treeHeight = isMobile ? H * 0.22 : H * 0.28;
    const treeThickness = isMobile ? 14 : 18;

    root = new Branch(null, startX, H, 0, treeHeight, treeThickness, 0);
    // Reduzido: 80 desktop, 40 mobile
    windParticles = Array.from({ length: isMobile ? 40 : 80 }, () => new WindParticle());
}

function countBranches(branch) {
    let total = 1, done = branch.finished ? 1 : 0;
    for (let i = 0; i < branch.children.length; i++) {
        const r = countBranches(branch.children[i]);
        total += r.total;
        done += r.done;
    }
    return { total, done };
}

function loop(time) {
    if (!ctx || !isVisible) {
        requestAnimationFrame(loop);
        return;
    }

    frameCount++;
    ctx.clearRect(0, 0, W, H);

    if (Math.random() < 0.002) targetGust = 0.5 + Math.random() * 0.8;
    targetGust *= 0.993;
    gust += (targetGust - gust) * 0.015;

    smoothedMouseX += (mouseX - smoothedMouseX) * 0.04;
    const currentWind = globalWind + smoothedMouseX * 6.0 + gust;

    // Conta galhos a cada 30 frames (não todo frame)
    if (frameCount % 30 === 0 && root) {
        const { total, done } = countBranches(root);
        treeReadiness = total > 0 ? done / total : 0;
    }

    for (let i = 0; i < windParticles.length; i++) {
        windParticles[i].update(currentWind);
        windParticles[i].draw(time);
    }

    if (root) root.draw(time, currentWind);
    requestAnimationFrame(loop);
}

// --- Bottle Smile Transition Logic ---
function initBottleTransition() {
    const bottleImg = document.getElementById('bottle-hero-img');
    if (!bottleImg) return;

    const normalSrc = 'garrafa.png';
    const smilingSrc = 'garrafasorry.png';
    let isSmiling = false;

    const preloadImg = new Image();
    preloadImg.src = smilingSrc;

    setInterval(() => {
        bottleImg.style.opacity = '0.98';
        setTimeout(() => {
            isSmiling = !isSmiling;
            bottleImg.src = isSmiling ? smilingSrc : normalSrc;
            bottleImg.style.opacity = '1';
        }, 150);
    }, 3000);
}

// --- Fixed Background Bottle Scroll Logic ---
function initFixedBottleScroll() {
    const fixedBottle = document.getElementById('fixed-bg-bottle');
    const targetSection = document.getElementById('materiais');
    if (!fixedBottle || !targetSection) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
                fixedBottle.classList.remove('opacity-0');
                fixedBottle.classList.add('opacity-100');
            } else {
                fixedBottle.classList.add('opacity-0');
                fixedBottle.classList.remove('opacity-100');
            }
        });
    }, { threshold: 0, rootMargin: "0px 0px -20% 0px" });

    observer.observe(targetSection);
}

document.addEventListener('DOMContentLoaded', () => {
    resize();
    requestAnimationFrame(loop);
    initBottleTransition();
    initFixedBottleScroll();
});
