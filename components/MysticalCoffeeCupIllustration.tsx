
import React, { useRef, useEffect } from 'react';

export const MysticalBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number | undefined>(undefined);
    const mouse = useRef<{ x: number | null; y: number | null; radius: number }>({ x: null, y: null, radius: 150 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let particlesArray: Particle[] = [];
        let particleColor: string;

        const setCanvasDimensionsAndColor = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            // Get theme-aware color from CSS variables
            const computedStyle = getComputedStyle(document.documentElement);
            const fgColor = computedStyle.getPropertyValue('--muted-foreground').trim();
            const [h, s, l] = fgColor.split(' ').map(parseFloat);
            
            const isDark = document.documentElement.classList.contains('dark');
            const opacity = isDark ? 0.2 : 0.15;
            particleColor = `hsla(${h}, ${s}%, ${l}%, ${opacity})`;
        };
        
        class Particle {
            x: number;
            y: number;
            directionX: number;
            directionY: number;
            size: number;
            
            constructor(x: number, y: number, directionX: number, directionY: number, size: number) {
                this.x = x;
                this.y = y;
                this.directionX = directionX;
                this.directionY = directionY;
                this.size = size;
            }

            draw() {
                if(!ctx) return;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
                ctx.fillStyle = particleColor;
                ctx.fill();
            }

            update() {
                if (this.x > canvas.width + this.size || this.x < -this.size) {
                    this.directionX = -this.directionX;
                }
                if (this.y > canvas.height + this.size || this.y < -this.size) {
                    this.directionY = -this.directionY;
                }
                
                // Mouse interaction
                if (mouse.current.x !== null && mouse.current.y !== null) {
                    let dx = mouse.current.x - this.x;
                    let dy = mouse.current.y - this.y;
                    let distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < mouse.current.radius + this.size) {
                        const forceDirectionX = dx / distance;
                        const forceDirectionY = dy / distance;
                        const force = (mouse.current.radius - distance) / mouse.current.radius;
                        const directionX = forceDirectionX * force * -1; // Push away
                        const directionY = forceDirectionY * force * -1;
                        this.x += directionX;
                        this.y += directionY;
                    }
                }

                this.x += this.directionX;
                this.y += this.directionY;
                this.draw();
            }
        }
        
        const init = () => {
            setCanvasDimensionsAndColor();
            particlesArray = [];
            let numberOfParticles = (canvas.height * canvas.width) / 12000;
            for (let i = 0; i < numberOfParticles; i++) {
                let size = (Math.random() * 2) + 1;
                let x = (Math.random() * (innerWidth - size * 2) + size);
                let y = (Math.random() * (innerHeight - size * 2) + size);
                let directionX = (Math.random() * .4) - .2;
                let directionY = (Math.random() * .4) - .2;
                
                particlesArray.push(new Particle(x, y, directionX, directionY, size));
            }
        };

        const animate = () => {
            if(!ctx) return;
            animationFrameId.current = requestAnimationFrame(animate);
            ctx.clearRect(0, 0, innerWidth, innerHeight);
            for (let i = 0; i < particlesArray.length; i++) {
                particlesArray[i].update();
            }
        };
        
        const handleMouseMove = (event: MouseEvent) => {
            mouse.current.x = event.x;
            mouse.current.y = event.y;
        };

        const handleMouseOut = () => {
            mouse.current.x = null;
            mouse.current.y = null;
        };
        
        const handleResize = () => {
            init();
        };

        init();
        animate();

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseout', handleMouseOut);
        window.addEventListener('resize', handleResize);

        // Re-initialize when theme changes
        const observer = new MutationObserver((mutationsList) => {
            for(const mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    init();
                }
            }
        });
        observer.observe(document.documentElement, { attributes: true });

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseout', handleMouseOut);
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        };
    }, []);

    return (
        <canvas 
            ref={canvasRef} 
            className="absolute inset-0 z-0"
            aria-hidden="true"
        />
    );
};
