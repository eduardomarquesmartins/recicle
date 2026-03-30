const canvas = document.getElementById('tree-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

let W, H;
let root;
let windParticles = [];
let mouseX = 0;
let smoothedMouseX = 0;
let globalWind = 0.15; 
let gust = 0;
let targetGust = 0;
let isVisible = !!canvas;

// Intersection Observer to pause animation when not visible
if (canvas) {
    const observer = new IntersectionObserver((entries) => {
        isVisible = entries[0].isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(canvas.parentElement);

    window.addEventListener('mousemove', e => {
        mouseX = (e.clientX / window.innerWidth) - 0.5;
    });
}

function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = canvas.width = window.innerWidth;
    H = canvas.height = rect.height;
    reset();
}
window.addEventListener('resize', resize);

class WindParticle {
    constructor() {
        this.reset();
        this.x = Math.random() * W;
    }
    reset() {
        this.x = W + 100;
        this.y = Math.random() * H;
        this.size = 1.5 + Math.random() * 4;
        this.speed = 2 + Math.random() * 5;
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
            ctx.globalAlpha = 0.25;
            ctx.fill();
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = `rgba(45, 106, 79, 0.4)`;
            const segments = 10;
            const sLen = this.streakLen / segments;
            for (let i = 0; i <= segments; i++) {
                const sx = this.x + i * sLen;
                const sy = this.y + Math.sin(sx * 0.02 + time * 0.002) * 20;
                if (i === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
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
        
        // Spring physics
        this.sway = 0;
        this.swayVel = 0;
    }

    draw(time, currentWind) {
        // Growth — mais lento e suave
        const growSpeed = 0.006 + (7 - this.depth) * 0.002;
        if (this.p < 1) {
            this.p = Math.min(1, this.p + growSpeed);
            if (this.p >= 1 && !this.finished) {
                this.finished = true;
                this.spawn();
            }
        }

        // Spring-based Sway Physics — mais suave, menos tremor
        const stiffness = 0.006 + (7 - this.depth) * 0.008;
        const dampening = 0.96;
        const windForce = Math.sin(time * 0.0005 + this.seed) * (this.depth + 1) * 0.004 * currentWind;
        
        const accel = ( (windForce * 1.5) - this.sway ) * stiffness;
        this.swayVel = (this.swayVel + accel) * dampening;
        this.sway += this.swayVel;

        const curAngle = this.angle + this.sway;
        const curL = this.length * this.p;
        const tx = Math.sin(curAngle) * curL;
        const ty = -Math.cos(curAngle) * curL;

        const w1 = this.thickness;
        const w2 = this.thickness * (1 - this.p * 0.4);
        
        // Skip drawing very thin branches to save performance
        if (w2 < 0.5 && this.depth > 5) return;

        const nx = Math.cos(curAngle);
        const ny = Math.sin(curAngle);

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = `hsl(145, 40%, ${20 + this.depth * 4}%)`;
        ctx.beginPath();
        ctx.arc(0, 0, w1, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-nx * w1, -ny * w1);
        ctx.lineTo(tx - nx * w2, ty - ny * w2);
        ctx.lineTo(tx + nx * w2, ty + ny * w2);
        ctx.lineTo(nx * w1, ny * w1);
        ctx.closePath();
        ctx.fill();

        if (this.p < 1 || this.depth === 7) {
            ctx.beginPath();
            ctx.arc(tx, ty, w2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        const tipX = this.x + tx;
        const tipY = this.y + ty;

        this.children.forEach(c => {
            c.x = tipX;
            c.y = tipY;
            c.draw(time, currentWind);
        });

        if (this.finished && this.depth > 2) {
            if (this.leaves.length === 0) this.initLeaves();
            this.leaves.forEach(l => l.draw(time, tipX, tipY, currentWind));
        }
    }

    spawn() {
        if (this.depth >= 7) return;
        const num = (this.depth < 2) ? 2 : (Math.random() < 0.4 ? 3 : 2);
        for (let i = 0; i < num; i++) {
            const spread = 0.4 + this.depth * 0.06;
            const side = (num === 2) ? (i === 0 ? -1 : 1) : (i - 1);
            const newAngle = this.angle + (side * spread) + (Math.random()-0.5)*0.3;
            this.children.push(new Branch(this, 0, 0, newAngle, this.length*0.75, this.thickness*0.6, this.depth+1));
        }
    }

    initLeaves() {
        const colors = ['#0f5238', '#2d6a4f', '#44775a'];
        for (let i = 0; i < 6; i++) {
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
        ctx.arc(x + this.ox + sway + flutter, y + this.oy + flutter/2, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.35 + Math.sin(time * 0.003 + this.seed) * 0.1;
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function reset() {
    const isMobile = window.innerWidth < 768;
    const containerWidth = Math.min(window.innerWidth, 1280); 
    
    let startX;
    if (isMobile) {
        startX = window.innerWidth / 2;
    } else {
        startX = (window.innerWidth - containerWidth) / 2 + (containerWidth * 0.18); 
    }
    
    const treeHeight = isMobile ? H * 0.22 : H * 0.28;
    const treeThickness = isMobile ? 14 : 18;
    
    root = new Branch(null, startX, H, 0, treeHeight, treeThickness, 0);
    windParticles = Array.from({length: isMobile ? 40 : 60}, () => new WindParticle());
}

function loop(time) {
    if (!ctx || !isVisible) {
        requestAnimationFrame(loop);
        return;
    }
    ctx.clearRect(0, 0, W, H);
    
    if (Math.random() < 0.001) targetGust = 0.2 + Math.random() * 0.3;
    targetGust *= 0.995; 
    gust += (targetGust - gust) * 0.01; 
    
    smoothedMouseX += (mouseX - smoothedMouseX) * 0.02;
    const currentWind = (globalWind + (smoothedMouseX * 1.5) + gust);
    
    windParticles.forEach(p => {
        p.update(currentWind);
        p.draw(time);
    });

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

    // Preload smiling image to avoid flicker
    const preloadImg = new Image();
    preloadImg.src = smilingSrc;

    setInterval(() => {
        // Subtle dip in opacity to mark the transition without being transparent
        bottleImg.style.opacity = '0.98';
        
        setTimeout(() => {
            isSmiling = !isSmiling;
            bottleImg.src = isSmiling ? smilingSrc : normalSrc;
            
            // Return to full solid state immediately
            bottleImg.style.opacity = '1';
        }, 150); // Faster swap for less "shimmer"
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
                // Show if section is in or above viewport (scrolled past)
                fixedBottle.classList.remove('opacity-0');
                fixedBottle.classList.add('opacity-100');
            } else {
                // Hide if we scroll back up above the section
                fixedBottle.classList.add('opacity-0');
                fixedBottle.classList.remove('opacity-100');
            }
        });
    }, {
        threshold: 0,
        rootMargin: "0px 0px -20% 0px" // Trigger slightly before it hits the bottom
    });

    observer.observe(targetSection);
}

// Global Initialization after everything is loaded
document.addEventListener('DOMContentLoaded', () => {
    resize();
    requestAnimationFrame(loop);
    initBottleTransition();
    initFixedBottleScroll();
});
