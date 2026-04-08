

document.addEventListener('DOMContentLoaded', () => {

    let conversationHistory = [];
    let currentSolution = null;
    let currentProblemLatex = '';


    const mathInput = document.getElementById('mathInput');
    const classLevelInput = document.getElementById('classLevel');
    const instructionInput = document.getElementById('instructionInput');
    const solveBtn = document.getElementById('solveBtn');


    const wordProblemInput = document.getElementById('wordProblemInput');
    const wordClassLevel = document.getElementById('wordClassLevel');
    const solveWordBtn = document.getElementById('solveWordBtn');
    const sharedSolutionArea = document.getElementById('sharedSolutionArea');

    const loadingContainer = document.getElementById('loadingContainer');
    const solutionSection = document.getElementById('solutionSection');
    const stepsContainer = document.getElementById('stepsContainer');
    const finalAnswerEl = document.getElementById('finalAnswer');
    const answerContent = document.getElementById('answerContent');
    const answerSummary = document.getElementById('answerSummary');
    const verificationBadge = document.getElementById('verificationBadge');
    const saveBtn = document.getElementById('saveBtn');
    const keyboardToggle = document.getElementById('keyboardToggle');
    const mathKeyboard = document.getElementById('mathKeyboard');
    const langToggle = document.getElementById('langToggle');
    const themeToggle = document.getElementById('themeToggle');
    const savedProblemsBtn = document.getElementById('savedProblemsBtn');
    const savedModal = document.getElementById('savedModal');
    const closeSavedModal = document.getElementById('closeSavedModal');
    const savedList = document.getElementById('savedList');
    const explainModal = document.getElementById('explainModal');
    const closeExplainModal = document.getElementById('closeExplainModal');
    const explainContent = document.getElementById('explainContent');


    const tabSolver = document.getElementById('tabSolver');
    const tabWord = document.getElementById('tabWord');
    const tabGraph = document.getElementById('tabGraph');
    const solverTab = document.getElementById('solverTab');
    const wordTab = document.getElementById('wordTab');
    const graphTab = document.getElementById('graphTab');
    const equationModeBtn = document.getElementById('equationModeBtn');
    const pointModeBtn = document.getElementById('pointModeBtn');
    const equationInput = document.getElementById('equationInput');
    const pointInput = document.getElementById('pointInput');
    const equationField = document.getElementById('equationField');
    const plotBtn = document.getElementById('plotBtn');
    const clearPointsBtn = document.getElementById('clearPointsBtn');
    const fitCurveBtn = document.getElementById('fitCurveBtn');
    const polyDegree = document.getElementById('polyDegree');
    const graphAnalysis = document.getElementById('graphAnalysis');
    const graphAnalysisContent = document.getElementById('graphAnalysisContent');
    const askAIBtn = document.getElementById('askAIBtn');
    const graphAskAI = document.getElementById('graphAskAI');
    const addPointBtn = document.getElementById('addPointBtn');
    const manualPointX = document.getElementById('manualPointX');
    const manualPointY = document.getElementById('manualPointY');


    applyTranslations();
    initTheme();
    if (window.AnimationModule) AnimationModule.init();


    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-tab') + 'Tab';
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.classList.add('active');


            if (tab.getAttribute('data-tab') === 'graph') {
                if (sharedSolutionArea) sharedSolutionArea.style.display = 'none';
                GraphModule.initGraph();
            } else {
                if (sharedSolutionArea) sharedSolutionArea.style.display = 'block';
            }
        });
    });


    function initTheme() {
        const saved = localStorage.getItem('mathnote-theme');
        if (saved === 'light') {
            document.body.setAttribute('data-theme', 'light');
        }
    }

    themeToggle.addEventListener('click', () => {
        const isLight = document.body.getAttribute('data-theme') === 'light';
        if (isLight) {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('mathnote-theme', 'dark');
        } else {
            document.body.setAttribute('data-theme', 'light');
            localStorage.setItem('mathnote-theme', 'light');
        }
    });


    langToggle.addEventListener('click', () => {
        toggleLanguage();
    });


    keyboardToggle.addEventListener('click', () => {
        const isVisible = mathKeyboard.style.display !== 'none';
        mathKeyboard.style.display = isVisible ? 'none' : 'block';
    });

    document.querySelectorAll('.key[data-cmd]').forEach(key => {
        key.addEventListener('click', () => {
            const cmd = key.getAttribute('data-cmd');
            if (mathInput && mathInput.executeCommand) {
                mathInput.executeCommand(['insert', cmd]);
                mathInput.focus();
            }
        });
    });

    document.querySelectorAll('.key[data-insert]').forEach(key => {
        key.addEventListener('click', () => {
            const val = key.getAttribute('data-insert');
            if (mathInput && mathInput.executeCommand) {
                mathInput.executeCommand(['insert', val]);
                mathInput.focus();
            }
        });
    });


    solveBtn.addEventListener('click', async () => {
        const latex = mathInput.value;
        const instruction = instructionInput.value.trim();
        const fullProblem = instruction ? `${latex}\n\nInstructions: ${instruction}` : latex;
        await solveGeneric(fullProblem, classLevelInput.value, latex);
    });

    if (solveWordBtn) {
        solveWordBtn.addEventListener('click', async () => {
            const problem = wordProblemInput.value.trim();
            if (!problem) {
                showToast(t('errorNoProblem') || "Please enter a problem", 'error');
                return;
            }
            await solveGeneric(problem, wordClassLevel.value, problem);
        });
    }

    async function solveGeneric(problemText, level, rawDisplayProblem) {
        if (!problemText || !problemText.trim()) {
            showToast(t('errorNoProblem'), 'error');
            return;
        }

        currentProblemLatex = rawDisplayProblem || problemText;
        conversationHistory = [];
        showLoading(true);
        showSolution(false);

        try {
            const response = await fetch('/mathnote/api/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem: problemText,
                    classLevel: level,
                    lang: currentLang,
                    history: conversationHistory
                })
            });

            const data = await response.json();
            if (response.status === 429) {
                const err = new Error(data.error || 'Rate limit reached');
                err.status = 429;
                err.retryAfter = data.retryAfter;
                throw err;
            }
            if (!response.ok) throw new Error(data.error || 'Failed to solve');

            currentSolution = data.solution;
            conversationHistory.push(
                { role: 'user', content: `Solve: ${problemText}` },
                { role: 'assistant', content: data.rawResponse }
            );

            renderSolution(data.solution);


            if (data.solution.steps && data.solution.steps.length > 0) {
                showAnimationButton(data.solution);
                generateAnimationsInBackground(problemText, data.solution);
            } else {
                hideAnimationButton();
            }

            showLoading(false);
            showSolution(true);


            verifySolution(problemText, data.solution);
        } catch (err) {
            console.error('Solve error:', err);
            showLoading(false);
            showSolution(false);
            if (err.status === 429 || err.retryAfter) {
                const secs = err.retryAfter || 30;
                showToast(t('rateLimit').replace('{secs}', secs), 'error');
            } else {
                showToast(t('errorSolving'), 'error');
            }
        }
    }


    const verificationDetail = document.getElementById('verificationDetail');

    verificationBadge.style.cursor = 'pointer';
    verificationBadge.addEventListener('click', () => {
        const isVisible = verificationDetail.style.display !== 'none';
        verificationDetail.style.display = isVisible ? 'none' : 'block';
        const chevron = verificationBadge.querySelector('.badge-chevron');
        if (chevron) chevron.textContent = isVisible ? '▾' : '▴';
    });


    async function verifySolution(problem, solution) {
        verificationBadge.style.display = 'inline-flex';
        verificationBadge.className = 'verification-badge';
        verificationBadge.querySelector('.badge-icon').textContent = '';
        verificationBadge.querySelector('.badge-text').textContent = t('verifying');
        // Add chevron indicator if not present
        if (!verificationBadge.querySelector('.badge-chevron')) {
            const chevron = document.createElement('span');
            chevron.className = 'badge-chevron';
            chevron.textContent = '▾';
            verificationBadge.appendChild(chevron);
        }
        verificationDetail.style.display = 'none';
        verificationDetail.innerHTML = '';

        try {
            const response = await fetch('/mathnote/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ problem, solution, lang: currentLang })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            const v = data.verification;

            // Update the badge
            if (v.isCorrect) {
                verificationBadge.classList.add('verified');
                verificationBadge.querySelector('.badge-icon').textContent = '✓';
                verificationBadge.querySelector('.badge-text').textContent = t('verified');
            } else if (v.confidence === 'low') {
                verificationBadge.classList.add('unverified');
                verificationBadge.querySelector('.badge-icon').textContent = '⚠';
                verificationBadge.querySelector('.badge-text').textContent = t('unverified');
            } else {
                verificationBadge.classList.add('incorrect');
                verificationBadge.querySelector('.badge-icon').textContent = '✕';
                verificationBadge.querySelector('.badge-text').textContent = t('incorrect');
            }

            // Build detail panel content
            let detailHtml = '';

            if (v.explanation) {
                detailHtml += `<p class="verify-explanation">${sanitizeLatex(v.explanation)}</p>`;
            }

            if (v.issues && v.issues.length > 0) {
                detailHtml += `<ul class="verify-issues">`;
                v.issues.forEach(issue => {
                    detailHtml += `<li>${sanitizeLatex(issue)}</li>`;
                });
                detailHtml += `</ul>`;
            }

            if (!v.isCorrect && v.correctedAnswer) {
                detailHtml += `<div class="verify-corrected">
                    <span class="verify-corrected-label">${currentLang === 'vi' ? 'Đáp án đúng' : 'Correct Answer'}:</span>
                    <span class="verify-corrected-math">\\(${v.correctedAnswer}\\)</span>
                </div>`;
            }

            if (detailHtml) {
                verificationDetail.innerHTML = `<div class="verify-detail-inner ${v.isCorrect ? 'verified' : v.confidence === 'low' ? 'unverified' : 'incorrect'}">${detailHtml}</div>`;
                renderMath(verificationDetail);
            }

        } catch (err) {
            console.error('Verify error:', err);
            verificationBadge.style.display = 'none';
        }
    }


    function renderSolution(solution) {
        stepsContainer.innerHTML = '';

        if (!solution || !solution.steps) return;

        solution.steps.forEach((step, idx) => {
            const card = document.createElement('div');
            card.className = 'step-card';
            card.style.animationDelay = `${idx * 0.15}s`;


            const headerDiv = document.createElement('div');
            headerDiv.className = 'step-header';
            const numSpan = document.createElement('span');
            numSpan.className = 'step-number';
            numSpan.textContent = idx + 1;
            const titleSpan = document.createElement('span');
            titleSpan.className = 'step-title';
            titleSpan.textContent = step.title || `Step ${idx + 1}`;
            headerDiv.appendChild(numSpan);
            headerDiv.appendChild(titleSpan);
            card.appendChild(headerDiv);


            if (step.explanation) {
                const expP = document.createElement('p');
                expP.className = 'step-explanation';
                expP.innerHTML = sanitizeLatex(step.explanation); 
                card.appendChild(expP);
                renderMath(expP);
            }


            if (step.math) {
                const mathDiv = document.createElement('div');
                mathDiv.className = 'step-math';
                mathDiv.textContent = ensureDelimiters(sanitizeLatex(step.math));
                card.appendChild(mathDiv);
                renderMath(mathDiv);
            }


            if (step.result) {
                const resP = document.createElement('p');
                resP.className = 'step-result';
                resP.textContent = ensureDelimiters(sanitizeLatex(step.result));
                card.appendChild(resP);
                renderMath(resP);
            }


            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'step-actions';
            const explainBtn = document.createElement('button');
            explainBtn.className = 'explain-btn';
            explainBtn.textContent = t('explainStep');
            explainBtn.addEventListener('click', () => {
                explainStep(step, idx);
            });
            actionsDiv.appendChild(explainBtn);
            card.appendChild(actionsDiv);

            stepsContainer.appendChild(card);
        });


        if (solution.finalAnswer) {
            finalAnswerEl.style.display = 'block';
            answerContent.textContent = ensureDelimiters(solution.finalAnswer);
            answerSummary.innerHTML = sanitizeLatex(solution.summary || '');
            renderMath(answerContent);
            renderMath(answerSummary);
        } else {
            finalAnswerEl.style.display = 'none';
        }
    }


    async function explainStep(step, stepIdx) {
        explainModal.style.display = 'flex';
        explainContent.innerHTML = `
      <div style="display:flex;justify-content:center;padding:2rem;">
        <div class="loading-spinner small">
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
        </div>
      </div>
    `;

        try {
            const response = await fetch('/mathnote/api/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    step,
                    history: conversationHistory,
                    lang: currentLang,
                    classLevel: classLevelInput.value
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            const explDiv = document.createElement('div');
            explDiv.className = 'explanation-text';
            explDiv.innerHTML = sanitizeLatex(data.explanation);
            explainContent.innerHTML = '';
            explainContent.appendChild(explDiv);
            renderMath(explDiv);


            conversationHistory.push(
                { role: 'user', content: `Explain step ${stepIdx + 1}: ${JSON.stringify(step)}` },
                { role: 'assistant', content: data.explanation }
            );
        } catch (err) {
            console.error('Explain error:', err);
            explainContent.innerHTML = `<p style="color:var(--error);">${t('errorExplaining')}</p>`;
        }
    }


    saveBtn.addEventListener('click', () => {
        if (!currentSolution || !currentProblemLatex) return;

        const saved = JSON.parse(localStorage.getItem('mathnote-saved') || '[]');
        saved.unshift({
            id: Date.now(),
            problem: currentProblemLatex,
            solution: currentSolution,
            classLevel: classLevelInput.value,
            date: new Date().toLocaleString(),
            lang: currentLang
        });
        localStorage.setItem('mathnote-saved', JSON.stringify(saved));
        showToast(t('savedSuccess'), 'success');
    });

    savedProblemsBtn.addEventListener('click', () => {
        renderSavedList();
        savedModal.style.display = 'flex';
    });

    closeSavedModal.addEventListener('click', () => {
        savedModal.style.display = 'none';
    });

    savedModal.addEventListener('click', (e) => {
        if (e.target === savedModal) savedModal.style.display = 'none';
    });

    function renderSavedList() {
        const saved = JSON.parse(localStorage.getItem('mathnote-saved') || '[]');

        if (saved.length === 0) {
            savedList.innerHTML = `<p class="empty-state">${t('noSavedProblems')}</p>`;
            return;
        }

        savedList.innerHTML = saved.map(item => `
      <div class="saved-item" data-id="${item.id}">
        <div class="saved-item-problem">${sanitizeLatex(ensureDelimiters(item.problem))}</div>
        <div class="saved-item-date">${item.date} · ${item.classLevel || 'General'}</div>
        <div class="saved-item-actions">
          <button class="btn-secondary load-saved-btn" data-id="${item.id}">${t('load')}</button>
          <button class="btn-secondary delete-saved-btn" data-id="${item.id}" style="color:var(--error);">${t('delete')}</button>
        </div>
      </div>
    `).join('');


        savedList.querySelectorAll('.saved-item-problem').forEach(el => {
            renderMath(el);
        });


        savedList.querySelectorAll('.load-saved-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.getAttribute('data-id'));
                const item = saved.find(s => s.id === id);
                if (item) {
                    if (mathInput.setValue) mathInput.setValue(item.problem);
                    classLevelInput.value = item.classLevel || '';
                    currentSolution = item.solution;
                    currentProblemLatex = item.problem;
                    renderSolution(item.solution);
                    showSolution(true);
                    savedModal.style.display = 'none';
                }
            });
        });


        savedList.querySelectorAll('.delete-saved-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.getAttribute('data-id'));
                const updated = saved.filter(s => s.id !== id);
                localStorage.setItem('mathnote-saved', JSON.stringify(updated));
                renderSavedList();
                showToast(t('deletedSuccess'), 'success');
            });
        });
    }


    closeExplainModal.addEventListener('click', () => {
        explainModal.style.display = 'none';
    });

    explainModal.addEventListener('click', (e) => {
        if (e.target === explainModal) explainModal.style.display = 'none';
    });


    equationModeBtn.addEventListener('click', () => {
        equationModeBtn.classList.add('active');
        pointModeBtn.classList.remove('active');
        equationInput.style.display = 'block';
        pointInput.style.display = 'none';
        GraphModule.initGraph();
        GraphModule.disablePointMode();
    });

    pointModeBtn.addEventListener('click', () => {
        pointModeBtn.classList.add('active');
        equationModeBtn.classList.remove('active');
        equationInput.style.display = 'none';
        pointInput.style.display = 'block';
        GraphModule.initGraph();
        GraphModule.enablePointMode();
    });


    addPointBtn.addEventListener('click', () => {
        const x = parseFloat(manualPointX.value);
        const y = parseFloat(manualPointY.value);
        if (isNaN(x) || isNaN(y)) {
            showToast(t('errorCoordinates'), 'error');
            return;
        }
        GraphModule.addPoint(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
        manualPointX.value = '';
        manualPointY.value = '';
        manualPointX.focus();
    });


    plotBtn.addEventListener('click', () => {
        const latex = equationField.value;
        if (!latex || !latex.trim()) {
            showToast(t('errorNoProblem'), 'error');
            return;
        }


        let success = GraphModule.plotLatexEquation(latex);
        if (!success) {
            success = GraphModule.plotEquation(latex);
        }

        if (!success) {
            showToast(t('errorPlotting'), 'error');
        }
    });


    clearPointsBtn.addEventListener('click', () => {
        GraphModule.clearPoints();
    });


    fitCurveBtn.addEventListener('click', () => {
        const degree = parseInt(polyDegree.value);
        const equation = GraphModule.fitCurve(degree);
        if (equation) {
            showToast(equation, 'success');
        }
    });


    askAIBtn.addEventListener('click', async () => {
        const question = graphAskAI.value.trim();
        if (!question) {
            showToast(t('errorAIQuestion'), 'error');
            return;
        }

        const points = GraphModule.getPoints();
        const expressions = GraphModule.getExpressions();

        graphAnalysis.style.display = 'block';
        graphAnalysisContent.innerHTML = `
      <div style="display:flex;justify-content:center;padding:2rem;">
        <div class="loading-spinner small">
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
        </div>
      </div>
    `;


        let graphContext = '';
        if (expressions.length > 0) {
            graphContext += `Equations on graph: ${expressions.join(', ')}\n`;
        }
        if (points.length > 0) {
            const pointsStr = points.map(p => `(${p.x}, ${p.y})`).join(', ');
            graphContext += `Points on graph: ${pointsStr}\n`;
        }


        const degree = parseInt(polyDegree.value);
        if (points.length >= degree + 1) {
            const fittedEq = GraphModule.fitCurve(degree);
            if (fittedEq) {
                graphContext += `Fitted polynomial (degree ${degree}): y = ${fittedEq}\n`;
            }
        }

        try {
            const response = await fetch('/mathnote/api/graph-solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    equation: expressions.length > 0 ? expressions.join('; ') : undefined,
                    points: points.length > 0 ? points : undefined,
                    degree,
                    question: question,
                    graphContext: graphContext,
                    lang: currentLang,
                    classLevel: classLevelInput.value
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);


            const result = data.graphAnalysis;
            const container = document.createElement('div');

            if (typeof result === 'string') {

                const p = document.createElement('p');
                p.innerHTML = sanitizeLatex(result);
                container.appendChild(p);
                renderMath(p);

                if (result.analysis) {
                    const p = document.createElement('p');
                    p.innerHTML = sanitizeLatex(result.analysis);
                    container.appendChild(p);
                    renderMath(p);
                }
                if (result.equation) {
                    const mathDiv = document.createElement('div');
                    mathDiv.className = 'step-math';
                    mathDiv.textContent = ensureDelimiters(sanitizeLatex(result.equation));
                    container.appendChild(mathDiv);
                    renderMath(mathDiv);
                }
                if (result.steps && result.steps.length > 0) {
                    result.steps.forEach((step, idx) => {
                        const card = document.createElement('div');
                        card.className = 'step-card';
                        card.style.animationDelay = `${idx * 0.1}s`;

                        const header = document.createElement('div');
                        header.className = 'step-header';
                        const numSpan = document.createElement('span');
                        numSpan.className = 'step-number';
                        numSpan.textContent = idx + 1;
                        const titleSpan = document.createElement('span');
                        titleSpan.className = 'step-title';
                        titleSpan.textContent = step.title || `Step ${idx + 1}`;
                        header.appendChild(numSpan);
                        header.appendChild(titleSpan);
                        card.appendChild(header);

                        if (step.explanation) {
                            const expP = document.createElement('p');
                            expP.className = 'step-explanation';
                            expP.innerHTML = sanitizeLatex(step.explanation);
                            card.appendChild(expP);
                            renderMath(expP);
                        }
                        if (step.math) {
                            const mathDiv = document.createElement('div');
                            mathDiv.className = 'step-math';
                            mathDiv.textContent = ensureDelimiters(sanitizeLatex(step.math));
                            card.appendChild(mathDiv);
                            renderMath(mathDiv);
                        }
                        if (step.result) {
                            const resP = document.createElement('p');
                            resP.className = 'step-result';
                            resP.textContent = ensureDelimiters(sanitizeLatex(step.result));
                            card.appendChild(resP);
                            renderMath(resP);
                        }

                        container.appendChild(card);
                    });
                }
            }

            graphAnalysisContent.innerHTML = '';
            graphAnalysisContent.appendChild(container);
        } catch (err) {
            console.error('Graph AI error:', err);
            graphAnalysisContent.innerHTML = `<p style="color:var(--error);">${t('errorSolving')}</p>`;
        }
    });



    function showLoading(show) {
        loadingContainer.style.display = show ? 'block' : 'none';
        if (show) hideAnimationButton();
    }

    function showSolution(show) {
        solutionSection.style.display = show ? 'block' : 'none';
    }

    function showAnimationButton(solution) {
        let btn = document.getElementById('animateSolutionBtn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'animateSolutionBtn';
            btn.className = 'btn-primary';
            btn.style.marginLeft = '12px';
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg> ${t('animate')}`;

            const actions = document.querySelector('.solution-actions');
            if (actions) actions.insertBefore(btn, actions.firstChild);

            btn.addEventListener('click', () => {
                if (window.AnimationModule) AnimationModule.start(solution);
            });
        }
        btn.style.display = 'inline-flex';

        btn.onclick = () => {
            if (window.AnimationModule) AnimationModule.start(solution);
        };
    }

    function hideAnimationButton() {
        const btn = document.getElementById('animateSolutionBtn');
        if (btn) btn.style.display = 'none';
    }

    // Generates animations in the background right after a solve.
    // Does NOT block the UI — fires and forgets.
    // Once done, the animation button gets an updated solution with animation data.
    async function generateAnimationsInBackground(problemText, solution) {
        try {
            const response = await fetch('/mathnote/api/animate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem: problemText,
                    steps: solution.steps,
                    lang: currentLang
                })
            });

            if (!response.ok) return; // Silently fail — button still works with fallback

            const data = await response.json();
            if (!data.steps || !Array.isArray(data.steps)) return;

            const hasAnimation = data.steps.some(s => s.animation && s.animation.type !== 'none');
            if (!hasAnimation) return; // AI gave us all 'none', don't bother updating

            // Merge animated steps into the solution and update what the button launches
            const animatedSolution = { ...solution, steps: data.steps };
            currentSolution = animatedSolution;

            // Update button's click handler so it launches the animated version
            showAnimationButton(animatedSolution);

        } catch (err) {
            // Non-fatal — animation button will still open with 'Generate Animations' prompt
            console.warn('[AnimBg] Failed to pre-generate animations:', err.message);
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function sanitizeLatex(text) {
        if (!text) return '';

        // Step 1: Convert #LATEX ... #!LATEX markers to $ ... $ for KaTeX
        // This is the primary and most reliable detection method.
        let hasMarkers = false;
        let sanitized = text.replace(/#LATEX\s*([\s\S]*?)\s*#!LATEX/g, (_, latex) => {
            hasMarkers = true;
            return `$${latex.trim()}$`;
        });

        // Step 2: Escape HTML but preserve the $ delimiters we just created
        // We need to protect our $ math blocks from HTML escaping
        const mathBlocks = [];
        sanitized = sanitized.replace(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/g, (match) => {
            mathBlocks.push(match);
            return `\x00MATH${mathBlocks.length - 1}\x00`;
        });
        sanitized = escapeHtml(sanitized);
        // Restore math blocks
        sanitized = sanitized.replace(/\x00MATH(\d+)\x00/g, (_, i) => mathBlocks[parseInt(i)]);

        // Step 3: If AI used markers, we're done — no need for fragile regex guessing
        if (hasMarkers) {
            return sanitized;
        }

        // Step 4: Fallback — try to fix common LaTeX issues for responses without markers
        // Fix missing backslashes for common LaTeX commands
        const commonCmds = ['frac', 'sqrt', 'alpha', 'beta', 'gamma', 'delta', 'theta', 'lambda',
            'pi', 'sigma', 'phi', 'omega', 'sum', 'int', 'log', 'ln', 'sin', 'cos', 'tan',
            'text', 'times', 'div', 'cdot', 'pm', 'mp', 'leq', 'geq', 'neq', 'approx',
            'infty', 'partial', 'nabla', 'begin', 'end', 'left', 'right', 'circ', 'parallel'];

        commonCmds.forEach(cmd => {
            // Only add backslash if not already preceded by one
            const re = new RegExp(`(?<![\\\\a-zA-Z])${cmd}(?=[\\{\\s\\(\\^_]|$)`, 'g');
            sanitized = sanitized.replace(re, `\\${cmd}`);
        });

        // Fix double-escaped backslashes that can happen from JSON
        sanitized = sanitized.replace(/\\\\/g, '\\');

        // Fix missing backslash for begin/end blocks
        sanitized = sanitized.replace(/([^\\])end\{/g, '$1\\end{');
        sanitized = sanitized.replace(/([^\\])begin\{/g, '$1\\begin{');

        return sanitized;
    }

    function ensureDelimiters(text) {
        if (!text) return '';
        const trimmed = text.trim();
        // If it already has block delimiters, return as is
        if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) return trimmed;
        if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]')) return trimmed;

        // If it looks like a formula (has backslash, caret, underscore, etc) wrap in $$
        if (trimmed.includes('\\') || trimmed.includes('^') || trimmed.includes('_') || trimmed.includes('{') || trimmed.includes('=') || trimmed.includes('<') || trimmed.includes('>')) {
            // Remove single $ if present to avoid $$$...$$$
            const clean = trimmed.replace(/^\$+|\$+$/g, '');
            return `$$${clean}$$`;
        }
        return trimmed;
    }

    function renderMath(element) {
        if (!element) return;
        try {
            if (window.renderMathInElement) {
                renderMathInElement(element, {
                    delimiters: [
                        { left: '\\[', right: '\\]', display: true },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false }
                    ],
                    throwOnError: false
                });
            }
        } catch (e) {
            console.warn('KaTeX rendering failed:', e);
        }
    }


    function showToast(message, type = 'info') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 24px;
      border-radius: 12px;
      font-family: var(--font-primary);
      font-size: 14px;
      font-weight: 500;
      z-index: 300;
      animation: fadeIn 0.3s ease;
      max-width: 400px;
      ${type === 'success' ? 'background: var(--success-bg); color: var(--success); border: 1px solid rgba(34,197,94,0.3);' : ''}
      ${type === 'error' ? 'background: var(--error-bg); color: var(--error); border: 1px solid rgba(239,68,68,0.3);' : ''}
      ${type === 'info' ? 'background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color);' : ''}
    `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }


    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            savedModal.style.display = 'none';
            explainModal.style.display = 'none';
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            solveBtn.click();
        }
    });
});
