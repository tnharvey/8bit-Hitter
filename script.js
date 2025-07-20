// Get the canvas and its 2D rendering context
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const gameContainer = document.getElementById('game-container');

        // Game state variables
        let ball = { x: 0, y: 0, radius: 8, speed: 0, dx: 0, dy: 0, originalSpeed: 0, color: 'rgba(0, 255, 255, 1)' };
        let gameRunning = false;
        let home = { x: 0, y: 0, radius: 15 };
        let pitch = { x: 0, y: 0, radius: 10 };
        let base1 = { x: 0, y: 0, radius: 15 };
        let base2 = { x: 0, y: 0, radius: 15 };
        let base3 = { x: 0, y: 0, radius: 15 };
        let diamond = { points: [], width: 0, height: 0 };
        let leftField = { points: [] };
        let centerField = { points: [] };
        let rightField = { points: [] };
        let accuracyZones = [];
        let runs = 0;
        let strikes = 0;
        let outs = 0;
        let lastHitResult = "N/A";
        let messageBoxTimeout = null;

        // Zoom and animation state
        let currentZoom = { scale: 1, x: 0, y: 0 };
        let targetZoom = { scale: 1, x: 0, y: 0 };
        
        // Ball and play state
        let ballFlightActive = false;
        let hitStartPos = { x: 0, y: 0 };
        let hitDistance = 0;
        let ballLandedPosition = { x: 0, y: 0 };
        let playActive = false;
        let isGameOver = false;
        let isHomeRun = false;

        // Runner state
        let activeRunners = [];
        const RUNNER_TEMPLATE = {
            radius: 12, speed: 5, path: [], currentPathIndex: 0,
            dx: 0, dy: 0, active: true, isBatterRunner: false, id: null
        };

        // Opponent and fielding state
        let opponents = [];
        const OPPONENT_COLOR = 'rgba(255, 165, 0, 0.9)';
        const OPPONENT_RADIUS = 12;
        const OPPONENT_SPEED = 4;
        let throwPhase = 0;
        let fielderHoldingBall = null;
        let throwTargetOpponent = null;
        let targetedRunner = null;
        let throwDestination = null;
        let interceptPoint = null;

        // Game configuration
        const BALL_SPEED_INITIAL = 5;
        const HIT_MAX_SPEED = 24.75;
        const THROW_SPEED = 5.5;
        const MAX_SPREAD_ANGLE = Math.PI / 3.75;

        function showMessage(message, duration = 2000) {
            const msgBox = document.getElementById('message-box');
            msgBox.textContent = message;
            msgBox.style.display = 'block';
            if (messageBoxTimeout) clearTimeout(messageBoxTimeout);
            messageBoxTimeout = setTimeout(() => { msgBox.style.display = 'none'; }, duration);
        }

        function updateGameInfo() {
            document.getElementById('runs').textContent = runs;
            document.getElementById('strikes').textContent = strikes;
            document.getElementById('outs').textContent = outs;
            document.getElementById('last-hit').textContent = lastHitResult;
        }

        function resizeCanvas() {
            canvas.width = gameContainer.clientWidth;
            canvas.height = gameContainer.clientHeight;

            const paddingX = canvas.width * 0.05;
            const diamondWidth = canvas.width - (2 * paddingX);
            const diamondHeight = diamondWidth;
            const bottomPointY = canvas.height * 0.85; 
            const bottomPointX = canvas.width / 2;

            diamond.points = [
                { x: bottomPointX, y: bottomPointY },
                { x: bottomPointX + diamondWidth / 2, y: bottomPointY - diamondHeight / 2 },
                { x: bottomPointX, y: bottomPointY - diamondHeight },
                { x: bottomPointX - diamondWidth / 2, y: bottomPointY - diamondHeight / 2 }
            ];
            diamond.width = diamondWidth;
            diamond.height = diamondHeight;
            
            const p2nd = diamond.points[2];
            const p3rd = diamond.points[3];
            const p1st = diamond.points[1];

            centerField.points = [
                p2nd,
                { x: p2nd.x + diamondWidth / 2, y: p2nd.y - diamondHeight / 2 },
                { x: p2nd.x, y: p2nd.y - diamondHeight },
                { x: p2nd.x - diamondWidth / 2, y: p2nd.y - diamondHeight / 2 }
            ];
            leftField.points = [
                p3rd,
                p2nd,
                { x: p2nd.x - diamondWidth / 2, y: p2nd.y - diamondHeight / 2},
                { x: p3rd.x - diamondWidth / 2, y: p3rd.y - diamondHeight / 2}
            ];
            rightField.points = [
                p1st,
                p2nd,
                { x: p2nd.x + diamondWidth / 2, y: p2nd.y - diamondHeight / 2 },
                { x: p1st.x + diamondWidth / 2, y: p1st.y - diamondHeight / 2 }
            ];


            home = { ...home, x: diamond.points[0].x, y: diamond.points[0].y, radius: Math.max(10, canvas.width * 0.015), name: "Home" };
            base1 = { ...base1, x: diamond.points[1].x, y: diamond.points[1].y, radius: Math.max(10, canvas.width * 0.015), name: "1st Base" };
            base2 = { ...base2, x: diamond.points[2].x, y: diamond.points[2].y, radius: Math.max(10, canvas.width * 0.015), name: "2nd Base" };
            base3 = { ...base3, x: diamond.points[3].x, y: diamond.points[3].y, radius: Math.max(10, canvas.width * 0.015), name: "3rd Base" };
            pitch = { ...pitch, x: diamond.points[2].x, y: bottomPointY - (diamondHeight / 2), radius: Math.max(8, canvas.width * 0.01) };

            accuracyZones = [
                { radius: home.radius * 2, color: 'rgba(0, 255, 0, 0.1)' },
                { radius: home.radius * 3, color: 'rgba(255, 255, 0, 0.08)' },
                { radius: home.radius * 4, color: 'rgba(255, 0, 0, 0.05)' }
            ];
            
            const catcherYOffset = accuracyZones[2].radius + OPPONENT_RADIUS;
            const catcherX = home.x;
            const catcherY = home.y + catcherYOffset;
            
            const rightFielderX = (p1st.x + p2nd.x + rightField.points[2].x + rightField.points[3].x) / 4;
            const rightFielderY = (p1st.y + p2nd.y + rightField.points[2].y + rightField.points[3].y) / 4;
            const centerFielderX = centerField.points[0].x;
            const centerFielderY = centerField.points[0].y - diamondHeight / 2;
            const leftFielderX = (p3rd.x + p2nd.x + leftField.points[2].x + leftField.points[3].x) / 4;
            const leftFielderY = (p3rd.y + p2nd.y + leftField.points[2].y + leftField.points[3].y) / 4;

            const b1x = base1.x + (base2.x - base1.x) * 0.25;
            const b1y = base1.y + (base2.y - base1.y) * 0.25;
            const b2x = base2.x + (base1.x - base2.x) * 0.25;
            const b2y = base2.y + (base1.y - base2.y) * 0.25;
            const b3x = base3.x + (base2.x - base3.x) * 0.25;
            const b3y = base3.y + (base2.y - base3.y) * 0.25;

            opponents = [
                { name: "Pitcher", x: pitch.x, y: pitch.y, radius: OPPONENT_RADIUS, speed: OPPONENT_SPEED, originalX: pitch.x, originalY: pitch.y },
                { name: "Catcher", x: catcherX, y: catcherY, radius: OPPONENT_RADIUS, speed: OPPONENT_SPEED, originalX: catcherX, originalY: catcherY },
                { name: "1st Baseman", x: b1x, y: b1y, radius: OPPONENT_RADIUS, speed: OPPONENT_SPEED, originalX: b1x, originalY: b1y, base: base1 },
                { name: "2nd Baseman", x: b2x, y: b2y, radius: OPPONENT_RADIUS, speed: OPPONENT_SPEED, originalX: b2x, originalY: b2y, base: base2 },
                { name: "3rd Baseman", x: b3x, y: b3y, radius: OPPONENT_RADIUS, speed: OPPONENT_SPEED, originalX: b3x, originalY: b3y, base: base3 },
                { name: "Left Fielder", x: leftFielderX, y: leftFielderY, radius: OPPONENT_RADIUS, speed: OPPONENT_SPEED, originalX: leftFielderX, originalY: leftFielderY },
                { name: "Center Fielder", x: centerFielderX, y: centerFielderY, radius: OPPONENT_RADIUS, speed: OPPONENT_SPEED, originalX: centerFielderX, originalY: centerFielderY },
                { name: "Right Fielder", x: rightFielderX, y: rightFielderY, radius: OPPONENT_RADIUS, speed: OPPONENT_SPEED, originalX: rightFielderX, originalY: rightFielderY }
            ];

            if (!gameRunning && !playActive && !isGameOver) {
                resetPitch();
            }
        }

        function drawDiamond(d, color = 'rgba(200, 200, 200, 0.8)') {
            ctx.beginPath();
            ctx.moveTo(d.points[0].x, d.points[0].y);
            for (let i = 1; i < d.points.length; i++) { ctx.lineTo(d.points[i].x, d.points[i].y); }
            ctx.closePath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        function drawBase(base, color = 'rgba(255, 255, 255, 0.9)') {
            ctx.beginPath();
            ctx.arc(base.x, base.y, base.radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }

        function drawBaseLabels() {
            ctx.font = `bold ${Math.max(12, canvas.width * 0.015)}px Arial`;
            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('H', home.x, home.y);
            ctx.fillText('1', base1.x, base1.y);
            ctx.fillText('2', base2.x, base2.y);
            ctx.fillText('3', base3.x, base3.y);
        }

        function drawPitch() {
            ctx.beginPath();
            ctx.arc(pitch.x, pitch.y, pitch.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
            ctx.fill();
        }

        function drawAccuracyZones() {
            for (let i = accuracyZones.length - 1; i >= 0; i--) {
                const zone = accuracyZones[i];
                ctx.beginPath();
                ctx.arc(home.x, home.y, zone.radius, 0, Math.PI * 2);
                ctx.fillStyle = zone.color;
                ctx.fill();
            }
        }

        function drawBall() {
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fillStyle = ball.color;
            ctx.fill();
        }

        function drawSingleRunner(runnerToDraw) {
            if (runnerToDraw.active) {
                ctx.beginPath();
                ctx.arc(runnerToDraw.x, runnerToDraw.y, runnerToDraw.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 200, 0, 0.9)';
                ctx.fill();
            }
        }

        function drawOpponent(opponent) {
            ctx.beginPath();
            ctx.arc(opponent.x, opponent.y, opponent.radius, 0, Math.PI * 2);
            ctx.fillStyle = OPPONENT_COLOR;
            ctx.fill();
        }
        
        function drawHomeRunText() {
            if (performance.now() % 1000 < 500) {
                ctx.font = `bold ${canvas.width * 0.1}px Arial`;
                ctx.fillStyle = 'yellow';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const centerX = diamond.points[2].x;
                const centerY = diamond.points[2].y - diamond.height / 2;
                ctx.fillText('HOME RUN!!!', centerX, centerY);
            }
        }

        function endPlay(message, duration, isNewOut) {
            playActive = false;
            throwPhase = 0;
            throwDestination = null;
            isHomeRun = false; 
            if (isNewOut) {
                outs++;
                strikes = 0;
            }
            lastHitResult = message;
            updateGameInfo();
            snapRunnersToNearestBase();
            
            setTimeout(() => {
                if (outs >= 3) {
                    isGameOver = true;
                    showMessage("Game Over! Click to Restart.", 3000);
                } else {
                    showMessage(message, duration);
                    if (!isGameOver) {
                       setTimeout(resetPitch, duration);
                    }
                }
            }, 500);
        }

        function resetGame() {
            runs = 0;
            strikes = 0;
            outs = 0;
            isGameOver = false;
            activeRunners = [];
            resetPitch();
            showMessage("Game Started! Click to hit.", 2000);
        }

        function resetPitch() {
            ball.x = pitch.x;
            ball.y = pitch.y;
            ball.speed = BALL_SPEED_INITIAL;
            
            const catcher = opponents.find(o => o.name === "Catcher");
            if (catcher) {
                const angle = Math.atan2(catcher.y - pitch.y, catcher.x - pitch.x);
                ball.dx = Math.cos(angle);
                ball.dy = Math.sin(angle);
            }

            opponents.forEach(o => { o.x = o.originalX; o.y = o.originalY; });
            activeRunners.forEach(r => r.isBatterRunner = false);

            throwPhase = 0;
            gameRunning = true;
            playActive = false;
            ballFlightActive = false;
            fielderHoldingBall = null;
            throwTargetOpponent = null;
            targetedRunner = null;
            throwDestination = null;
            isHomeRun = false;
            
            isAnimatingZoom = false;
            currentZoom = { scale: 1, x: 0, y: 0 };
            targetZoom = { scale: 1, x: 0, y: 0 };

            document.getElementById('landed-zone').textContent = "N/A";
            updateGameInfo();
        }

        function updateBall() {
            if (ball.speed > 0) {
                ball.x += ball.dx * ball.speed;
                ball.y += ball.dy * ball.speed;
            }

            const catcher = opponents.find(o => o.name === "Catcher");
            if (catcher && gameRunning && ball.dy > 0 && ball.y > catcher.y) {
                gameRunning = false;
                strikes++;
                lastHitResult = "Strike!";
                if (strikes >= 3) {
                    outs++;
                    strikes = 0;
                    lastHitResult = "Strikeout!";
                    if (outs >= 3) {
                        isGameOver = true;
                        showMessage("Game Over! Click to Restart.", 3000);
                    } else {
                        showMessage("Strikeout! Out!", 2000);
                        setTimeout(resetPitch, 2000);
                    }
                } else {
                    showMessage("Strike " + strikes + "!", 1500);
                    setTimeout(resetPitch, 1500);
                }
                updateGameInfo();
            }
        }

        function snapRunnersToNearestBase() {
            activeRunners.forEach(runner => {
                if (runner.active) {
                    const lastBase = runner.path[runner.currentPathIndex];
                    runner.x = lastBase.x;
                    runner.y = lastBase.y;
                    runner.dx = 0;
                    runner.dy = 0;
                }
            });
        }

        function updateRunners() {
            if (!playActive) return;
            
            let runnersStillActive = false;
            activeRunners.forEach(r => { if (r.active) runnersStillActive = true; });

            if (isHomeRun && !runnersStillActive) {
                endPlay("HOME RUN!", 3000, false);
                return;
            }

            activeRunners.forEach(runner => {
                if (!runner.active) return;

                if(runner.dx === 0 && runner.dy === 0) {
                    if (isHomeRun) {
                        const nextTargetIndex = runner.currentPathIndex + 1;
                        if (nextTargetIndex < runner.path.length) {
                            const nextTargetBase = runner.path[nextTargetIndex];
                            const angle = Math.atan2(nextTargetBase.y - runner.y, nextTargetBase.x - runner.x);
                            runner.dx = Math.cos(angle);
                            runner.dy = Math.sin(angle);
                        }
                    } else {
                        return;
                    }
                }

                const targetBaseIndex = runner.currentPathIndex + 1;
                if (targetBaseIndex >= runner.path.length) return;

                const targetBase = runner.path[targetBaseIndex];
                const distToTarget = Math.hypot(targetBase.x - runner.x, targetBase.y - runner.y);

                if (distToTarget < runner.speed) {
                    runner.x = targetBase.x;
                    runner.y = targetBase.y;
                    runner.dx = 0;
                    runner.dy = 0;
                    runner.currentPathIndex++;

                    if (runner.currentPathIndex === runner.path.length - 1) {
                        runs++;
                        runner.active = false;
                        updateGameInfo();
                    }
                } else {
                    runner.x += runner.dx * runner.speed;
                    runner.y += runner.dy * runner.speed;
                }
            });
        }
        
        function getLandingZone(point) {
            const isInside = (point, vs) => {
                let x = point.x, y = point.y;
                let inside = false;
                for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                    let xi = vs[i].x, yi = vs[i].y;
                    let xj = vs[j].x, yj = vs[j].y;
                    let intersect = ((yi > y) != (yj > y))
                        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                    if (intersect) inside = !inside;
                }
                return inside;
            };

            const foulLineLeft = (home.x - base3.x) * (point.y - base3.y) - (home.y - base3.y) * (point.x - base3.x);
            const foulLineRight = (home.x - base1.x) * (point.y - base1.y) - (home.y - base1.y) * (point.x - base1.x);

            if (foulLineLeft > 0 || foulLineRight < 0) {
                 return "Foul";
            }

            if (isInside(point, diamond.points)) return "Infield";
            if (isInside(point, leftField.points)) return "Left Field";
            if (isInside(point, centerField.points)) return "Center Field";
            if (isInside(point, rightField.points)) return "Right Field";
            
            if (point.y < home.y) return "Home Run";

            return "Foul";
        }

        // *** FIX: This function now correctly separates assigning a fielder from deciding the play ***
        function assignFielderAndDeterminePlay() {
            const movingRunners = activeRunners.filter(r => r.active && (r.dx !== 0 || r.dy !== 0));
            if (movingRunners.length === 0) {
                let closestDist = Infinity;
                opponents.forEach(o => {
                    const dist = Math.hypot(ballLandedPosition.x - o.x, ballLandedPosition.y - o.y);
                    if (dist < closestDist) {
                        closestDist = dist;
                        fielderHoldingBall = o;
                    }
                });
                throwPhase = 1;
                return;
            }

            let bestPlay = {
                runner: null,
                fielder: null,
                time: Infinity,
                type: null
            };

            movingRunners.forEach(runner => {
                const targetBase = runner.path[runner.currentPathIndex + 1];
                if (!targetBase) return;

                const runnerDistToBase = Math.hypot(targetBase.x - runner.x, targetBase.y - runner.y);
                const runnerTimeToBase = runnerDistToBase / runner.speed;

                opponents.forEach(fielder => {
                    // *** FIX: Catcher cannot be assigned to field balls unless it's a play at the plate ***
                    if (fielder.name === 'Catcher' && targetBase.name !== 'Home') return;

                    const fielderToBallTime = Math.hypot(ballLandedPosition.x - fielder.x, ballLandedPosition.y - fielder.y) / fielder.speed;
                    
                    const interceptTime = calculateInterceptTime(runner, { ...fielder, x: ballLandedPosition.x, y: ballLandedPosition.y });
                    if (interceptTime < runnerTimeToBase) {
                        const totalTagTime = fielderToBallTime + interceptTime;
                        if (totalTagTime < bestPlay.time) {
                            bestPlay = { runner, fielder, time: totalTagTime, type: 'tag' };
                        }
                    }

                    const throwTime = Math.hypot(targetBase.x - ballLandedPosition.x, targetBase.y - ballLandedPosition.y) / THROW_SPEED;
                    const totalThrowTime = fielderToBallTime + throwTime;
                    if (totalThrowTime < bestPlay.time) {
                        bestPlay = { runner, fielder, time: totalThrowTime, type: 'throw' };
                    }
                });
            });

            if (bestPlay.runner) {
                fielderHoldingBall = bestPlay.fielder;
                targetedRunner = bestPlay.runner;
                fielderHoldingBall.playType = bestPlay.type;
            } else {
                 let closestDist = Infinity;
                opponents.forEach(o => {
                    const dist = Math.hypot(ballLandedPosition.x - o.x, ballLandedPosition.y - o.y);
                    if (dist < closestDist) {
                        closestDist = dist;
                        fielderHoldingBall = o;
                    }
                });
                 fielderHoldingBall.playType = 'throw';
            }
            throwPhase = 1;
        }

        function calculateInterceptTime(runner, fielder) {
            const Vr = runner.speed;
            const Sf = fielder.speed;
            const Pfx = fielder.x;
            const Pfy = fielder.y;
            const Prx = runner.x;
            const Pry = runner.y;
            const Vrx = runner.dx * Vr;
            const Vry = runner.dy * Vr;

            const Rrx = Prx - Pfx;
            const Rry = Pry - Pfy;

            const a = Vrx * Vrx + Vry * Vry - Sf * Sf;
            const b = 2 * (Rrx * Vrx + Rry * Vry);
            const c = Rrx * Rrx + Rry * Rry;

            const discriminant = b * b - 4 * a * c;

            if (discriminant < 0) return Infinity;

            const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
            const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);

            if (t1 > 0 && t2 > 0) return Math.min(t1, t2);
            if (t1 > 0) return t1;
            if (t2 > 0) return t2;
            return Infinity;
        }

        function executeFielderAction(fielder) {
            if (fielder.playType === 'tag') {
                const t = calculateInterceptTime(targetedRunner, fielder);
                interceptPoint = {
                    x: targetedRunner.x + targetedRunner.dx * targetedRunner.speed * t,
                    y: targetedRunner.y + targetedRunner.dy * targetedRunner.speed * t
                };
                throwPhase = 4;
            } else {
                const targetBase = targetedRunner.path[targetedRunner.currentPathIndex + 1];
                throwDestination = { x: targetBase.x, y: targetBase.y };
                throwTargetOpponent = opponents.find(o => o.originalX === targetBase.x && o.originalY === targetBase.y) || opponents.find(o => o.name === 'Catcher');
                
                const isFielderTheBaseman = (fielder.originalX === targetBase.x && fielder.originalY === targetBase.y);
                if (isFielderTheBaseman && fielder.name !== 'Catcher') {
                    throwPhase = 3;
                } else {
                    throwPhase = 2;
                }
            }
        }

        function updateOpponents() {
            if (!playActive || isHomeRun) return;

            if (throwPhase > 0) {
                 opponents.forEach(o => {
                    const isBaseman = o.name.includes("Baseman");
                    if (isBaseman && o !== fielderHoldingBall && o !== throwTargetOpponent) {
                        const base = o.base;
                        if (base) {
                            const distToBase = Math.hypot(base.x - o.x, base.y - o.y);
                            if (distToBase > o.speed) {
                                const angle = Math.atan2(base.y - o.y, base.x - o.x);
                                o.x += Math.cos(angle) * o.speed;
                                o.y += Math.sin(angle) * o.speed;
                            }
                        }
                    }
                });
            }

            if (throwPhase === 0) return;

            if (throwPhase === 1) {
                let fielder = fielderHoldingBall;
                if (!fielder) return;
                const angle = Math.atan2(ballLandedPosition.y - fielder.y, ballLandedPosition.x - fielder.x);
                fielder.x += Math.cos(angle) * fielder.speed;
                fielder.y += Math.sin(angle) * fielder.speed;

                const distToBall = Math.hypot(ballLandedPosition.x - fielder.x, ballLandedPosition.y - fielder.y);
                if (distToBall < fielder.radius) {
                    ball.x = fielder.x;
                    ball.y = fielder.y;
                    executeFielderAction(fielder);
                }
            }
            else if (throwPhase === 2) {
                const targetBaseForPlay = throwDestination;
                
                const coveringFielder = throwTargetOpponent;
                const angleToFielder = Math.atan2(targetBaseForPlay.y - coveringFielder.y, targetBaseForPlay.x - coveringFielder.x);
                const distToFielder = Math.hypot(targetBaseForPlay.x - coveringFielder.x, targetBaseForPlay.y - coveringFielder.y);
                if (distToFielder > coveringFielder.speed) {
                    coveringFielder.x += Math.cos(angleToFielder) * coveringFielder.speed;
                    coveringFielder.y += Math.sin(angleToFielder) * coveringFielder.speed;
                }

                const throwAngle = Math.atan2(targetBaseForPlay.y - ball.y, targetBaseForPlay.x - ball.x);
                ball.dx = Math.cos(throwAngle);
                ball.dy = Math.sin(throwAngle);
                ball.speed = THROW_SPEED;
                
                const distToTarget = Math.hypot(targetBaseForPlay.x - ball.x, targetBaseForPlay.y - ball.y);
                if (distToTarget < ball.speed) {
                    ball.speed = 0;
                    if (targetedRunner && (targetedRunner.dx !== 0 || targetedRunner.dy !== 0)) {
                        targetedRunner.active = false;
                        endPlay("OUT!", 2000, true);
                    } else {
                        endPlay("Safe!", 2000, false);
                    }
                }
            }
            else if (throwPhase === 3) {
                const fielder = fielderHoldingBall;
                const targetBase = throwDestination;
                
                const angle = Math.atan2(targetBase.y - fielder.y, targetBase.x - fielder.x);
                fielder.x += Math.cos(angle) * fielder.speed;
                fielder.y += Math.sin(angle) * fielder.speed;
                ball.x = fielder.x;
                ball.y = fielder.y;

                const distToBase = Math.hypot(targetBase.x - fielder.x, targetBase.y - fielder.y);
                if (distToBase < fielder.speed) {
                    ball.speed = 0;
                    if (targetedRunner && (targetedRunner.dx !== 0 || targetedRunner.dy !== 0)) {
                        targetedRunner.active = false;
                        endPlay("OUT!", 2000, true);
                    } else {
                        endPlay("Safe!", 2000, false);
                    }
                }
            }
            else if (throwPhase === 4) {
                const fielder = fielderHoldingBall;
                const angle = Math.atan2(interceptPoint.y - fielder.y, interceptPoint.x - fielder.x);
                fielder.x += Math.cos(angle) * fielder.speed;
                fielder.y += Math.sin(angle) * fielder.speed;
                ball.x = fielder.x;
                ball.y = fielder.y;

                const distToIntercept = Math.hypot(interceptPoint.x - fielder.x, interceptPoint.y - fielder.y);
                if (distToIntercept < fielder.radius) {
                     if (targetedRunner && Math.hypot(fielder.x - targetedRunner.x, fielder.y - targetedRunner.y) < fielder.radius + targetedRunner.radius) {
                        targetedRunner.active = false;
                        endPlay("Tagged OUT!", 2000, true);
                     } else {
                        endPlay("Safe!", 2000, false);
                     }
                }
            }
        }

        function handleClick(event) {
            if (isGameOver) {
                resetGame();
                return;
            }
            if (!gameRunning) return;

            const hitDeltaY = ball.y - home.y;
            const absHitDeltaY = Math.abs(hitDeltaY);
            let hitResult = "Miss";
            let angleOffset = 0;
            let hitSpeedMultiplier = 0;

            const perfectThreshold = home.radius;
            const goodThreshold = accuracyZones[0].radius;
            const okayThreshold = accuracyZones[1].radius;
            const poorThreshold = accuracyZones[2].radius;

            if (absHitDeltaY < perfectThreshold) {
                hitResult = "Perfect!"; hitSpeedMultiplier = 1;
            } else if (absHitDeltaY < goodThreshold) {
                hitResult = "Good!"; angleOffset = (absHitDeltaY - perfectThreshold) / (goodThreshold - perfectThreshold) * (MAX_SPREAD_ANGLE / 3); hitSpeedMultiplier = 0.8;
            } else if (absHitDeltaY < okayThreshold) {
                hitResult = "Okay!"; angleOffset = (MAX_SPREAD_ANGLE / 3) + (absHitDeltaY - goodThreshold) / (okayThreshold - goodThreshold) * (MAX_SPREAD_ANGLE / 3); hitSpeedMultiplier = 0.6;
            } else if (absHitDeltaY < poorThreshold) {
                hitResult = "Poor!"; angleOffset = (2 * MAX_SPREAD_ANGLE / 3) + (absHitDeltaY - okayThreshold) / (poorThreshold - okayThreshold) * (MAX_SPREAD_ANGLE / 3); hitSpeedMultiplier = 0.4;
            } else {
                return;
            }

            gameRunning = false;

            const baseAngle = -Math.PI / 2;
            const newAngle = baseAngle + (hitDeltaY < 0 ? -angleOffset : angleOffset);
            ball.dx = Math.cos(newAngle);
            ball.dy = Math.sin(newAngle);
            ball.speed = HIT_MAX_SPEED * hitSpeedMultiplier; 
            
            const minHit = diamond.height * 0.4; 
            const maxHit = diamond.height * 2.5; 
            hitDistance = minHit + (maxHit - minHit) * hitSpeedMultiplier * Math.random();
            hitStartPos = { x: ball.x, y: ball.y };

            ballFlightActive = true;
            
            activeRunners.forEach(runner => {
                if (runner.active) {
                    const currentBase = runner.path[runner.currentPathIndex];
                    const nextTargetIndex = runner.currentPathIndex + 1;
                    if (nextTargetIndex < runner.path.length) {
                        const nextTargetBase = runner.path[nextTargetIndex];
                        runner.x = currentBase.x;
                        runner.y = currentBase.y;
                        const angle = Math.atan2(nextTargetBase.y - currentBase.y, nextTargetBase.x - currentBase.x);
                        runner.dx = Math.cos(angle);
                        runner.dy = Math.sin(angle);
                    }
                }
            });

            let newBatterRunner = {
                x: home.x, y: home.y, ...RUNNER_TEMPLATE,
                path: [home, base1, base2, base3, home],
                currentPathIndex: 0, isBatterRunner: true, id: Date.now()
            };
            const initialTarget = newBatterRunner.path[1];
            const angle = Math.atan2(initialTarget.y - newBatterRunner.y, initialTarget.x - newBatterRunner.x);
            newBatterRunner.dx = Math.cos(angle);
            newBatterRunner.dy = Math.sin(angle);
            activeRunners.push(newBatterRunner);

            playActive = true;
            strikes = 0;
            lastHitResult = hitResult;
            updateGameInfo();
            showMessage(hitResult, 1000);
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();

            if (playActive) {
                const catcher = opponents.find(o => o.name === 'Catcher');
                if (catcher) {
                    const topMostY = Math.min(ball.y, centerField.points[2].y);
                    const requiredHeight = catcher.originalY - topMostY + (canvas.height * 0.1);
                    targetZoom.scale = Math.min(1, canvas.height / requiredHeight);
                    
                    const fieldCenterX = canvas.width / 2;
                    const fieldCenterY = (catcher.originalY + centerField.points[2].y) / 2;
                    
                    targetZoom.x = (canvas.width / 2) - (fieldCenterX * targetZoom.scale);
                    targetZoom.y = (canvas.height / 2) - (fieldCenterY * targetZoom.scale);
                }
            } else if (!isGameOver) {
                targetZoom.scale = 1;
                targetZoom.x = 0;
                targetZoom.y = 0;
            }

            currentZoom.scale += (targetZoom.scale - currentZoom.scale) * 0.08;
            currentZoom.x += (targetZoom.x - currentZoom.x) * 0.08;
            currentZoom.y += (targetZoom.y - currentZoom.y) * 0.08;

            ctx.translate(currentZoom.x, currentZoom.y);
            ctx.scale(currentZoom.scale, currentZoom.scale);

            drawDiamond(leftField, 'rgba(200, 200, 200, 0.3)');
            drawDiamond(centerField, 'rgba(200, 200, 200, 0.3)');
            drawDiamond(rightField, 'rgba(200, 200, 200, 0.3)');
            drawDiamond(diamond);
            drawAccuracyZones();
            drawBase(home); drawBase(base1); drawBase(base2); drawBase(base3);
            drawBaseLabels();
            drawPitch();
            opponents.forEach(drawOpponent);

            updateBall();

            if (ballFlightActive) {
                const distTraveled = Math.hypot(ball.x - hitStartPos.x, ball.y - hitStartPos.y);
                if (distTraveled >= hitDistance) {
                    ballFlightActive = false;
                    ball.speed = 0; 
                    ballLandedPosition.x = ball.x;
                    ballLandedPosition.y = ball.y;
                    
                    const zone = getLandingZone(ballLandedPosition);
                    document.getElementById('landed-zone').textContent = zone;

                    if (zone === "Home Run") {
                        isHomeRun = true;
                    } else if (zone === "Foul") {
                        if (strikes < 2) {
                            strikes++;
                        }
                        endPlay("Foul Ball!", 2000, false);
                    }
                    else {
                        assignFielderAndDeterminePlay();
                    }
                }
            }

            drawBall();
            
            if (playActive) {
                updateRunners();
                updateOpponents();
            }
            
            if (isHomeRun) {
                drawHomeRunText();
            }

            activeRunners.forEach(drawSingleRunner);
            
            ctx.restore();
            requestAnimationFrame(animate);
        }

        window.addEventListener('resize', resizeCanvas);
        canvas.addEventListener('mousedown', handleClick);

        window.onload = function() {
            resizeCanvas();
            animate();
        };